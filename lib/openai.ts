import OpenAI from "openai";
import { getProviderCredentials } from "@/lib/provider-settings";

export async function createOpenAIClientForUser(userId: string) {
  const settings = await getProviderCredentials(userId);
  return new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL,
  });
}

export async function getOpenAIAPIBaseURLForUser(userId: string) {
  const settings = await getProviderCredentials(userId);
  return settings.baseURL;
}

export async function getDefaultModelForUser(userId: string) {
  const settings = await getProviderCredentials(userId);
  return settings.defaultModel;
}
