import { PoolClient } from "pg";
import { query } from "@/lib/db";

export type UserFile = {
  id: string;
  user_id: string;
  provider_file_id: string;
  filename: string | null;
  purpose: string | null;
  mime_type: string | null;
  size_bytes: string | number | null;
  created_at: string;
};

export type UserVectorStore = {
  id: string;
  user_id: string;
  provider_vector_store_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type UserContainerFile = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  provider_container_id: string | null;
  provider_file_id: string;
  filename: string | null;
  mime_type: string | null;
  created_at: string;
};

type Queryable = {
  query: PoolClient["query"];
};

export async function createUserFile({
  userId,
  providerFileId,
  filename,
  purpose,
  mimeType,
  sizeBytes,
}: {
  userId: string;
  providerFileId: string;
  filename?: string | null;
  purpose?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}) {
  const result = await query<UserFile>(
    `insert into user_files (user_id, provider_file_id, filename, purpose, mime_type, size_bytes)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id, provider_file_id)
     do update set
       filename = coalesce(excluded.filename, user_files.filename),
       purpose = coalesce(excluded.purpose, user_files.purpose),
       mime_type = coalesce(excluded.mime_type, user_files.mime_type),
       size_bytes = coalesce(excluded.size_bytes, user_files.size_bytes)
     returning id, user_id, provider_file_id, filename, purpose, mime_type, size_bytes, created_at`,
    [userId, providerFileId, filename, purpose, mimeType, sizeBytes]
  );
  return result.rows[0];
}

export async function createUserVectorStore({
  userId,
  providerVectorStoreId,
  name,
}: {
  userId: string;
  providerVectorStoreId: string;
  name: string;
}) {
  const result = await query<UserVectorStore>(
    `insert into user_vector_stores (user_id, provider_vector_store_id, name)
     values ($1, $2, $3)
     on conflict (user_id, provider_vector_store_id)
     do update set name = excluded.name, updated_at = now()
     returning id, user_id, provider_vector_store_id, name, created_at, updated_at`,
    [userId, providerVectorStoreId, name]
  );
  return result.rows[0];
}

export async function getUserFile(userId: string, fileId: string) {
  const result = await query<UserFile>(
    `select id, user_id, provider_file_id, filename, purpose, mime_type, size_bytes, created_at
     from user_files
     where user_id = $1 and id = $2`,
    [userId, fileId]
  );
  return result.rows[0] ?? null;
}

export async function getUserVectorStore(
  userId: string,
  vectorStoreId: string
) {
  const result = await query<UserVectorStore>(
    `select id, user_id, provider_vector_store_id, name, created_at, updated_at
     from user_vector_stores
     where user_id = $1 and id = $2`,
    [userId, vectorStoreId]
  );
  return result.rows[0] ?? null;
}

export async function listUserVectorStoreFiles(
  userId: string,
  vectorStoreId: string
) {
  const result = await query<UserFile>(
    `select f.id, f.user_id, f.provider_file_id, f.filename, f.purpose, f.mime_type, f.size_bytes, f.created_at
     from user_vector_store_files vsf
     join user_vector_stores vs on vs.id = vsf.vector_store_id
     join user_files f on f.id = vsf.file_id
     where vs.user_id = $1 and f.user_id = $1 and vs.id = $2
     order by vsf.created_at desc`,
    [userId, vectorStoreId]
  );
  return result.rows;
}

export async function linkUserVectorStoreFile({
  userId,
  vectorStoreId,
  fileId,
}: {
  userId: string;
  vectorStoreId: string;
  fileId: string;
}) {
  const vectorStore = await getUserVectorStore(userId, vectorStoreId);
  const file = await getUserFile(userId, fileId);
  if (!vectorStore || !file) return null;

  await query(
    `insert into user_vector_store_files (vector_store_id, file_id)
     values ($1, $2)
     on conflict do nothing`,
    [vectorStore.id, file.id]
  );
  return { vectorStore, file };
}

function collectContainerFiles(value: unknown, files: Map<string, any>) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectContainerFiles(item, files);
    return;
  }

  const record = value as Record<string, any>;
  const type = record.type;
  const providerFileId = record.file_id ?? record.fileId;
  if (
    typeof providerFileId === "string" &&
    (type === "container_file_citation" ||
      record.container_id ||
      record.containerId)
  ) {
    const providerContainerId = record.container_id ?? record.containerId ?? null;
    files.set(`${providerContainerId ?? ""}:${providerFileId}`, {
      providerContainerId,
      providerFileId,
      filename: record.filename ?? null,
      mimeType: record.mime_type ?? record.mimeType ?? null,
    });
  }

  for (const nested of Object.values(record)) {
    collectContainerFiles(nested, files);
  }
}

export async function registerContainerFilesFromItems({
  client,
  userId,
  conversationId,
  items,
}: {
  client: Queryable;
  userId: string;
  conversationId: string;
  items: unknown[];
}) {
  const files = new Map<string, any>();
  collectContainerFiles(items, files);
  for (const file of files.values()) {
    await client.query(
      `insert into user_container_files (
         user_id,
         conversation_id,
         provider_container_id,
         provider_file_id,
         filename,
         mime_type
       )
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, provider_container_id, provider_file_id)
       do update set
         conversation_id = excluded.conversation_id,
         filename = coalesce(excluded.filename, user_container_files.filename),
         mime_type = coalesce(excluded.mime_type, user_container_files.mime_type)`,
      [
        userId,
        conversationId,
        file.providerContainerId,
        file.providerFileId,
        file.filename,
        file.mimeType,
      ]
    );
  }
}

export async function getUserContainerFile({
  userId,
  providerFileId,
  providerContainerId,
}: {
  userId: string;
  providerFileId: string;
  providerContainerId?: string | null;
}) {
  const result = await query<UserContainerFile>(
    `select id, user_id, conversation_id, provider_container_id, provider_file_id, filename, mime_type, created_at
     from user_container_files
     where user_id = $1
       and provider_file_id = $2
       and provider_container_id is not distinct from $3
     limit 1`,
    [userId, providerFileId, providerContainerId ?? null]
  );
  return result.rows[0] ?? null;
}
