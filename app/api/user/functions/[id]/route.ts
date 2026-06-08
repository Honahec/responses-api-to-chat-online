import { requireUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { updateUserFunction } from "@/lib/user-tools";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json();
    const fn = await updateUserFunction({
      userId: user.id,
      id,
      enabled: Boolean(body.enabled),
    });
    if (!fn) {
      return Response.json({ error: "Function not found" }, { status: 404 });
    }
    await recordAuditEvent({
      actorUserId: user.id,
      action: "function.updated",
      metadata: { function_id: fn.id, name: fn.name, enabled: fn.enabled },
    });
    return Response.json({ function: fn });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error updating user function:", error);
    return Response.json({ error: "Failed to update function" }, { status: 500 });
  }
}
