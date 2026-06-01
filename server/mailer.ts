import axios from "axios";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const twilio = _require("twilio") as (accountSid: string, authToken: string) => { messages: { create: (opts: { body: string; from: string; to: string }) => Promise<{ sid: string; status: string }> } };

interface NotifyPayload {
  toEmail: string;
  trainNo: string;
  line: string;
  station: string;
  status: string;
  delayMin: number;
  reason?: string;
  updatedAt: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  templateId?: string;
  templateParams?: Record<string, any>;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = payload.templateId ?? process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.warn("EmailJS env vars not set — skipping email to", payload.to);
    return;
  }

  const templateParams = payload.templateParams || {
    to_email: payload.to,
    subject: payload.subject,
    message: payload.html,
  };

  await axios.post(
    "https://api.emailjs.com/api/v1.0/email/send",
    {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: templateParams,
    },
    { timeout: 8_000 },
  );
}

export async function sendNotification(payload: NotifyPayload): Promise<void> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.warn("EmailJS env vars not set — skipping email to", payload.toEmail);
    return;
  }

  const statusLabel =
    payload.status === "Delayed"
      ? `Delayed by ${payload.delayMin} min`
      : payload.status;

  await axios.post(
    "https://api.emailjs.com/api/v1.0/email/send",
    {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        to_email: payload.toEmail,
        train_no: payload.trainNo,
        line: payload.line,
        station: payload.station,
        status: statusLabel,
        reason: payload.reason ?? "No reason provided",
        updated_at: payload.updatedAt,
      },
    },
    { timeout: 8_000 },
  );
}

export async function sendSms(phone: string, message: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from) {
    console.warn("Twilio env vars not set — skipping SMS to", phone);
    return;
  }
  try {
    const client = twilio(accountSid, authToken);
    const result = await client.messages.create({ body: message, from, to: phone });
    console.log(`[SMS] Sent to ${phone}: sid=${result.sid} status=${result.status}`);
  } catch (err: any) {
    console.error(`[SMS] Failed to send to ${phone}:`, err?.message ?? err);
    throw err;
  }
}

export async function notifySubscribers(
  subscribers: { email: string }[],
  payload: Omit<NotifyPayload, "toEmail">,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subscribers.map(async (sub) => {
      try {
        await sendNotification({ ...payload, toEmail: sub.email });
        sent++;
      } catch (err) {
        console.error(`Failed to notify ${sub.email}:`, (err as Error).message);
        failed++;
      }
    }),
  );

  return { sent, failed };
}
