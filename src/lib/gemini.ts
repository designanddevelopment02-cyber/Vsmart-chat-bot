let aiInstance: any = null;

// System prompt for the Vsmart Support Assistant
export const VSMART_SYSTEM_INSTRUCTION = `
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
