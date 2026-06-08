import { requireUser } from "@/lib/auth";
import { createOpenAIClientForUser } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const openai = await createOpenAIClientForUser(user.id);
    const { vectorStoreId, fileId } = await request.json();
    const vectorStore = await openai.vectorStores.files.create(
      vectorStoreId,
      {
        file_id: fileId,
      }
    );
    return new Response(JSON.stringify(vectorStore), { status: 200 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error adding file:", error);
    return new Response("Error adding file", { status: 500 });
  }
}
