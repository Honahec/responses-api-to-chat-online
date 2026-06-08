import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const result = await query(
      `select id, email, name, role, groups, enabled, created_at, updated_at
       from users
       order by created_at desc`
    );
    return NextResponse.json({ users: result.rows });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error listing admin users:", error);
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}
