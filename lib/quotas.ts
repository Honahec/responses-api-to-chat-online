import { ToolsState } from "@/stores/useToolsStore";
import { query } from "@/lib/db";

export type QuotaSettings = {
  daily_request_limit: number | null;
  monthly_request_limit: number | null;
  daily_token_limit: number | null;
  monthly_token_limit: number | null;
  allowed_models: string[] | null;
  enabled_tools: string[] | null;
};

type QuotaRow = {
  daily_request_limit: number | null;
  monthly_request_limit: number | null;
  daily_token_limit: number | null;
  monthly_token_limit: number | null;
  allowed_models: unknown;
  enabled_tools: unknown;
};

type UsageRow = {
  daily_requests: string;
  monthly_requests: string;
  daily_tokens: string;
  monthly_tokens: string;
};

const defaultQuota: QuotaSettings = {
  daily_request_limit: null,
  monthly_request_limit: null,
  daily_token_limit: null,
  monthly_token_limit: null,
  allowed_models: null,
  enabled_tools: null,
};

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : null;
}

function normalizeQuota(row?: QuotaRow): QuotaSettings {
  if (!row) return defaultQuota;
  return {
    daily_request_limit: row.daily_request_limit,
    monthly_request_limit: row.monthly_request_limit,
    daily_token_limit: row.daily_token_limit,
    monthly_token_limit: row.monthly_token_limit,
    allowed_models: toStringArray(row.allowed_models),
    enabled_tools: toStringArray(row.enabled_tools),
  };
}

export function getEnabledToolNames(toolsState: ToolsState) {
  const tools = [];
  if (toolsState.webSearchEnabled) tools.push("web_search");
  if (toolsState.fileSearchEnabled) tools.push("file_search");
  if (toolsState.functionsEnabled) tools.push("function");
  if (toolsState.codeInterpreterEnabled) tools.push("code_interpreter");
  if (toolsState.mcpEnabled) tools.push("mcp");
  if (toolsState.googleIntegrationEnabled) tools.push("google");
  return tools;
}

export async function getUserQuota(userId: string) {
  const result = await query<QuotaRow>(
    `select daily_request_limit, monthly_request_limit, daily_token_limit, monthly_token_limit, allowed_models, enabled_tools
     from user_quotas
     where user_id = $1`,
    [userId]
  );
  return normalizeQuota(result.rows[0]);
}

export async function setUserQuota(userId: string, quota: QuotaSettings) {
  const result = await query<QuotaRow>(
    `insert into user_quotas (
       user_id,
       daily_request_limit,
       monthly_request_limit,
       daily_token_limit,
       monthly_token_limit,
       allowed_models,
       enabled_tools
     )
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (user_id)
     do update set
       daily_request_limit = excluded.daily_request_limit,
       monthly_request_limit = excluded.monthly_request_limit,
       daily_token_limit = excluded.daily_token_limit,
       monthly_token_limit = excluded.monthly_token_limit,
       allowed_models = excluded.allowed_models,
       enabled_tools = excluded.enabled_tools,
       updated_at = now()
     returning daily_request_limit, monthly_request_limit, daily_token_limit, monthly_token_limit, allowed_models, enabled_tools`,
    [
      userId,
      quota.daily_request_limit,
      quota.monthly_request_limit,
      quota.daily_token_limit,
      quota.monthly_token_limit,
      quota.allowed_models ? JSON.stringify(quota.allowed_models) : null,
      quota.enabled_tools ? JSON.stringify(quota.enabled_tools) : null,
    ]
  );
  return normalizeQuota(result.rows[0]);
}

export async function getUserUsage(userId: string) {
  const result = await query<UsageRow>(
    `select
       coalesce(sum(request_count) filter (where created_at >= date_trunc('day', now())), 0)::text as daily_requests,
       coalesce(sum(request_count) filter (where created_at >= date_trunc('month', now())), 0)::text as monthly_requests,
       coalesce(sum(total_tokens) filter (where created_at >= date_trunc('day', now())), 0)::text as daily_tokens,
       coalesce(sum(total_tokens) filter (where created_at >= date_trunc('month', now())), 0)::text as monthly_tokens
     from usage_events
     where user_id = $1`,
    [userId]
  );
  const usage = result.rows[0];
  return {
    dailyRequests: Number(usage?.daily_requests ?? 0),
    monthlyRequests: Number(usage?.monthly_requests ?? 0),
    dailyTokens: Number(usage?.daily_tokens ?? 0),
    monthlyTokens: Number(usage?.monthly_tokens ?? 0),
  };
}

export async function assertWithinQuota({
  userId,
  model,
  toolsState,
}: {
  userId: string;
  model: string;
  toolsState: ToolsState;
}) {
  const quota = await getUserQuota(userId);
  const usage = await getUserUsage(userId);

  if (
    quota.daily_request_limit != null &&
    usage.dailyRequests >= quota.daily_request_limit
  ) {
    throw new Response(JSON.stringify({ error: "Daily request limit exceeded" }), {
      status: 429,
    });
  }
  if (
    quota.monthly_request_limit != null &&
    usage.monthlyRequests >= quota.monthly_request_limit
  ) {
    throw new Response(JSON.stringify({ error: "Monthly request limit exceeded" }), {
      status: 429,
    });
  }
  if (quota.allowed_models?.length && !quota.allowed_models.includes(model)) {
    throw new Response(JSON.stringify({ error: "Model is not allowed" }), {
      status: 403,
    });
  }
  if (quota.enabled_tools?.length) {
    const enabledTools = getEnabledToolNames(toolsState);
    const disallowedTool = enabledTools.find(
      (tool) => !quota.enabled_tools?.includes(tool)
    );
    if (disallowedTool) {
      throw new Response(
        JSON.stringify({ error: `Tool is not allowed: ${disallowedTool}` }),
        { status: 403 }
      );
    }
  }
}

export async function recordRequestUsage({
  userId,
  conversationId,
  model,
}: {
  userId: string;
  conversationId: string;
  model: string;
}) {
  await query(
    `insert into usage_events (user_id, conversation_id, model, request_count)
     values ($1, $2, $3, 1)`,
    [userId, conversationId, model]
  );
}
