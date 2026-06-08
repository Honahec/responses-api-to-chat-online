import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorizationCodeGrant } from "openid-client";
import { requireUser } from "@/lib/auth";
import { saveConnectorTokens } from "@/lib/connector-credentials";
import { getGoogleClient } from "@/lib/connectors-auth";
import { OAuthTokens } from "@/lib/session";

const STATE_COOKIE = "gc_oauth_state";
const VERIFIER_COOKIE = "gc_oauth_verifier";

export async function GET(request: NextRequest) {
  const config = await getGoogleClient();
  const jar = await cookies();
  const user = await requireUser();

  const stateCookie = jar.get(STATE_COOKIE)?.value;
  const verifier = jar.get(VERIFIER_COOKIE)?.value;

  // Clear the one-time cookies regardless of outcome
  jar.delete(STATE_COOKIE);
  jar.delete(VERIFIER_COOKIE);

  const url = new URL(request.url);
  const returnedState = url.searchParams.get("state") || undefined;
  const hasCode = url.searchParams.has("code");

  if (!stateCookie || !verifier || !hasCode || returnedState !== stateCookie) {
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  }

  try {
    const tokenResponse = await authorizationCodeGrant(config, url, {
      expectedState: stateCookie,
      pkceCodeVerifier: verifier,
    });

    const now = Date.now();
    const tokens: OAuthTokens = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      id_token: tokenResponse.id_token,
      token_type: tokenResponse.token_type,
      scope: tokenResponse.scope,
      expires_at:
        tokenResponse.expires_in != null
          ? now + tokenResponse.expires_in * 1000
          : undefined,
    };

    await saveConnectorTokens({
      userId: user.id,
      connector: "google",
      tokens,
    });

    return NextResponse.redirect(new URL("/?connected=1", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }
}
