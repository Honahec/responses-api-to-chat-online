"use client";

import Link from "next/link";
import React from "react";

type User = {
  id: string;
  email: string | null;
  name: string | null;
  role: "admin" | "user";
  groups: string[];
  enabled: boolean;
  created_at: string;
};

type Quota = {
  daily_request_limit: number | null;
  monthly_request_limit: number | null;
  daily_token_limit: number | null;
  monthly_token_limit: number | null;
  allowed_models: string[] | null;
  enabled_tools: string[] | null;
};

type Usage = {
  dailyRequests: number;
  monthlyRequests: number;
  dailyTokens: number;
  monthlyTokens: number;
};

const emptyQuota: Quota = {
  daily_request_limit: null,
  monthly_request_limit: null,
  daily_token_limit: null,
  monthly_token_limit: null,
  allowed_models: null,
  enabled_tools: null,
};

const toCsv = (value: string[] | null) => value?.join(", ") ?? "";
const fromCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const numberOrNull = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function AdminPage() {
  const [me, setMe] = React.useState<{ role?: string } | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [quota, setQuota] = React.useState<Quota>(emptyQuota);
  const [usage, setUsage] = React.useState<Usage | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  const loadUsers = React.useCallback(async () => {
    const response = await fetch("/api/admin/users");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load users");
    setUsers(payload.users || []);
    setSelectedUserId((current) => current ?? payload.users?.[0]?.id ?? null);
  }, []);

  React.useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const meResponse = await fetch("/api/auth/me");
        const mePayload = await meResponse.json();
        setMe(mePayload.user);
        if (mePayload.user?.role === "admin") {
          await loadUsers();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load admin page");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [loadUsers]);

  React.useEffect(() => {
    if (!selectedUserId) return;

    fetch(`/api/admin/users/${selectedUserId}/quotas`)
      .then((response) => response.json())
      .then((payload) => {
        setQuota(payload.quota || emptyQuota);
        setUsage(payload.usage || null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load quota")
      );
  }, [selectedUserId]);

  const toggleEnabled = async (user: User) => {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !user.enabled }),
    });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error || "Failed to update user");
      return;
    }
    await loadUsers();
  };

  const saveQuota = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUserId) return;

    const formData = new FormData(event.currentTarget);
    const payload = {
      daily_request_limit: numberOrNull(formData.get("daily_request_limit")),
      monthly_request_limit: numberOrNull(formData.get("monthly_request_limit")),
      daily_token_limit: numberOrNull(formData.get("daily_token_limit")),
      monthly_token_limit: numberOrNull(formData.get("monthly_token_limit")),
      allowed_models: fromCsv(String(formData.get("allowed_models") || "")),
      enabled_tools: fromCsv(String(formData.get("enabled_tools") || "")),
    };

    const response = await fetch(`/api/admin/users/${selectedUserId}/quotas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Failed to save quota");
      return;
    }
    setQuota(result.quota);
  };

  if (isLoading) {
    return <div className="p-8 text-sm text-stone-500">Loading...</div>;
  }

  if (me?.role !== "admin") {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Forbidden</h1>
        <p className="mt-2 text-sm text-stone-500">
          Admin access requires the PocketID `superadmin` group.
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-950">Admin</h1>
          <p className="text-sm text-stone-500">Users, quotas, and usage</p>
        </div>
        <Link href="/" className="text-sm text-stone-600 hover:text-stone-950">
          Back to chat
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section>
          <h2 className="mb-3 text-sm font-medium text-stone-950">Users</h2>
          <div className="overflow-x-auto border border-stone-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Groups</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={`border-t border-stone-200 ${
                      selectedUserId === user.id ? "bg-stone-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <button
                        className="text-left"
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        <div className="font-medium text-stone-950">
                          {user.name || user.email || user.id}
                        </div>
                        <div className="text-xs text-stone-500">{user.email}</div>
                      </button>
                    </td>
                    <td className="px-3 py-2">{user.role}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-xs text-stone-500">
                      {user.groups?.join(", ")}
                    </td>
                    <td className="px-3 py-2">
                      {user.enabled ? "Enabled" : "Disabled"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="rounded-md border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50"
                        onClick={() => toggleEnabled(user)}
                      >
                        {user.enabled ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-stone-950">Quota</h2>
          {selectedUser ? (
            <form onSubmit={saveQuota} className="space-y-4">
              <div className="text-sm">
                <div className="font-medium text-stone-950">
                  {selectedUser.name || selectedUser.email || selectedUser.id}
                </div>
                <div className="text-xs text-stone-500">{selectedUser.id}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-stone-500">
                  Daily requests
                  <input
                    name="daily_request_limit"
                    type="number"
                    defaultValue={quota.daily_request_limit ?? ""}
                    className="mt-1 h-9 w-full rounded-md border border-stone-200 px-2 text-sm"
                  />
                </label>
                <label className="text-xs text-stone-500">
                  Monthly requests
                  <input
                    name="monthly_request_limit"
                    type="number"
                    defaultValue={quota.monthly_request_limit ?? ""}
                    className="mt-1 h-9 w-full rounded-md border border-stone-200 px-2 text-sm"
                  />
                </label>
                <label className="text-xs text-stone-500">
                  Daily tokens
                  <input
                    name="daily_token_limit"
                    type="number"
                    defaultValue={quota.daily_token_limit ?? ""}
                    className="mt-1 h-9 w-full rounded-md border border-stone-200 px-2 text-sm"
                  />
                </label>
                <label className="text-xs text-stone-500">
                  Monthly tokens
                  <input
                    name="monthly_token_limit"
                    type="number"
                    defaultValue={quota.monthly_token_limit ?? ""}
                    className="mt-1 h-9 w-full rounded-md border border-stone-200 px-2 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs text-stone-500">
                Allowed models
                <input
                  name="allowed_models"
                  defaultValue={toCsv(quota.allowed_models)}
                  placeholder="gpt-4.1, gpt-5.2"
                  className="mt-1 h-9 w-full rounded-md border border-stone-200 px-2 text-sm"
                />
              </label>

              <label className="block text-xs text-stone-500">
                Enabled tools
                <input
                  name="enabled_tools"
                  defaultValue={toCsv(quota.enabled_tools)}
                  placeholder="web_search, file_search, function"
                  className="mt-1 h-9 w-full rounded-md border border-stone-200 px-2 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-3 border-t border-stone-200 pt-4 text-sm">
                <div>
                  <div className="text-xs text-stone-500">Daily requests</div>
                  <div>{usage?.dailyRequests ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-stone-500">Monthly requests</div>
                  <div>{usage?.monthlyRequests ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-stone-500">Daily tokens</div>
                  <div>{usage?.dailyTokens ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-stone-500">Monthly tokens</div>
                  <div>{usage?.monthlyTokens ?? 0}</div>
                </div>
              </div>

              <button className="h-9 rounded-md bg-black px-4 text-sm font-medium text-white hover:opacity-80">
                Save quota
              </button>
            </form>
          ) : (
            <p className="text-sm text-stone-500">Select a user.</p>
          )}
        </section>
      </div>
    </main>
  );
}
