import { decryptCredential, encryptCredential } from "@/lib/credentials";
import { query } from "@/lib/db";
import { OAuthTokens } from "@/lib/session";

type ConnectorCredentialRow = {
  id: string;
  user_id: string;
  connector: string;
  token_set_encrypted: string;
  scope: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function saveConnectorTokens({
  userId,
  connector,
  tokens,
}: {
  userId: string;
  connector: string;
  tokens: OAuthTokens;
}) {
  await query(
    `insert into user_connector_credentials (
       user_id,
       connector,
       token_set_encrypted,
       scope,
       expires_at
     )
     values ($1, $2, $3, $4, $5)
     on conflict (user_id, connector)
     do update set
       token_set_encrypted = excluded.token_set_encrypted,
       scope = excluded.scope,
       expires_at = excluded.expires_at,
       updated_at = now()`,
    [
      userId,
      connector,
      encryptCredential(JSON.stringify(tokens)),
      tokens.scope ?? null,
      tokens.expires_at ? new Date(tokens.expires_at) : null,
    ]
  );
}

export async function getConnectorTokens(userId: string, connector: string) {
  const result = await query<ConnectorCredentialRow>(
    `select id, user_id, connector, token_set_encrypted, scope, expires_at, created_at, updated_at
     from user_connector_credentials
     where user_id = $1 and connector = $2`,
    [userId, connector]
  );
  const row = result.rows[0];
  if (!row) return null;
  return JSON.parse(decryptCredential(row.token_set_encrypted)) as OAuthTokens;
}

export async function hasConnectorTokens(userId: string, connector: string) {
  const result = await query(
    `select 1
     from user_connector_credentials
     where user_id = $1 and connector = $2
     limit 1`,
    [userId, connector]
  );
  return Boolean(result.rows[0]);
}

export async function deleteConnectorTokens(userId: string, connector: string) {
  await query(
    `delete from user_connector_credentials
     where user_id = $1 and connector = $2`,
    [userId, connector]
  );
}
