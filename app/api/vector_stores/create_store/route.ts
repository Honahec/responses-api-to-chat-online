import { requireUser } from "@/lib/auth";
import { createUserVectorStore } from "@/lib/file-resources";
import { createOpenAIClientForUser } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const openai = await createOpenAIClientForUser(user.id);
    const { name } = await request.json();
    const vectorStore = await openai.vectorStores.create({
      name,
    });
    const userVectorStore = await createUserVectorStore({
      userId: user.id,
      providerVectorStoreId: vectorStore.id,
      name: vectorStore.name || name,
    });
    return Response.json({
      id: userVectorStore.id,
      provider_vector_store_id: userVectorStore.provider_vector_store_id,
      name: userVectorStore.name,
      created_at: userVectorStore.created_at,
      updated_at: userVectorStore.updated_at,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error creating vector store:", error);
    return new Response("Error creating vector store", { status: 500 });
  }
}
