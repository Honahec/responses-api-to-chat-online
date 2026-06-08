import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

declare global {
  var __responsesPgPool: Pool | undefined;
}

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
  });
}

export function getPool() {
  if (process.env.NODE_ENV === "production") {
    return createPool();
  }

  if (!global.__responsesPgPool) {
    global.__responsesPgPool = createPool();
  }

  return global.__responsesPgPool;
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
