"use client";

import React from "react";

type AuthResponse = {
  authenticated: boolean;
  oidcConfigured: boolean;
  user?: {
    email?: string | null;
    name?: string | null;
    role?: string;
  } | null;
};

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = React.useState<AuthResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((payload) => setAuth(payload))
      .catch(() =>
        setAuth({
          authenticated: false,
          oidcConfigured: false,
          user: null,
        })
      )
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-sm text-stone-500">
        Loading...
      </div>
    );
  }

  if (!auth?.oidcConfigured) {
    return (
      <div className="flex h-screen items-center justify-center bg-white px-6 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-medium text-stone-950">OIDC is not configured</h1>
          <p className="text-sm text-stone-500">
            Configure PocketID OIDC environment variables before using this service.
          </p>
        </div>
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-white px-6 text-center">
        <div className="max-w-md space-y-4">
          <div>
            <h1 className="text-lg font-medium text-stone-950">Sign in required</h1>
            <p className="mt-2 text-sm text-stone-500">
              Use your PocketID account to access the chat service.
            </p>
          </div>
          <a
            href="/api/auth/login"
            className="inline-flex h-9 items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white hover:opacity-80"
          >
            Sign in with PocketID
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
