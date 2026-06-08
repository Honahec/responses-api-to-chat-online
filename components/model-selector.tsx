"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import useToolsStore from "@/stores/useToolsStore";
import { Input } from "@/components/ui/input";

type ModelInfo = {
  id: string;
  created?: number;
  owned_by?: string;
};

export default function ModelSelector() {
  const { selectedModel, setSelectedModel } = useToolsStore();
  const [models, setModels] = React.useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadModels = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/models");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to fetch models");
      }
      setModels(payload.models || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch models");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadModels();
  }, [loadModels]);

  const modelIds = new Set(models.map((model) => model.id));
  const selectOptions = selectedModel && !modelIds.has(selectedModel)
    ? [{ id: selectedModel }, ...models]
    : models;

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-black font-medium">Model</h1>
          <p className="text-xs text-stone-500">Responses API model for new turns</p>
        </div>
        <button
          type="button"
          title="Refresh models"
          aria-label="Refresh models"
          onClick={loadModels}
          disabled={isLoading}
          className="flex size-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <select
        value={selectedModel}
        onChange={(event) => setSelectedModel(event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {selectOptions.length === 0 ? (
          <option value={selectedModel}>{selectedModel}</option>
        ) : (
          selectOptions.map((model) => (
            <option key={model.id} value={model.id}>
              {model.id}
            </option>
          ))
        )}
      </select>

      <Input
        value={selectedModel}
        onChange={(event) => setSelectedModel(event.target.value.trim())}
        placeholder="Custom model ID"
      />

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        <p className="text-xs text-stone-500">
          {isLoading ? "Loading models..." : `${models.length} models available`}
        </p>
      )}
    </div>
  );
}
