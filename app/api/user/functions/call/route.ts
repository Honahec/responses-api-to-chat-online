import { requireUser } from "@/lib/auth";
import { executeUserFunction } from "@/lib/functions-execution";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const output = await executeUserFunction({
      userId: user.id,
      name: body.name,
      parameters: body.parameters ?? {},
    });
    return Response.json({ output });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error calling user function:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Function call failed" },
      { status: 400 }
    );
  }
}
