import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini Setup
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  let genAI: GoogleGenAI | null = null;

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

  const VSMART_SYSTEM_INSTRUCTION = `
You are the official AI Support & Query Resolution Assistant for Vsmart Thermotech Pvt Ltd.

Context: Vsmart Thermotech is a company specializing in thermal engineering, temperature controllers, thermocouples, sensors, industrial automation, Modbus/RS485 communication, PLC integration, and technical hardware/software solutions.

Your Tone: Professional, technical, clear, structured, and solution-oriented.

Your Objective:
1. Understand queries accurately.
2. Search provided knowledge and historical solutions.
3. Provide verified solutions when available.
4. If no exact match, use your technical knowledge but explicitly state it's a general technical recommendation.
5. Escalate to human support if the issue is critical or confidence is low.

Response Format:
1. Problem Understanding
2. Possible Causes
3. Recommended Solution
4. Step-by-Step Guidance
5. Additional Notes
6. Preventive Recommendations
7. Escalation Suggestion (if needed)

You must act as a company-trained expert.
`;

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
        model: "gemini-3-flash-preview",
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
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
