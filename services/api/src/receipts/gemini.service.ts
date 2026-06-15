import { GoogleGenerativeAI, SchemaType, type ObjectSchema } from "@google/generative-ai";
import { ZodError } from "zod";
import { ApiError } from "../http/errors";
import { RECEIPT_PROMPT } from "./receipt.prompt";
import { parsedReceiptSchema, type ParsedReceipt } from "./receipt.types";

const RECEIPT_PARSE_FAILED_MESSAGE =
  "Unable to read receipt. Please retake the photo.";

const receiptResponseSchema: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    store_name: { type: SchemaType.STRING, nullable: true },
    store_address: { type: SchemaType.STRING, nullable: true },
    receipt_number: { type: SchemaType.STRING, nullable: true },
    date: { type: SchemaType.STRING, nullable: true },
    time: { type: SchemaType.STRING, nullable: true },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER },
          unit_price: { type: SchemaType.NUMBER },
          total_price: { type: SchemaType.NUMBER },
        },
        required: ["name", "quantity", "unit_price", "total_price"],
      },
    },
    item_count: { type: SchemaType.NUMBER, nullable: true },
    subtotal: { type: SchemaType.NUMBER, nullable: true },
    tax: { type: SchemaType.NUMBER, nullable: true },
    tip: { type: SchemaType.NUMBER, nullable: true },
    total: { type: SchemaType.NUMBER, nullable: true },
    payment_method: { type: SchemaType.STRING, nullable: true },
    card_last_4: { type: SchemaType.STRING, nullable: true },
  },
  required: [
    "store_name",
    "store_address",
    "receipt_number",
    "date",
    "time",
    "items",
    "item_count",
    "subtotal",
    "tax",
    "tip",
    "total",
    "payment_method",
    "card_last_4",
  ],
};

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ApiError(
      503,
      "GEMINI_NOT_CONFIGURED",
      "Receipt parsing is not configured.",
    );
  }

  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
  const client = new GoogleGenerativeAI(apiKey);
  return client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: receiptResponseSchema,
    },
  });
}

export async function parseReceiptWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ParsedReceipt> {
  try {
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
    const parsed = JSON.parse(text);
    return parsedReceiptSchema.parse(parsed);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof ZodError) {
      throw new ApiError(422, "RECEIPT_PARSE_FAILED", RECEIPT_PARSE_FAILED_MESSAGE);
    }

    if (error instanceof SyntaxError) {
      throw new ApiError(422, "RECEIPT_PARSE_FAILED", RECEIPT_PARSE_FAILED_MESSAGE);
    }

    throw new ApiError(502, "RECEIPT_PARSE_FAILED", RECEIPT_PARSE_FAILED_MESSAGE);
  }
}
