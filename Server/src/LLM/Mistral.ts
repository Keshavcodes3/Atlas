import { MistralAI } from "@langchain/mistralai";

let cached: MistralAI | null = null;

export function getMistralLLM(): MistralAI {
  if (cached) {
    return cached;
  }

  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is not defined");
  }

  cached = new MistralAI({
    apiKey,
    model: "mistral-small",
    temperature: 0,
  });

  return cached;
}

export default getMistralLLM;
