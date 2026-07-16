export type EmailTransport = {
  sendRegistrationCode(email: string, code: string): Promise<void>;
};

const testCodes = new Map<string, string>();

export function getTestRegistrationCode(email: string): string | undefined {
  return testCodes.get(email.toLowerCase());
}

export function clearTestRegistrationCodes(): void {
  testCodes.clear();
}

export class InMemoryEmailTransport implements EmailTransport {
  async sendRegistrationCode(email: string, code: string): Promise<void> {
    testCodes.set(email.toLowerCase(), code);
  }
}

export class ResendEmailTransport implements EmailTransport {
  async sendRegistrationCode(email: string, code: string): Promise<void> {
    const { getResendClient } = await import("./resend.client");
    const from = process.env.EMAIL_FROM;

    if (!from) {
      throw new Error("EMAIL_FROM is not configured");
    }

    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from,
      to: [email],
      subject: "Your EquiShare verification code",
      html: `
        <p>Your verification code is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
      `,
    });

    if (error) {
      throw error;
    }
  }
}

let transport: EmailTransport | null = null;

export function getEmailTransport(): EmailTransport {
  if (!transport) {
    transport =
      process.env.NODE_ENV === "test"
        ? new InMemoryEmailTransport()
        : new ResendEmailTransport();
  }

  return transport;
}

export function setEmailTransportForTests(nextTransport: EmailTransport): void {
  transport = nextTransport;
}

export function resetEmailTransport(): void {
  transport = null;
}
