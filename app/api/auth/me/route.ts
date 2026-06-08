import { NextResponse } from "next/server";
import { getCurrentUser, isOIDCConfigured } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({
    authenticated: Boolean(user),
    oidcConfigured: isOIDCConfigured(),
    user,
  });
}
