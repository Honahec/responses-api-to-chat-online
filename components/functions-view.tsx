"use client";

import { Code } from "lucide-react";
import React from "react";
import { Switch } from "@/components/ui/switch";

type UserFunction = {
  id: string;
  name: string;
  description: string;
  parameters_schema: {
    properties?: Record<string, { type?: string }>;
  };
  enabled: boolean;
};

const getToolArgs = (parameters?: Record<string, { type?: string }>) => {
  if (!parameters || Object.keys(parameters).length === 0) return null;
  return (
    <div className="ml-4">
      {Object.entries(parameters).map(([key, value]) => (
        <div key={key} className="my-1 flex items-center space-x-2 text-xs">
          <span className="text-blue-500">{key}:</span>
          <span className="text-zinc-400">{value?.type}</span>
        </div>
      ))}
    </div>
  );
};

export default function FunctionsView() {
  const [functions, setFunctions] = React.useState<UserFunction[]>([]);

  const loadFunctions = React.useCallback(async () => {
    const response = await fetch("/api/user/functions");
    if (!response.ok) return;
    const payload = await response.json();
    setFunctions(payload.functions || []);
  }, []);

  React.useEffect(() => {
    loadFunctions().catch((error) => {
      console.error("Error loading functions:", error);
    });
  }, [loadFunctions]);

  const setEnabled = async (fn: UserFunction, enabled: boolean) => {
    setFunctions((items) =>
      items.map((item) => (item.id === fn.id ? { ...item, enabled } : item))
    );
    const response = await fetch(`/api/user/functions/${fn.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) {
      await loadFunctions();
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {functions.map((tool) => (
        <div key={tool.id} className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <div className="rounded-md bg-blue-100 p-1 text-blue-500">
              <Code size={16} />
            </div>
            <div className="mt-0.5 min-w-0 text-sm font-mono text-zinc-800">
              {tool.name}(
              {getToolArgs(tool.parameters_schema?.properties)}
              )
            </div>
          </div>
          <Switch
            checked={tool.enabled}
            onCheckedChange={(checked) => setEnabled(tool, checked)}
          />
        </div>
      ))}
    </div>
  );
}
