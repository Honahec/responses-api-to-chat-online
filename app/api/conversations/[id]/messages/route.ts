import { NextResponse } from "next/server";
import { getConversation, listConversationMessages } from "@/lib/conversations";
import { requireUser } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const conversation = await getConversation(user.id, id);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    const messages = await listConversationMessages(user.id, id);
    return NextResponse.json({ messages });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error listing conversation messages:", error);
    return NextResponse.json({ error: "Failed to list messages" }, { status: 500 });
  }
}
