import * as dotenv from "dotenv"
dotenv.config()

interface envSchema{
    MISTRAL_API_KEY:string,
    GEMNI_API_KEY:string,
    GROQ_API_KEY:string
}


export const env:envSchema={
    MISTRAL_API_KEY:process.env.MISTRAL_API_KEY!,
    GEMNI_API_KEY:process.env.GEMNI_API_KEY!,
    GROQ_API_KEY:process.env.GROQ_API_KEY!
}
