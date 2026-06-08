import OpenAI from "openai";

const getOpenAIBaseURL = () => {
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  return baseURL ? baseURL.replace(/\/+$/, "") : undefined;
};

export const createOpenAIClient = () =>
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: getOpenAIBaseURL(),
  });

export const getOpenAIAPIBaseURL = () =>
  getOpenAIBaseURL() ?? "https://api.openai.com/v1";
