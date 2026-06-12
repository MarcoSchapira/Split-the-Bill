import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { prismaAdmin } from "../db/prisma";
import { sendRegistrationCodeEmail } from "../email/email.service";
import { ApiError } from "../http/errors";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_EMAIL_PER_HOUR = 3;
const ONE_HOUR_MS = 60 * 60 * 1000;

function verificationPepper(): string {
  return process.env.JWT_SECRET ?? "dev_secret_change_later";
}

function hashVerificationCode(email: string, code: string): string {
  return createHmac("sha256", verificationPepper())
    .update(`${email}:${code}`)
    .digest("hex");
}

function codesMatch(expectedHash: string, actualHash: string): boolean {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

function generateVerificationCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function sendRegistrationVerificationCode(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();

  const existingUser = await prismaAdmin.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "Email is already registered");
  }

  const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);
  const recentSends = await prismaAdmin.emailVerification.count({
    where: {
      email: normalizedEmail,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentSends >= MAX_SENDS_PER_EMAIL_PER_HOUR) {
    throw new ApiError(
      429,
      "VERIFICATION_SEND_LIMIT_EXCEEDED",
      "Too many verification codes sent to this email. Try again later.",
    );
  }

  const code = generateVerificationCode();
  const codeHash = hashVerificationCode(normalizedEmail, code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  const verification = await prismaAdmin.emailVerification.create({
    data: {
      email: normalizedEmail,
      codeHash,
      expiresAt,
    },
  });

  try {
    await sendRegistrationCodeEmail(normalizedEmail, code);
  } catch (error) {
    await prismaAdmin.emailVerification.delete({ where: { id: verification.id } });
    throw error;
  }
}

export async function verifyRegistrationCode(email: string, code: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const verification = await prismaAdmin.emailVerification.findFirst({
    where: {
      email: normalizedEmail,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verification) {
    throw new ApiError(
      400,
      "VERIFICATION_CODE_INVALID",
      "Verification code is invalid or expired",
    );
  }

  if (verification.attempts >= MAX_ATTEMPTS) {
    throw new ApiError(
      429,
      "VERIFICATION_ATTEMPTS_EXCEEDED",
      "Too many incorrect attempts. Request a new verification code.",
    );
  }

  const expectedHash = hashVerificationCode(normalizedEmail, code);
  const isValid = codesMatch(verification.codeHash, expectedHash);

  if (!isValid) {
    await prismaAdmin.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });

    throw new ApiError(
      400,
      "VERIFICATION_CODE_INVALID",
      "Verification code is invalid or expired",
    );
  }

  await prismaAdmin.emailVerification.deleteMany({
    where: { email: normalizedEmail },
  });
}
