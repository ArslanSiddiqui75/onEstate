import { shouldUseResendOutbound, emailFromAddress } from "@/lib/email/capabilities";

export async function sendResendEmail(input: {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}): Promise<{ sid: string; status: string; mode: "live" | "simulated" }> {
  if (!shouldUseResendOutbound()) {
    return {
      sid: `sim_email_${Date.now()}`,
      status: "sent",
      mode: "simulated",
    };
  }

  const from = emailFromAddress();
  if (!from) {
    throw new Error("EMAIL_FROM is required for live email");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.body,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };
  if (!res.ok) {
    throw new Error(json.message || `Resend rejected the send (${res.status})`);
  }

  return {
    sid: json.id || `resend_${Date.now()}`,
    status: "sent",
    mode: "live",
  };
}
