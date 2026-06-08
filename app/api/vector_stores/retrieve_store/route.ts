import { requireUser } from "@/lib/auth";
import { getUserVectorStore } from "@/lib/file-resources";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const vectorStoreId = searchParams.get("vector_store_id");
    if (!vectorStoreId) {
      return Response.json(
        { error: "Missing vector_store_id" },
        { status: 400 }
      );
    }
    const vectorStore = await getUserVectorStore(user.id, vectorStoreId);
    if (!vectorStore) {
      return Response.json({ error: "Vector store not found" }, { status: 404 });
    }
    return Response.json({
      id: vectorStore.id,
      provider_vector_store_id: vectorStore.provider_vector_store_id,
      name: vectorStore.name,
      created_at: vectorStore.created_at,
      updated_at: vectorStore.updated_at,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching vector store:", error);
    return new Response("Error fetching vector store", { status: 500 });
  }
}
