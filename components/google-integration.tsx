"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import useToolsStore from "@/stores/useToolsStore";
import { Check, Unplug } from "lucide-react";

export default function GoogleIntegrationPanel() {
  const [connected, setConnected] = useState<boolean>(false);
  const [oauthConfigured, setOauthConfigured] = useState<boolean>(false);
  const googleIntegrationEnabled = useToolsStore(
    (s) => s.googleIntegrationEnabled
  );

  useEffect(() => {
    fetch("/api/google/status")
      .then((r) => r.json())
      .then((d) => {
        setConnected(Boolean(d.connected));
        setOauthConfigured(Boolean(d.oauthConfigured));
      })
      .catch(() => {
        setConnected(false);
        setOauthConfigured(false);
      });
  }, []);

  const disconnect = async () => {
    const response = await fetch("/api/google/status", { method: "DELETE" });
    if (response.ok) {
      setConnected(false);
    }
  };

  return (
    <div className="space-y-4">
      {!connected ? (
        <div className="space-y-2">
          {oauthConfigured ? (
            googleIntegrationEnabled ? (
              <a href="/api/google/auth">
                <Button>Connect Google Integration</Button>
              </a>
            ) : (
              <span className="inline-flex">
                <Button disabled>Connect Google Integration</Button>
              </span>
            )
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button disabled>Connect Google Integration</Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and
                    GOOGLE_REDIRECT_URI must be set in .env.local to use the
                    Google Integration.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-lg shadow-sm border p-3 bg-white">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 text-blue-500 rounded-md p-1">
                <Check size={16} />
              </div>
              <p className="text-sm text-zinc-800">Google OAuth set up</p>
            </div>
            <button
              className="text-zinc-400 transition-colors hover:text-zinc-700"
              onClick={disconnect}
              title="Disconnect"
            >
              <Unplug size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
