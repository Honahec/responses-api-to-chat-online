import { requireUser } from "@/lib/auth";
import { createOpenAIClientForUser } from "@/lib/openai";

export async function POST() {
  try {
    const user = await requireUser();
    const openai = await createOpenAIClientForUser(user.id);
    await openai.models.list({ limit: 1 } as any);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error testing provider settings:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Provider test failed" },
      { status: 400 }
    );
  }
}
