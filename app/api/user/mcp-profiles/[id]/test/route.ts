import { requireUser } from "@/lib/auth";
import { getUserMcpProfile } from "@/lib/user-tools";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const profile = await getUserMcpProfile(user.id, id);
    if (!profile) {
      return Response.json({ error: "MCP profile not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error testing MCP profile:", error);
    return Response.json({ error: "MCP profile test failed" }, { status: 400 });
  }
}

