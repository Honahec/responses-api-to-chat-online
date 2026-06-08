import { NextResponse } from "next/server";
import { saveConversationState } from "@/lib/conversations";
import { requireUser } from "@/lib/auth";
import { MODEL } from "@/config/constants";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json();
    const conversation = await saveConversationState({
      userId: user.id,
      conversationId: id,
      model: body.model || MODEL,
      toolsState: body.toolsState || {},
      chatMessages: Array.isArray(body.chatMessages) ? body.chatMessages : [],
      conversationItems: Array.isArray(body.conversationItems)
        ? body.conversationItems
        : [],
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json({ conversation });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error saving conversation state:", error);
    return NextResponse.json({ error: "Failed to save conversation state" }, { status: 500 });
  }
}
