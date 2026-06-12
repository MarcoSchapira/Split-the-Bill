import { ApiError } from "../http/errors";
import { getEmailTransport } from "./email.transport";

export async function sendRegistrationCodeEmail(email: string, code: string): Promise<void> {
  try {
    await getEmailTransport().sendRegistrationCode(email, code);
  } catch (error) {
    console.error("Failed to send registration verification email:", error);
    throw new ApiError(
      502,
      "EMAIL_DELIVERY_FAILED",
      "Unable to send verification email. Please try again later.",
    );
  }
}
