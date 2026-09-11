import { MistralAI } from "@langchain/mistralai";

let cached: MistralAI | null = null;

// Lazy singleton so importing this module never crashes the process
// when MISTRAL_API_KEY is unset; the error surfaces only when the
// LLM is actually requested.
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
