import { GoogleGenerativeAI } from "@google/generative-ai";
import { ZodError } from "zod";
import { ApiError } from "../http/errors";
import {
  logGeminiParsedReceipt,
  logGeminiRawResponse,
  logParseError,
  logZodFailure,
} from "./receipt.logger";
import { parseGeminiReceiptJson } from "./parse-gemini-json";
import { RECEIPT_PROMPT } from "./receipt.prompt";
import { parsedReceiptSchema, type ParsedReceipt } from "./receipt.types";

const RECEIPT_PARSE_FAILED_MESSAGE =
  "Unable to read receipt. Please retake the photo.";

const RAW_RESPONSE_LOG_LIMIT = 4000;

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
    },
  });
}

export async function parseReceiptWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ParsedReceipt> {
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";

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

    const text = result.response.text();
    logGeminiRawResponse({
      mimeType,
      responseLength: text.length,
      responsePreview:
        text.length > RAW_RESPONSE_LOG_LIMIT
          ? `${text.slice(0, RAW_RESPONSE_LOG_LIMIT)}…`
          : text,
    });

    const parsed = parseGeminiReceiptJson(text);
    const receipt = parsedReceiptSchema.parse(parsed);
    logGeminiParsedReceipt(receipt);
    return receipt;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof ZodError) {
      logZodFailure(
        error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      );
      logParseError("zod_validation", error, { modelName, mimeType });
      throw new ApiError(422, "RECEIPT_PARSE_FAILED", RECEIPT_PARSE_FAILED_MESSAGE);
    }

    if (error instanceof SyntaxError) {
      logParseError("json_parse", error, { modelName, mimeType });
      throw new ApiError(422, "RECEIPT_PARSE_FAILED", RECEIPT_PARSE_FAILED_MESSAGE);
    }

    logParseError("gemini_request", error, { modelName, mimeType });
    throw new ApiError(502, "RECEIPT_PARSE_FAILED", RECEIPT_PARSE_FAILED_MESSAGE);
  }
}
