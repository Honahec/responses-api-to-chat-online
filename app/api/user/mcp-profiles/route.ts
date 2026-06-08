import { requireUser } from "@/lib/auth";
import { listUserMcpProfiles, upsertUserMcpProfile } from "@/lib/user-tools";

function parseAllowedTools(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export async function GET() {
  try {
    const user = await requireUser();
    const profiles = await listUserMcpProfiles(user.id);
    return Response.json({ profiles });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error listing MCP profiles:", error);
    return Response.json({ error: "Failed to list MCP profiles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const profile = await upsertUserMcpProfile({
      userId: user.id,
      id: typeof body.id === "string" ? body.id : undefined,
      serverLabel: body.server_label,
      serverUrl: body.server_url,
      allowedTools: parseAllowedTools(body.allowed_tools),
      approvalPolicy: body.skip_approval ? "never" : "always",
    });
    return Response.json({ profile }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error saving MCP profile:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save MCP profile" },
      { status: 400 }
    );
  }
}

