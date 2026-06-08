import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import {
  Configuration,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discovery,
  randomPKCECodeVerifier,
  randomState,
} from "openid-client";
import { query } from "@/lib/db";

const AUTH_SESSION_COOKIE = "responses_auth_session";
const AUTH_STATE_COOKIE = "responses_oidc_state";
const AUTH_VERIFIER_COOKIE = "responses_oidc_verifier";
const AUTH_NONCE_COOKIE = "responses_oidc_nonce";

let cachedOIDCConfig: Configuration | null = null;

export type AuthRole = "admin" | "user";

export type AuthUser = {
  id: string;
  issuer: string;
  subject: string;
  email: string | null;
  name: string | null;
  role: AuthRole;
  groups: string[];
  enabled: boolean;
};

type UserRow = {
  id: string;
  issuer: string;
  subject: string;
  email: string | null;
  name: string | null;
  role: AuthRole;
  groups: string[];
  enabled: boolean;
};

export function getOIDCEnv() {
  const env = process.env as Record<string, string | undefined>;
  return {
    issuerUrl: env.OIDC_ISSUER_URL,
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET,
    redirectUri:
      env.OIDC_REDIRECT_URI || "http://localhost:3000/api/auth/callback",
    groupsClaim: env.OIDC_GROUPS_CLAIM || "groups",
    adminGroup: env.OIDC_ADMIN_GROUP || "superadmin",
    userGroup: env.OIDC_USER_GROUP || "chat_user",
    scopes: env.OIDC_SCOPES || "openid email profile groups",
  };
}

export function isOIDCConfigured() {
  const { issuerUrl, clientId } = getOIDCEnv();
  return Boolean(issuerUrl && clientId);
}

export async function getOIDCClient() {
  if (cachedOIDCConfig) return cachedOIDCConfig;

  const { issuerUrl, clientId, clientSecret } = getOIDCEnv();
  if (!issuerUrl || !clientId) {
    throw new Error("Missing OIDC_ISSUER_URL or OIDC_CLIENT_ID");
  }

  cachedOIDCConfig = await discovery(
    new URL(issuerUrl),
    clientId,
    clientSecret
  );
  return cachedOIDCConfig;
}

export async function buildLoginRedirect() {
  const config = await getOIDCClient();
  const { redirectUri, scopes } = getOIDCEnv();
  const jar = await cookies();
  const state = randomState();
  const nonce = randomBytes(16).toString("hex");
  const verifier = randomPKCECodeVerifier();
  const challenge = await calculatePKCECodeChallenge(verifier);
  const cookieOptions = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
  };

  jar.set(AUTH_STATE_COOKIE, state, cookieOptions);
  jar.set(AUTH_VERIFIER_COOKIE, verifier, cookieOptions);
  jar.set(AUTH_NONCE_COOKIE, nonce, cookieOptions);

  return buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });
}

export async function consumeLoginCookies() {
  const jar = await cookies();
  const state = jar.get(AUTH_STATE_COOKIE)?.value;
  const verifier = jar.get(AUTH_VERIFIER_COOKIE)?.value;
  const nonce = jar.get(AUTH_NONCE_COOKIE)?.value;

  jar.delete(AUTH_STATE_COOKIE);
  jar.delete(AUTH_VERIFIER_COOKIE);
  jar.delete(AUTH_NONCE_COOKIE);

  return { state, verifier, nonce };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAuthSession(userId: string) {
  const jar = await cookies();
  const token = randomBytes(32).toString("base64url");
  const sessionHash = hashSessionToken(token);
  const maxAgeSeconds = 60 * 60 * 24 * 7;

  await query(
    `insert into sessions (user_id, session_hash, expires_at)
     values ($1, $2, now() + ($3 || ' seconds')::interval)`,
    [userId, sessionHash, maxAgeSeconds]
  );

  jar.set(AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  });
}

export async function clearAuthSession() {
  const jar = await cookies();
  const token = jar.get(AUTH_SESSION_COOKIE)?.value;
  if (token) {
    await query("delete from sessions where session_hash = $1", [
      hashSessionToken(token),
    ]);
  }
  jar.delete(AUTH_SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = await query<UserRow>(
    `select u.id, u.issuer, u.subject, u.email, u.name, u.role, u.groups, u.enabled
     from sessions s
     join users u on u.id = s.user_id
     where s.session_hash = $1
       and s.expires_at > now()
       and u.enabled = true
     limit 1`,
    [hashSessionToken(token)]
  );

  const user = result.rows[0];
  if (!user) return null;

  await query(
    "update sessions set last_seen_at = now() where session_hash = $1",
    [hashSessionToken(token)]
  );

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
    });
  }
  return user;
}

export function getClaimValue(claims: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object" && key in value) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, claims);
}

export function extractGroups(claims: Record<string, unknown>) {
  const { groupsClaim } = getOIDCEnv();
  const value = getClaimValue(claims, groupsClaim);
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value.split(/[,\s]+/).filter(Boolean);
  }
  return [];
}

export function resolveRole(groups: string[]): AuthRole | null {
  const { adminGroup, userGroup } = getOIDCEnv();
  if (groups.includes(adminGroup)) return "admin";
  if (groups.includes(userGroup)) return "user";
  return null;
}

export async function upsertUserFromClaims(claims: Record<string, unknown>) {
  const { issuerUrl } = getOIDCEnv();
  const subject = typeof claims.sub === "string" ? claims.sub : "";
  const email = typeof claims.email === "string" ? claims.email : null;
  const name = typeof claims.name === "string" ? claims.name : null;
  const groups = extractGroups(claims);
  const role = resolveRole(groups);

  if (!issuerUrl || !subject) {
    throw new Error("OIDC claims missing issuer or subject");
  }
  if (!role) {
    throw new Error("User does not belong to an authorized OIDC group");
  }

  const result = await query<UserRow>(
    `insert into users (issuer, subject, email, name, role, groups)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (issuer, subject)
     do update set
       email = excluded.email,
       name = excluded.name,
       role = excluded.role,
       groups = excluded.groups,
       updated_at = now()
     returning id, issuer, subject, email, name, role, groups, enabled`,
    [issuerUrl, subject, email, name, role, JSON.stringify(groups)]
  );

  const user = result.rows[0];
  if (!user.enabled) {
    throw new Error("User is disabled");
  }
  return user;
}
