import OpenAI from "openai";
import { VSMART_SYSTEM_INSTRUCTION } from "../src/lib/constants";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
let openai: OpenAI | null = null;

if (OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!openai) {
      return res.status(500).json({ error: 'OpenAI API Key is not configured on the server. Please set OPENAI_API_KEY in environment variables.' });
    }

    const { message, history, context } = req.body;
    
    const prompt = context 
      ? `Context from Knowledge Base/History:\n${context}\n\nUser Query: ${message}`
      : message;

    // Convert Gemini history format to OpenAI format
    // Gemini: { role: 'user' | 'model', parts: [{ text: string }] }
    // OpenAI: { role: 'user' | 'assistant' | 'system', content: string }
    const messages: any[] = [
      { role: "system", content: VSMART_SYSTEM_INSTRUCTION },
    ];

    if (history && history.length > 0) {
      history.forEach((h: any) => {
        messages.push({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.parts[0].text
        });
      });
    }

    messages.push({ role: "user", content: prompt });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
    });

    return res.status(200).json({ text: response.choices[0].message.content });
  } catch (error: any) {
    console.error("OpenAI API Error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate AI response" });
  }
}
