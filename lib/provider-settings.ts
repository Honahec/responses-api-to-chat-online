import { MODEL } from "@/config/constants";
import {
  decryptCredential,
  encryptCredential,
  fingerprintCredential,
} from "@/lib/credentials";
import { assertProviderBaseURLAllowed } from "@/lib/admin-policy";
import { query } from "@/lib/db";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export type ProviderSettings = {
  user_id: string;
  base_url: string;
  api_key_fingerprint: string;
  default_model: string | null;
  created_at: string;
  updated_at: string;
};

type ProviderSettingsRow = ProviderSettings & {
  api_key_encrypted: string;
};

export type ProviderCredentials = {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  apiKeyFingerprint: string;
};

function normalizeBaseURL(baseURL: string) {
  const trimmed = baseURL.trim();
  if (!trimmed) {
    throw new Error("Provider base URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Provider base URL must be a valid URL");
  }

  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("Provider base URL must use HTTPS unless it is localhost");
  }

  return trimmed.replace(/\/+$/, "");
}

function publicSettings(row: ProviderSettingsRow): ProviderSettings {
  return {
    user_id: row.user_id,
    base_url: row.base_url,
    api_key_fingerprint: row.api_key_fingerprint,
    default_model: row.default_model,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getProviderSettings(userId: string) {
  const result = await query<ProviderSettingsRow>(
    `select user_id, base_url, api_key_encrypted, api_key_fingerprint, default_model, created_at, updated_at
     from user_provider_settings
     where user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  return row ? publicSettings(row) : null;
}

export async function getProviderCredentials(
  userId: string
): Promise<ProviderCredentials> {
  const result = await query<ProviderSettingsRow>(
    `select user_id, base_url, api_key_encrypted, api_key_fingerprint, default_model, created_at, updated_at
     from user_provider_settings
     where user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Response(
      JSON.stringify({ error: "Provider settings are not configured" }),
      { status: 400 }
    );
  }
  await assertProviderBaseURLAllowed(row.base_url);

  return {
    baseURL: row.base_url,
    apiKey: decryptCredential(row.api_key_encrypted),
    defaultModel: row.default_model || MODEL,
    apiKeyFingerprint: row.api_key_fingerprint,
  };
}

export async function upsertProviderSettings({
  userId,
  baseURL = DEFAULT_OPENAI_BASE_URL,
  apiKey,
  defaultModel,
}: {
  userId: string;
  baseURL?: string;
  apiKey: string;
  defaultModel?: string | null;
}) {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Provider API key is required");
  }

  const normalizedBaseURL = normalizeBaseURL(baseURL);
  await assertProviderBaseURLAllowed(normalizedBaseURL);
  const result = await query<ProviderSettingsRow>(
    `insert into user_provider_settings (
       user_id,
       base_url,
       api_key_encrypted,
       api_key_fingerprint,
       default_model
     )
     values ($1, $2, $3, $4, $5)
     on conflict (user_id)
     do update set
       base_url = excluded.base_url,
       api_key_encrypted = excluded.api_key_encrypted,
       api_key_fingerprint = excluded.api_key_fingerprint,
       default_model = excluded.default_model,
       updated_at = now()
     returning user_id, base_url, api_key_encrypted, api_key_fingerprint, default_model, created_at, updated_at`,
    [
      userId,
      normalizedBaseURL,
      encryptCredential(trimmedKey),
      fingerprintCredential(trimmedKey),
      defaultModel?.trim() || null,
    ]
  );

  return publicSettings(result.rows[0]);
}
