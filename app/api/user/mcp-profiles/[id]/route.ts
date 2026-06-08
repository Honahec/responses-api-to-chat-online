import { requireUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import {
  deleteUserMcpProfile,
  getUserMcpProfile,
  upsertUserMcpProfile,
} from "@/lib/user-tools";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseAllowedTools(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const profile = await getUserMcpProfile(user.id, id);
    if (!profile) {
      return Response.json({ error: "MCP profile not found" }, { status: 404 });
    }
    await recordAuditEvent({
      actorUserId: user.id,
      action: "mcp_profile.updated",
      metadata: {
        profile_id: profile.id,
        server_label: profile.server_label,
        server_url: profile.server_url,
      },
    });
    return Response.json({ profile });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching MCP profile:", error);
    return Response.json({ error: "Failed to fetch MCP profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json();
    const profile = await upsertUserMcpProfile({
      userId: user.id,
      id,
      serverLabel: body.server_label,
      serverUrl: body.server_url,
      allowedTools: parseAllowedTools(body.allowed_tools),
      approvalPolicy: body.skip_approval ? "never" : "always",
    });
    if (!profile) {
      return Response.json({ error: "MCP profile not found" }, { status: 404 });
    }
    return Response.json({ profile });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error updating MCP profile:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update MCP profile" },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteUserMcpProfile(user.id, id);
    await recordAuditEvent({
      actorUserId: user.id,
      action: "mcp_profile.deleted",
      metadata: { profile_id: id },
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error deleting MCP profile:", error);
    return Response.json({ error: "Failed to delete MCP profile" }, { status: 500 });
  }
}
