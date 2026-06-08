"use client";
import React from "react";
import useToolsStore from "@/stores/useToolsStore";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";

export default function McpConfig() {
  const { mcpConfig, setMcpConfig } = useToolsStore();

  const saveProfile = async (nextConfig = mcpConfig) => {
    setMcpConfig(nextConfig);
    if (!nextConfig.server_label.trim() || !nextConfig.server_url.trim()) {
      return;
    }
    try {
      const response = await fetch("/api/user/mcp-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: nextConfig.profile_id,
          server_label: nextConfig.server_label,
          server_url: nextConfig.server_url,
          allowed_tools: nextConfig.allowed_tools,
          skip_approval: nextConfig.skip_approval,
        }),
      });
      if (!response.ok) return;
      const { profile } = await response.json();
      if (profile?.id && profile.id !== nextConfig.profile_id) {
        setMcpConfig({ ...nextConfig, profile_id: profile.id });
      }
    } catch (error) {
      console.error("Error saving MCP profile:", error);
    }
  };

  const handleClear = () => {
    setMcpConfig({
      profile_id: undefined,
      server_label: "",
      server_url: "",
      allowed_tools: "",
      skip_approval: false,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-zinc-600 text-sm">Server details</div>
        <div
          className="text-zinc-400 text-sm px-1 transition-colors hover:text-zinc-600 cursor-pointer"
          onClick={handleClear}
        >
          Clear
        </div>
      </div>
      <div className="mt-3 space-y-3 text-zinc-400">
        <div className="flex items-center gap-2">
          <label htmlFor="server_label" className="text-sm w-24">
            Label
          </label>
          <Input
            id="server_label"
            type="text"
            placeholder="deepwiki"
            className="bg-white border text-sm flex-1 text-zinc-900 placeholder:text-zinc-400"
            value={mcpConfig.server_label}
            onChange={(e) =>
              setMcpConfig({ ...mcpConfig, server_label: e.target.value })
            }
            onBlur={() => saveProfile()}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="server_url" className="text-sm w-24">
            URL
          </label>
          <Input
            id="server_url"
            type="text"
            placeholder="https://example.com/mcp"
            className="bg-white border text-sm flex-1 text-zinc-900 placeholder:text-zinc-400"
            value={mcpConfig.server_url}
            onChange={(e) =>
              setMcpConfig({ ...mcpConfig, server_url: e.target.value })
            }
            onBlur={() => saveProfile()}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="allowed_tools" className="text-sm w-24">
            Allowed
          </label>
          <Input
            id="allowed_tools"
            type="text"
            placeholder="tool1,tool2"
            className="bg-white border text-sm flex-1 text-zinc-900 placeholder:text-zinc-400"
            value={mcpConfig.allowed_tools}
            onChange={(e) =>
              setMcpConfig({ ...mcpConfig, allowed_tools: e.target.value })
            }
            onBlur={() => saveProfile()}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="skip_approval" className="text-sm w-24">
            Skip approval
          </label>
          <Switch
            id="skip_approval"
            checked={mcpConfig.skip_approval}
            onCheckedChange={(checked) =>
              saveProfile({ ...mcpConfig, skip_approval: checked })
            }
          />
        </div>
      </div>
    </div>
  );
}
