import { ApiError } from "../http/errors";
import { safeLogError } from "../http/safeLogError";
import { getEmailTransport } from "./email.transport";

export async function sendRegistrationCodeEmail(email: string, code: string): Promise<void> {
  try {
    await getEmailTransport().sendRegistrationCode(email, code);
  } catch (error) {
    safeLogError("Failed to send registration verification email", error);
    throw new ApiError(
      502,
      "EMAIL_DELIVERY_FAILED",
      "Unable to send verification email. Please try again later.",
    );
  }
}

export async function sendAccountDeletionCodeEmail(email: string, code: string): Promise<void> {
  try {
    await getEmailTransport().sendAccountDeletionCode(email, code);
  } catch (error) {
    safeLogError("Failed to send account deletion verification email", error);
    throw new ApiError(
      502,
      "EMAIL_DELIVERY_FAILED",
      "Unable to send verification email. Please try again later.",
    );
  }
}

export async function sendAccountDeletedConfirmationEmail(email: string): Promise<void> {
  try {
    await getEmailTransport().sendAccountDeletedConfirmation(email);
  } catch (error) {
    // The account is already deleted; a failed confirmation email must not
    // fail the deletion request.
    safeLogError("Failed to send account deletion confirmation email", error);
  }
}
