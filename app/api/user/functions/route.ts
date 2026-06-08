import { requireUser } from "@/lib/auth";
import { listUserFunctions } from "@/lib/user-tools";

export async function GET() {
  try {
    const user = await requireUser();
    const functions = await listUserFunctions(user.id);
    return Response.json({ functions });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error listing user functions:", error);
    return Response.json({ error: "Failed to list functions" }, { status: 500 });
  }
}

