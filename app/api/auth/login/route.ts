import { NextResponse } from "next/server";
import { buildLoginRedirect } from "@/lib/auth";

export async function GET() {
  try {
    const url = await buildLoginRedirect();
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Error starting OIDC login:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
