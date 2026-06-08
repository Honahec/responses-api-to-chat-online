import { getDeveloperPrompt, MODEL } from "@/config/constants";
import { requireUser } from "@/lib/auth";
import { getConversation } from "@/lib/conversations";
import {
  createOpenAIClientForUser,
  getDefaultModelForUser,
} from "@/lib/openai";
import { assertWithinQuota, recordRequestUsage } from "@/lib/quotas";
import { getTools } from "@/lib/tools/tools";
import { recordMcpApproval } from "@/lib/user-tools";
import { assertToolsAllowedByAdminPolicy } from "@/lib/admin-policy";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { conversationId, messages, toolsState } = await request.json();
    if (!conversationId) {
      return new Response(JSON.stringify({ error: "Missing conversationId" }), {
        status: 400,
      });
    }

    const conversation = await getConversation(user.id, conversationId);
    if (!conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
      });
    }

    const defaultModel = await getDefaultModelForUser(user.id);
    const model = toolsState?.selectedModel || defaultModel || MODEL;
    await assertToolsAllowedByAdminPolicy(toolsState);
    await assertWithinQuota({ userId: user.id, model, toolsState });
    for (const item of Array.isArray(messages) ? messages : []) {
      if (item?.type === "mcp_approval_response") {
        await recordMcpApproval({
          userId: user.id,
          conversationId,
          mcpProfileId: toolsState?.mcpConfig?.profile_id ?? null,
          approved: Boolean(item.approve),
        });
      }
    }

    const tools = await getTools(toolsState, user.id);
    await recordRequestUsage({ userId: user.id, conversationId, model });

    console.log("Tools:", tools);

    console.log("Received messages:", messages);

    const openai = await createOpenAIClientForUser(user.id);

    const events = await openai.responses.create({
      model,
      input: messages,
      instructions: getDeveloperPrompt(),
      tools,
      stream: true,
      parallel_tool_calls: false,
    });

    // Create a ReadableStream that emits SSE data
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of events) {
            // Sending all events to the client
            const data = JSON.stringify({
              event: event.type,
              data: event,
            });
            controller.enqueue(`data: ${data}\n\n`);
          }
          // End of stream
          controller.close();
        } catch (error) {
          console.error("Error in streaming loop:", error);
          controller.error(error);
        }
      },
    });

    // Return the ReadableStream as SSE
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error in POST handler:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
