import { NextResponse } from "next/server";
import { createConversation, listConversations } from "@/lib/conversations";
import { requireUser } from "@/lib/auth";
import { MODEL } from "@/config/constants";

export async function GET() {
  try {
    const user = await requireUser();
    const conversations = await listConversations(user.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error listing conversations:", error);
    return NextResponse.json({ error: "Failed to list conversations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const conversation = await createConversation({
      userId: user.id,
      title: body.title || "New chat",
      model: body.model || MODEL,
      toolsState: body.toolsState || {},
    });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error creating conversation:", error);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
