import axios from "axios";

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

// Normalise SA phone numbers to +27XXXXXXXXX for SMSPortal
function normaliseSAPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("27") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+27${digits.slice(1)}`;
  return phone; // return as-is if already formatted or unrecognised
}

let _smsToken: string | null = null;
let _smsTokenExpiry = 0;

async function getSmsToken(): Promise<string> {
  if (_smsToken && Date.now() < _smsTokenExpiry) return _smsToken;
  const clientId     = process.env.SMSPORTAL_CLIENT_ID!;
  const clientSecret = process.env.SMSPORTAL_CLIENT_SECRET!;
  const authRes = await axios.get("https://rest.smsportal.com/v1/Authentication", {
    auth: { username: clientId, password: clientSecret },
    timeout: 10_000,
  });
  _smsToken = authRes.data.token as string;
  // SMSPortal tokens are valid for 1 hour — cache for 55 min
  _smsTokenExpiry = Date.now() + 55 * 60 * 1000;
  return _smsToken;
}

export async function sendSms(phone: string, message: string): Promise<void> {
  const clientId     = process.env.SMSPORTAL_CLIENT_ID;
  const clientSecret = process.env.SMSPORTAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("SMSPortal env vars not set — skipping SMS to", phone);
    return;
  }
  const destination = normaliseSAPhone(phone);
  try {
    const token = await getSmsToken();
    const res = await axios.post(
      "https://rest.smsportal.com/v1/BulkMessages",
      { messages: [{ content: message, destination }] },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10_000 },
    );
    console.log(`[SMS] Sent via SMSPortal to ${destination}`, res.data?.results?.[0] ?? "");
  } catch (err: any) {
    console.error(`[SMS] SMSPortal failed for ${destination}:`, err?.response?.data ?? err?.message ?? err);
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
