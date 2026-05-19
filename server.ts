import express from "express";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";
import { VSMART_SYSTEM_INSTRUCTION } from "./src/lib/constants";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // OpenAI Setup
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  let openai: OpenAI | null = null;

  if (OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
  }

  app.post("/api/chat", async (req, res) => {
    try {
      if (!openai) {
        return res.status(500).json({ error: "OpenAI API Key is not configured on the server. Please add OPENAI_API_KEY to your environment variables." });
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
        model: "gpt-4o", // or "gpt-4-turbo" etc.
        messages: messages,
      });

      res.json({ text: response.choices[0].message.content });
    } catch (error: any) {
      console.error("OpenAI API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI response" });
    }
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to load Vite middleware:", e);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
