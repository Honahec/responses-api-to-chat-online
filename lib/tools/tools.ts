import { ToolsState, WebSearchConfig } from "@/stores/useToolsStore";
import { getFreshAccessToken } from "@/lib/connectors-auth";
import { getGoogleConnectorTools } from "./connectors";
import { getUserVectorStore } from "@/lib/file-resources";
import {
  getEnabledUserFunctions,
  getUserMcpProfile,
} from "@/lib/user-tools";

interface WebSearchTool extends WebSearchConfig {
  type: "web_search";
}

export const getTools = async (toolsState: ToolsState, userId: string) => {
  const {
    webSearchEnabled,
    fileSearchEnabled,
    functionsEnabled,
    codeInterpreterEnabled,
    vectorStore,
    webSearchConfig,
    mcpEnabled,
    mcpConfig,
    googleIntegrationEnabled,
  } = toolsState;

  const tools = [];

  if (webSearchEnabled) {
    const webSearchTool: WebSearchTool = {
      type: "web_search",
    };
    if (
      webSearchConfig.user_location &&
      (webSearchConfig.user_location.country !== "" ||
        webSearchConfig.user_location.region !== "" ||
        webSearchConfig.user_location.city !== "")
    ) {
      webSearchTool.user_location = webSearchConfig.user_location;
    }

    tools.push(webSearchTool);
  }

  if (fileSearchEnabled && vectorStore?.id) {
    const userVectorStore = await getUserVectorStore(userId, vectorStore.id);
    if (!userVectorStore) {
      throw new Response(JSON.stringify({ error: "Vector store not found" }), {
        status: 404,
      });
    }
    const fileSearchTool = {
      type: "file_search",
      vector_store_ids: [userVectorStore.provider_vector_store_id],
    };
    tools.push(fileSearchTool);
  }

  if (codeInterpreterEnabled) {
    tools.push({ type: "code_interpreter", container: { type: "auto" } });
  }

  if (functionsEnabled) {
    const userFunctions = await getEnabledUserFunctions(userId);
    tools.push(
      ...userFunctions.map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters_schema,
        strict: true,
      }))
    );
  }

  if (mcpEnabled && !mcpConfig.profile_id) {
    throw new Response(JSON.stringify({ error: "MCP profile is not saved" }), {
      status: 400,
    });
  }

  if (mcpEnabled && mcpConfig.profile_id) {
    const profile = await getUserMcpProfile(userId, mcpConfig.profile_id);
    if (!profile) {
      throw new Response(JSON.stringify({ error: "MCP profile not found" }), {
        status: 404,
      });
    }
    const allowedTools = Array.isArray(profile.allowed_tools)
      ? profile.allowed_tools.filter(
          (tool): tool is string => typeof tool === "string"
        )
      : [];
    const mcpTool: any = {
      type: "mcp",
      server_label: profile.server_label,
      server_url: profile.server_url,
    };
    if (profile.approval_policy === "never") {
      mcpTool.require_approval = "never";
    }
    if (allowedTools.length) {
      mcpTool.allowed_tools = allowedTools;
    }
    tools.push(mcpTool);
  }

  if (googleIntegrationEnabled) {
    // Get fresh tokens (refresh if near expiry or missing access token when refresh exists)
    const { accessToken } = await getFreshAccessToken(userId);
    tools.push(...getGoogleConnectorTools(accessToken!));
  }

  return tools;
};
