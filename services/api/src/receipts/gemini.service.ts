import { GoogleGenerativeAI } from "@google/generative-ai";
import { parsedReceiptSchema, type ParsedReceipt } from "./receipt.types";

const RECEIPT_PROMPT =
  "Extract receipt fields as JSON; use null for missing values. [TODO: expand prompt]";

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
  const client = new GoogleGenerativeAI(apiKey);
  return client.getGenerativeModel({ model: modelName });
}

export async function parseReceiptWithGemini(imageBuffer: Buffer, mimeType: string): Promise<ParsedReceipt> {
  const model = getGeminiModel();
  const result = await model.generateContent([
    RECEIPT_PROMPT,
    {
      inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType,
      },
    },
  ]);

  const text = result.response.text().trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Gemini response did not contain JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return parsedReceiptSchema.parse(parsed);
}
