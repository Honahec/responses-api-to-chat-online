import { NextRequest, NextResponse } from "next/server";
import { authorizationCodeGrant } from "openid-client";
import {
  consumeLoginCookies,
  createAuthSession,
  getOIDCClient,
  upsertUserFromClaims,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { state, verifier, nonce } = await consumeLoginCookies();
    if (!state || !verifier || !nonce) {
      return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
    }

    const config = await getOIDCClient();
    const tokenResponse = await authorizationCodeGrant(config, new URL(request.url), {
      expectedState: state,
      expectedNonce: nonce,
      pkceCodeVerifier: verifier,
    });
    const claims = tokenResponse.claims();
    if (!claims) {
      return NextResponse.redirect(new URL("/?error=missing_claims", request.url));
    }

    const user = await upsertUserFromClaims(claims as Record<string, unknown>);
    await createAuthSession(user.id);

    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Error completing OIDC login:", error);
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }
}
