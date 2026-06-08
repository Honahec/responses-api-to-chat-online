import { requireUser } from "@/lib/auth";
import { getProviderCredentials } from "@/lib/provider-settings";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("file_id");
    const containerId = searchParams.get("container_id");
    const filename = searchParams.get("filename");
    if (!fileId) {
      return new Response(JSON.stringify({ error: "Missing file_id" }), {
        status: 400,
      });
    }
    const credentials = await getProviderCredentials(user.id);
    const url = containerId
      ? `${credentials.baseURL}/containers/${containerId}/files/${fileId}/content`
      : `${credentials.baseURL}/container-files/${fileId}/content`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
      },
    });
    if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
    const blob = await res.blob();
    return new Response(blob, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename=${filename ?? fileId}`,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Error fetching container file", err);
    return new Response(JSON.stringify({ error: "Failed to fetch file" }), {
      status: 500,
    });
  }
}
