import { requireUser } from "@/lib/auth";
import { getAdminPolicy } from "@/lib/admin-policy";
import { createUserFile } from "@/lib/file-resources";
import { createOpenAIClientForUser } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const openai = await createOpenAIClientForUser(user.id);
    const { fileObject } = await request.json();
    const fileBuffer = Buffer.from(fileObject.content, "base64");
    const policy = await getAdminPolicy();
    if (
      policy.file_upload_max_bytes != null &&
      fileBuffer.byteLength > policy.file_upload_max_bytes
    ) {
      return Response.json({ error: "File is too large" }, { status: 413 });
    }
    const fileBlob = new Blob([fileBuffer], {
      type: "application/octet-stream",
    });

    const file = await openai.files.create({
      file: new File([fileBlob], fileObject.name),
      purpose: "assistants",
    });
    const userFile = await createUserFile({
      userId: user.id,
      providerFileId: file.id,
      filename: fileObject.name,
      purpose: "assistants",
      sizeBytes: file.bytes ?? null,
    });

    return Response.json({
      id: userFile.id,
      provider_file_id: userFile.provider_file_id,
      filename: userFile.filename,
      purpose: userFile.purpose,
      size_bytes: userFile.size_bytes,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error uploading file:", error);
    return new Response("Error uploading file", { status: 500 });
  }
}
