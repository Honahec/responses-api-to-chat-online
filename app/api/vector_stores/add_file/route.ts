import { requireUser } from "@/lib/auth";
import {
  getUserVectorStoreFileResources,
  linkUserVectorStoreFile,
} from "@/lib/file-resources";
import { createOpenAIClientForUser } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const openai = await createOpenAIClientForUser(user.id);
    const { vectorStoreId, fileId } = await request.json();
    const resources = await getUserVectorStoreFileResources({
      userId: user.id,
      vectorStoreId,
      fileId,
    });
    if (!resources) {
      return Response.json(
        { error: "File or vector store not found" },
        { status: 404 }
      );
    }
    const vectorStore = await openai.vectorStores.files.create(
      resources.vectorStore.provider_vector_store_id,
      {
        file_id: resources.file.provider_file_id,
      }
    );
    await linkUserVectorStoreFile({
      vectorStoreId: resources.vectorStore.id,
      fileId: resources.file.id,
    });
    return Response.json({
      id: resources.file.id,
      provider_file_id: resources.file.provider_file_id,
      vector_store_id: resources.vectorStore.id,
      provider_vector_store_id: resources.vectorStore.provider_vector_store_id,
      status: vectorStore.status,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error adding file:", error);
    return new Response("Error adding file", { status: 500 });
  }
}
