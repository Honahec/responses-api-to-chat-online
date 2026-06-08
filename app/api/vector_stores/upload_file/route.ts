import { requireUser } from "@/lib/auth";
import { createOpenAIClientForUser } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const openai = await createOpenAIClientForUser(user.id);
    const { fileObject } = await request.json();
    const fileBuffer = Buffer.from(fileObject.content, "base64");
    const fileBlob = new Blob([fileBuffer], {
      type: "application/octet-stream",
    });

    const file = await openai.files.create({
      file: new File([fileBlob], fileObject.name),
      purpose: "assistants",
    });

    return new Response(JSON.stringify(file), { status: 200 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error uploading file:", error);
    return new Response("Error uploading file", { status: 500 });
  }
}
