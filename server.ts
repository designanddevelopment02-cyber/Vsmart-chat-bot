import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { VSMART_SYSTEM_INSTRUCTION } from "./src/lib/constants";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini Setup
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

  app.post("/api/chat", async (req, res) => {
    try {
      if (!genAI) {
        return res.status(500).json({ error: "Gemini API Key is not configured on the server." });
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

      res.json({ text: response.text });
    } catch (error) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "Failed to generate AI response" });
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
