import { createOpenAIClient } from "@/lib/openai";

export async function GET() {
  try {
    const openai = createOpenAIClient();
    const response = await openai.models.list();
    const models = response.data
      .map((model) => ({
        id: model.id,
        created: model.created,
        owned_by: model.owned_by,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return new Response(JSON.stringify({ models }), { status: 200 });
  } catch (error) {
    console.error("Error fetching models:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
