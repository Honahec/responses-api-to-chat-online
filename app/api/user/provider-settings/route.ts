import { requireUser } from "@/lib/auth";
import {
  getProviderSettings,
  upsertProviderSettings,
} from "@/lib/provider-settings";

export async function GET() {
  try {
    const user = await requireUser();
    const settings = await getProviderSettings(user.id);
    return Response.json({ settings });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching provider settings:", error);
    return Response.json({ error: "Failed to fetch provider settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const settings = await upsertProviderSettings({
      userId: user.id,
      baseURL: body.base_url,
      apiKey: body.api_key,
      defaultModel: body.default_model,
    });
    return Response.json({ settings });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error saving provider settings:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save provider settings" },
      { status: 400 }
    );
  }
}

