import { GoogleGenAI } from "@google/genai";
import { VSMART_SYSTEM_INSTRUCTION } from "../src/lib/constants";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI: any = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenAI({ 
    apiKey: GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!genAI) {
      return res.status(500).json({ error: 'Gemini API Key is not configured on the server. Please set GEMINI_API_KEY in environment variables.' });
    }

    const { message, history, context } = req.body;
    
    const prompt = context 
      ? `Context from Knowledge Base/History:\n${context}\n\nUser Query: ${message}`
      : message;

    const response = await genAI.models.generateContent({ 
      model: "gemini-2.0-flash",
      config: {
        systemInstruction: VSMART_SYSTEM_INSTRUCTION
      },
      contents: [
        ...(history || []),
        { role: "user", parts: [{ text: prompt }] }
      ]
    });

    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate AI response" });
  }
}
