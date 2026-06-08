import { requireUser } from "@/lib/auth";
import { createOpenAIClientForUser } from "@/lib/openai";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const openai = await createOpenAIClientForUser(user.id);
    const { searchParams } = new URL(request.url);
    const vectorStoreId = searchParams.get("vector_store_id");
    const vectorStore = await openai.vectorStores.retrieve(
      vectorStoreId || ""
    );
    return new Response(JSON.stringify(vectorStore), { status: 200 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching vector store:", error);
    return new Response("Error fetching vector store", { status: 500 });
  }
}
