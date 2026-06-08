import { requireUser } from "@/lib/auth";
import { listUserVectorStoreFiles } from "@/lib/file-resources";

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
    const files = await listUserVectorStoreFiles(user.id, vectorStoreId);
    return Response.json({ data: files });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching files:", error);
    return new Response("Error fetching files", { status: 500 });
  }
}
