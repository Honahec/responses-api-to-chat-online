"use client";

import React from "react";
import { CheckCircle2, KeyRound, PlugZap, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProviderSettingsPayload = {
  base_url: string;
  api_key_fingerprint: string;
  default_model: string | null;
};

export default function ProviderSettings() {
  const [baseURL, setBaseURL] = React.useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = React.useState("");
  const [defaultModel, setDefaultModel] = React.useState("");
  const [fingerprint, setFingerprint] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const loadSettings = React.useCallback(async () => {
    const response = await fetch("/api/user/provider-settings");
    if (!response.ok) return;
    const payload = await response.json();
    const settings = payload.settings as ProviderSettingsPayload | null;
    if (!settings) return;
    setBaseURL(settings.base_url);
    setDefaultModel(settings.default_model ?? "");
    setFingerprint(settings.api_key_fingerprint);
  }, []);

  React.useEffect(() => {
    loadSettings().catch((err) => {
      console.error("Error loading provider settings:", err);
    });
  }, [loadSettings]);

  const saveSettings = async () => {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch("/api/user/provider-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: baseURL,
          api_key: apiKey,
          default_model: defaultModel,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save provider settings");
      }
      setFingerprint(payload.settings?.api_key_fingerprint ?? null);
      setApiKey("");
      setStatus("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const testSettings = async () => {
    setTesting(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch("/api/user/provider-settings/test", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Provider test failed");
      }
      setStatus("Connected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider test failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mb-6 space-y-3 border-b border-stone-200 pb-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-black font-medium">Provider</h1>
          {fingerprint ? (
            <p className="text-xs text-stone-500">Key {fingerprint}</p>
          ) : (
            <p className="text-xs text-stone-500">Not configured</p>
          )}
        </div>
        {fingerprint ? (
          <CheckCircle2 className="size-5 text-emerald-600" />
        ) : (
          <KeyRound className="size-5 text-stone-400" />
        )}
      </div>

      <Input
        value={baseURL}
        onChange={(event) => setBaseURL(event.target.value)}
        placeholder="https://api.openai.com/v1"
      />
      <Input
        value={apiKey}
        onChange={(event) => setApiKey(event.target.value)}
        placeholder={fingerprint ? "New API key" : "API key"}
        type="password"
      />
      <Input
        value={defaultModel}
        onChange={(event) => setDefaultModel(event.target.value.trim())}
        placeholder="Default model"
      />

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="gap-2"
          onClick={saveSettings}
          disabled={saving || !baseURL.trim() || !apiKey.trim()}
        >
          <Save className="size-4" />
          {saving ? "Saving" : "Save"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={testSettings}
          disabled={testing || !fingerprint}
        >
          <PlugZap className="size-4" />
          {testing ? "Testing" : "Test"}
        </Button>
      </div>

      {status && <p className="text-xs text-emerald-700">{status}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

