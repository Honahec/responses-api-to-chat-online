import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import {
  deleteConnectorTokens,
  hasConnectorTokens,
} from "@/lib/connector-credentials";

export async function GET() {
  const user = await requireUser();
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env as Record<
    string,
    string | undefined
  >;
  const oauthConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
  return NextResponse.json({
    connected: await hasConnectorTokens(user.id, "google"),
    oauthConfigured,
  });
}

export async function DELETE() {
  const user = await requireUser();
  await deleteConnectorTokens(user.id, "google");
  await recordAuditEvent({
    actorUserId: user.id,
    action: "connector.disconnected",
    metadata: { connector: "google" },
  });
  return NextResponse.json({ ok: true });
}
