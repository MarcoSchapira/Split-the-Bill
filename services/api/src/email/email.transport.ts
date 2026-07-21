export type EmailTransport = {
  sendRegistrationCode(email: string, code: string): Promise<void>;
  sendAccountDeletionCode(email: string, code: string): Promise<void>;
  sendAccountDeletedConfirmation(email: string): Promise<void>;
};

const testCodes = new Map<string, string>();
const testDeletionCodes = new Map<string, string>();
const testDeletionConfirmations = new Set<string>();

export function getTestRegistrationCode(email: string): string | undefined {
  return testCodes.get(email.toLowerCase());
}

export function getTestAccountDeletionCode(email: string): string | undefined {
  return testDeletionCodes.get(email.toLowerCase());
}

export function hasTestAccountDeletedConfirmation(email: string): boolean {
  return testDeletionConfirmations.has(email.toLowerCase());
}

export function clearTestRegistrationCodes(): void {
  testCodes.clear();
  testDeletionCodes.clear();
  testDeletionConfirmations.clear();
}

export class InMemoryEmailTransport implements EmailTransport {
  async sendRegistrationCode(email: string, code: string): Promise<void> {
    testCodes.set(email.toLowerCase(), code);
  }

  async sendAccountDeletionCode(email: string, code: string): Promise<void> {
    testDeletionCodes.set(email.toLowerCase(), code);
  }

  async sendAccountDeletedConfirmation(email: string): Promise<void> {
    testDeletionConfirmations.add(email.toLowerCase());
  }
}

export class ResendEmailTransport implements EmailTransport {
  private async send(email: string, subject: string, html: string): Promise<void> {
    const { getResendClient } = await import("./resend.client");
    const from = process.env.EMAIL_FROM;

    if (!from) {
      throw new Error("EMAIL_FROM is not configured");
    }

    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from,
      to: [email],
      subject,
      html,
    });

    if (error) {
      throw error;
    }
  }

  async sendRegistrationCode(email: string, code: string): Promise<void> {
    await this.send(
      email,
      "Your BillCompass verification code",
      `
        <p>Your verification code is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
      `,
    );
  }

  async sendAccountDeletionCode(email: string, code: string): Promise<void> {
    await this.send(
      email,
      "Your BillCompass account deletion code",
      `
        <p>We received a request to delete your BillCompass account. Your verification code is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>This code expires in 10 minutes. If you did not request account deletion, you can ignore this email and your account will not be affected.</p>
      `,
    );
  }

  async sendAccountDeletedConfirmation(email: string): Promise<void> {
    await this.send(
      email,
      "Your BillCompass account has been deleted",
      `
        <p>Your BillCompass account has been permanently deleted and can no longer be accessed.</p>
        <p>Certain de-identified shared records and temporary backups may remain as described in our <a href="https://split-the-bill.net/privacy">Privacy Policy</a>.</p>
        <p>If you did not request this deletion, contact <a href="mailto:privacy@split-the-bill.net">privacy@split-the-bill.net</a>.</p>
      `,
    );
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
