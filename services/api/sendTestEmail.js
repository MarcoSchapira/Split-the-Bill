require("dotenv").config();

async function sendTestEmail() {
  const { Resend } = await import("resend");

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: ["mjschapira@gmail.com"],
    subject: "Resend test email",
    html: "<p>It works. Resend is connected.</p>",
  });

  if (error) {
    console.error("Resend error:", error);
    process.exit(1);
  }

  console.log("Email sent:", data);
}

sendTestEmail();
