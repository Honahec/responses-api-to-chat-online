import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { getUserQuota, getUserUsage, setUserQuota } from "@/lib/quotas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const [quota, usage] = await Promise.all([
      getUserQuota(id),
      getUserUsage(id),
    ]);
    return NextResponse.json({ quota, usage });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching user quota:", error);
    return NextResponse.json({ error: "Failed to fetch quota" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const quota = await setUserQuota(id, {
      daily_request_limit: body.daily_request_limit ?? null,
      monthly_request_limit: body.monthly_request_limit ?? null,
      daily_token_limit: body.daily_token_limit ?? null,
      monthly_token_limit: body.monthly_token_limit ?? null,
      allowed_models: Array.isArray(body.allowed_models)
        ? body.allowed_models
        : null,
      enabled_tools: Array.isArray(body.enabled_tools)
        ? body.enabled_tools
        : null,
    });
    await recordAuditEvent({
      actorUserId: admin.id,
      targetUserId: id,
      action: "admin.quota.updated",
      metadata: { quota },
    });
    return NextResponse.json({ quota });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error updating user quota:", error);
    return NextResponse.json({ error: "Failed to update quota" }, { status: 500 });
  }
}
