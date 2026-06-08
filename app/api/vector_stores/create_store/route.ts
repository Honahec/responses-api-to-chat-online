import { requireUser } from "@/lib/auth";
import { createOpenAIClientForUser } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const openai = await createOpenAIClientForUser(user.id);
    const { name } = await request.json();
    const vectorStore = await openai.vectorStores.create({
      name,
    });
    return new Response(JSON.stringify(vectorStore), { status: 200 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error creating vector store:", error);
    return new Response("Error creating vector store", { status: 500 });
  }
}
