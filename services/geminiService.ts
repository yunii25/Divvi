
import { GoogleGenAI, Type } from "@google/genai";
import { SmartExpenseResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseExpenseWithAI = async (text: string): Promise<SmartExpenseResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse this expense note into structured JSON: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            payerNameHint: { type: Type.STRING, description: "Mentioned name who paid" },
            date: { type: Type.STRING, description: "ISO date format" },
          },
          required: ["description", "amount"],
        },
      },
    });

    return JSON.parse(response.text.trim()) as SmartExpenseResult;
  } catch (error) {
    console.error("Failed to parse expense with AI:", error);
    return null;
  }
};
