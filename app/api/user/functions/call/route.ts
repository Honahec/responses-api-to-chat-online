import { requireUser } from "@/lib/auth";
import { assertToolsAllowedByAdminPolicy } from "@/lib/admin-policy";
import { getConversation } from "@/lib/conversations";
import { executeUserFunction } from "@/lib/functions-execution";
import { assertWithinQuota, recordRequestUsage } from "@/lib/quotas";
import { getDefaultModelForUser } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    if (!body.conversationId) {
      return Response.json({ error: "Missing conversationId" }, { status: 400 });
    }
    const conversation = await getConversation(user.id, body.conversationId);
    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }
    const toolsState = {
      webSearchEnabled: false,
      fileSearchEnabled: false,
      functionsEnabled: true,
      codeInterpreterEnabled: false,
      mcpEnabled: false,
      googleIntegrationEnabled: false,
    } as any;
    const model = conversation.model || (await getDefaultModelForUser(user.id));
    await assertToolsAllowedByAdminPolicy(toolsState);
    await assertWithinQuota({ userId: user.id, model, toolsState });
    const output = await executeUserFunction({
      userId: user.id,
      name: body.name,
      parameters: body.parameters ?? {},
    });
    await recordRequestUsage({
      userId: user.id,
      conversationId: body.conversationId,
      model,
    });
    return Response.json({ output });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error calling user function:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Function call failed" },
      { status: 400 }
    );
  }
}
