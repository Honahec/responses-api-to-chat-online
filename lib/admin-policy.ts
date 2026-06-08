import { query } from "@/lib/db";
import { ToolsState } from "@/stores/useToolsStore";

export type AdminPolicy = {
  allowed_provider_base_urls: string[];
  enabled_tools: string[];
  file_upload_max_bytes: number | null;
  mcp_enabled: boolean;
  custom_functions_enabled: boolean;
  code_interpreter_enabled: boolean;
  connectors_enabled: string[];
};

const defaultPolicy: AdminPolicy = {
  allowed_provider_base_urls: [],
  enabled_tools: [],
  file_upload_max_bytes: null,
  mcp_enabled: true,
  custom_functions_enabled: true,
  code_interpreter_enabled: true,
  connectors_enabled: ["google"],
};

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function getAdminPolicy(): Promise<AdminPolicy> {
  const result = await query<{ value: any }>(
    "select value from system_settings where key = 'admin_policy'"
  );
  const value = result.rows[0]?.value ?? {};
  return {
    allowed_provider_base_urls:
      toStringArray(value.allowed_provider_base_urls) ||
      defaultPolicy.allowed_provider_base_urls,
    enabled_tools: toStringArray(value.enabled_tools),
    file_upload_max_bytes:
      typeof value.file_upload_max_bytes === "number"
        ? value.file_upload_max_bytes
        : null,
    mcp_enabled:
      typeof value.mcp_enabled === "boolean"
        ? value.mcp_enabled
        : defaultPolicy.mcp_enabled,
    custom_functions_enabled:
      typeof value.custom_functions_enabled === "boolean"
        ? value.custom_functions_enabled
        : defaultPolicy.custom_functions_enabled,
    code_interpreter_enabled:
      typeof value.code_interpreter_enabled === "boolean"
        ? value.code_interpreter_enabled
        : defaultPolicy.code_interpreter_enabled,
    connectors_enabled: value.connectors_enabled
      ? toStringArray(value.connectors_enabled)
      : defaultPolicy.connectors_enabled,
  };
}

export async function assertProviderBaseURLAllowed(baseURL: string) {
  const policy = await getAdminPolicy();
  if (!policy.allowed_provider_base_urls.length) return;
  const normalized = baseURL.replace(/\/+$/, "");
  if (
    !policy.allowed_provider_base_urls.some(
      (allowed) => normalized === allowed.replace(/\/+$/, "")
    )
  ) {
    throw new Error("Provider base URL is not allowed by admin policy");
  }
}

export async function assertToolsAllowedByAdminPolicy(toolsState: ToolsState) {
  const policy = await getAdminPolicy();
  const enabledToolSet = new Set(policy.enabled_tools);
  const checkTool = (enabled: boolean, name: string) => {
    if (enabled && enabledToolSet.size && !enabledToolSet.has(name)) {
      throw new Response(JSON.stringify({ error: `Tool is disabled: ${name}` }), {
        status: 403,
      });
    }
  };

  checkTool(toolsState.webSearchEnabled, "web_search");
  checkTool(toolsState.fileSearchEnabled, "file_search");
  checkTool(toolsState.functionsEnabled, "function");
  checkTool(toolsState.codeInterpreterEnabled, "code_interpreter");
  checkTool(toolsState.mcpEnabled, "mcp");
  checkTool(toolsState.googleIntegrationEnabled, "google");

  if (toolsState.mcpEnabled && !policy.mcp_enabled) {
    throw new Response(JSON.stringify({ error: "MCP is disabled" }), {
      status: 403,
    });
  }
  if (toolsState.functionsEnabled && !policy.custom_functions_enabled) {
    throw new Response(JSON.stringify({ error: "Functions are disabled" }), {
      status: 403,
    });
  }
  if (toolsState.codeInterpreterEnabled && !policy.code_interpreter_enabled) {
    throw new Response(JSON.stringify({ error: "Code interpreter is disabled" }), {
      status: 403,
    });
  }
  if (
    toolsState.googleIntegrationEnabled &&
    !policy.connectors_enabled.includes("google")
  ) {
    throw new Response(JSON.stringify({ error: "Google connector is disabled" }), {
      status: 403,
    });
  }
}
