import { toolsList } from "@/config/tools-list";
import { query } from "@/lib/db";

export type UserMcpProfile = {
  id: string;
  user_id: string;
  server_label: string;
  server_url: string;
  allowed_tools: unknown;
  approval_policy: string;
  secrets_encrypted: string | null;
  created_at: string;
  updated_at: string;
};

export type UserFunction = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  parameters_schema: unknown;
  execution_type: "builtin" | "http";
  endpoint_url: string | null;
  secrets_encrypted: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeMcpProfile(row: UserMcpProfile) {
  return {
    ...row,
    allowed_tools: toStringArray(row.allowed_tools),
    has_secrets: Boolean(row.secrets_encrypted),
    secrets_encrypted: undefined,
  };
}

function normalizeFunction(row: UserFunction) {
  return {
    ...row,
    has_secrets: Boolean(row.secrets_encrypted),
    secrets_encrypted: undefined,
  };
}

export async function listUserMcpProfiles(userId: string) {
  const result = await query<UserMcpProfile>(
    `select id, user_id, server_label, server_url, allowed_tools, approval_policy, secrets_encrypted, created_at, updated_at
     from user_mcp_profiles
     where user_id = $1
     order by updated_at desc`,
    [userId]
  );
  return result.rows.map(normalizeMcpProfile);
}

export async function getUserMcpProfile(userId: string, id: string) {
  const result = await query<UserMcpProfile>(
    `select id, user_id, server_label, server_url, allowed_tools, approval_policy, secrets_encrypted, created_at, updated_at
     from user_mcp_profiles
     where user_id = $1 and id = $2`,
    [userId, id]
  );
  return result.rows[0] ?? null;
}

export async function upsertUserMcpProfile({
  userId,
  id,
  serverLabel,
  serverUrl,
  allowedTools,
  approvalPolicy,
}: {
  userId: string;
  id?: string;
  serverLabel: string;
  serverUrl: string;
  allowedTools: string[];
  approvalPolicy: string;
}) {
  const parsedUrl = new URL(serverUrl);
  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
    throw new Error("MCP server URL must use HTTPS unless it is localhost");
  }

  const result = await query<UserMcpProfile>(
    id
      ? `update user_mcp_profiles
         set server_label = $3,
             server_url = $4,
             allowed_tools = $5,
             approval_policy = $6,
             updated_at = now()
         where user_id = $1 and id = $2
         returning id, user_id, server_label, server_url, allowed_tools, approval_policy, secrets_encrypted, created_at, updated_at`
      : `insert into user_mcp_profiles (user_id, id, server_label, server_url, allowed_tools, approval_policy)
         values ($1, gen_random_uuid(), $3, $4, $5, $6)
         returning id, user_id, server_label, server_url, allowed_tools, approval_policy, secrets_encrypted, created_at, updated_at`,
    [
      userId,
      id ?? null,
      serverLabel.trim(),
      serverUrl.trim().replace(/\/+$/, ""),
      JSON.stringify(allowedTools),
      approvalPolicy,
    ]
  );

  const row = result.rows[0];
  return row ? normalizeMcpProfile(row) : null;
}

export async function deleteUserMcpProfile(userId: string, id: string) {
  await query("delete from user_mcp_profiles where user_id = $1 and id = $2", [
    userId,
    id,
  ]);
}

export async function listUserFunctions(userId: string) {
  await ensureDefaultUserFunctions(userId);
  const result = await query<UserFunction>(
    `select id, user_id, name, description, parameters_schema, execution_type, endpoint_url, secrets_encrypted, enabled, created_at, updated_at
     from user_functions
     where user_id = $1
     order by name asc`,
    [userId]
  );
  return result.rows.map(normalizeFunction);
}

export async function getEnabledUserFunctions(userId: string) {
  await ensureDefaultUserFunctions(userId);
  const result = await query<UserFunction>(
    `select id, user_id, name, description, parameters_schema, execution_type, endpoint_url, secrets_encrypted, enabled, created_at, updated_at
     from user_functions
     where user_id = $1 and enabled = true
     order by name asc`,
    [userId]
  );
  return result.rows;
}

export async function getUserFunctionByName(userId: string, name: string) {
  await ensureDefaultUserFunctions(userId);
  const result = await query<UserFunction>(
    `select id, user_id, name, description, parameters_schema, execution_type, endpoint_url, secrets_encrypted, enabled, created_at, updated_at
     from user_functions
     where user_id = $1 and name = $2 and enabled = true`,
    [userId, name]
  );
  return result.rows[0] ?? null;
}

export async function updateUserFunction({
  userId,
  id,
  enabled,
}: {
  userId: string;
  id: string;
  enabled: boolean;
}) {
  const result = await query<UserFunction>(
    `update user_functions
     set enabled = $3, updated_at = now()
     where user_id = $1 and id = $2
     returning id, user_id, name, description, parameters_schema, execution_type, endpoint_url, secrets_encrypted, enabled, created_at, updated_at`,
    [userId, id, enabled]
  );
  return result.rows[0] ? normalizeFunction(result.rows[0]) : null;
}

export async function ensureDefaultUserFunctions(userId: string) {
  for (const tool of toolsList) {
    await query(
      `insert into user_functions (
         user_id,
         name,
         description,
         parameters_schema,
         execution_type,
         enabled
       )
       values ($1, $2, $3, $4, 'builtin', true)
       on conflict (user_id, name) do nothing`,
      [
        userId,
        tool.name,
        tool.description,
        JSON.stringify({
          type: "object",
          properties: tool.parameters,
          required: Object.keys(tool.parameters),
          additionalProperties: false,
        }),
      ]
    );
  }
}

export async function recordMcpApproval({
  userId,
  conversationId,
  mcpProfileId,
  toolName,
  argumentsJson,
  approved,
}: {
  userId: string;
  conversationId?: string | null;
  mcpProfileId?: string | null;
  toolName?: string | null;
  argumentsJson?: unknown;
  approved: boolean;
}) {
  await query(
    `insert into mcp_approval_events (
       user_id,
       conversation_id,
       mcp_profile_id,
       tool_name,
       arguments,
       approved
     )
     values ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      conversationId ?? null,
      mcpProfileId ?? null,
      toolName ?? null,
      argumentsJson ? JSON.stringify(argumentsJson) : null,
      approved,
    ]
  );
}

