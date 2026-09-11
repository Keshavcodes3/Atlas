import { MistralAI } from "@langchain/mistralai"
import { env } from "../../../Config/config.js"
 const mistralLLM = new MistralAI({
  apiKey:env.MISTRAL_API_KEY,
  model: "mistral-small",
  temperature: 0,
  maxTokens: undefined,
  maxRetries: 2,
})


export default mistralLLM
