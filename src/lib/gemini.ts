import { VSMART_SYSTEM_INSTRUCTION as SYSTEM_PROMPT } from "./constants";

// System prompt for the Vsmart Support Assistant
// Note: AI logic is handled server-side to protect API keys.
export const VSMART_SYSTEM_INSTRUCTION = SYSTEM_PROMPT;

export async function getChatResponse(message: string, history: any[] = [], context: string = "") {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, history, context }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch AI response");
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Chat API Error:", error);
    throw error;
  }
}
