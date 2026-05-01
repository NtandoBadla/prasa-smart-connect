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
