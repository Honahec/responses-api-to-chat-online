import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const result = await query(
      `select id, issuer, subject, email, name, role, groups, enabled, created_at, updated_at
       from users
       where id = $1
       limit 1`,
      [id]
    );
    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    await recordAuditEvent({
      actorUserId: admin.id,
      targetUserId: id,
      action: "admin.user.updated",
      metadata: { enabled: user.enabled },
    });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching admin user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const result = await query(
      `update users
       set enabled = coalesce($2, enabled), updated_at = now()
       where id = $1
       returning id, issuer, subject, email, name, role, groups, enabled, created_at, updated_at`,
      [id, typeof body.enabled === "boolean" ? body.enabled : null]
    );
    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error updating admin user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
