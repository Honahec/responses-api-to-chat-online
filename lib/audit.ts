import { query } from "@/lib/db";

export async function recordAuditEvent({
  actorUserId,
  targetUserId,
  action,
  metadata = {},
}: {
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await query(
    `insert into audit_events (actor_user_id, target_user_id, action, metadata)
     values ($1, $2, $3, $4)`,
    [
      actorUserId ?? null,
      targetUserId ?? actorUserId ?? null,
      action,
      JSON.stringify(metadata),
    ]
  );
}

