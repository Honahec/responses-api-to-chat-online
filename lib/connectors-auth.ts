import { discovery, Configuration } from "openid-client";
import { refreshTokenGrant } from "openid-client";
import {
  getConnectorTokens,
  saveConnectorTokens,
} from "@/lib/connector-credentials";

let cachedConfig: Configuration | null = null;

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events.readonly", // Read access to Calendar events
  "https://www.googleapis.com/auth/gmail.readonly", // Read access to Gmail
];

export type FreshTokens = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

export async function getGoogleClient(): Promise<Configuration> {
  if (cachedConfig) return cachedConfig;

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env as Record<
    string,
    string | undefined
  >;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables"
    );
  }

  // Discover Google's Authorization Server metadata and configure the client
  cachedConfig = await discovery(
    new URL("https://accounts.google.com"),
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );

  return cachedConfig;
}

export function getRedirectUri(): string {
  const { GOOGLE_REDIRECT_URI } = process.env as Record<
    string,
    string | undefined
  >;
  return GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google/callback";
}

// Refresh when close to expiry (30s) or when missing access token but we have a refresh token
const EXPIRY_SKEW_MS = 30_000;

export async function getFreshAccessToken(userId: string): Promise<FreshTokens> {
  const tokenSet = await getConnectorTokens(userId, "google");

  let accessToken = tokenSet?.access_token;
  let refreshToken = tokenSet?.refresh_token;
  let expiresAt = tokenSet?.expires_at;

  const now = Date.now();
  const isExpiringSoon = expiresAt != null && now > expiresAt - EXPIRY_SKEW_MS;
  const shouldRefresh = Boolean(
    refreshToken && (!accessToken || isExpiringSoon)
  );

  if (shouldRefresh) {
    try {
      const config = await getGoogleClient();
      const refreshed = await refreshTokenGrant(config, refreshToken!);
      accessToken = refreshed.access_token || accessToken;
      refreshToken = refreshed.refresh_token || refreshToken;
      expiresAt =
        refreshed.expires_in != null
          ? now + refreshed.expires_in * 1000
          : expiresAt;

      await saveConnectorTokens({
        userId,
        connector: "google",
        tokens: {
          ...tokenSet,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
        },
      });
    } catch {
      // If refresh fails, fall through and return whatever we have
    }
  }
  return { accessToken, refreshToken, expiresAt };
}
