import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export interface TicketData {
  ref: string;
  from: string;
  to: string;
  trainNo?: string;
  line?: string;
  departure?: string;
  arrival?: string;
  travelClass: string;
  ticketType?: string;
  fare: number;
  bookedAt: string;
  validDate: string;
}

export async function downloadTicketPDF(ticket: TicketData): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();

  // ── Header bar ────────────────────────────────────────────────────────────
  doc.setFillColor(30, 64, 175); // primary blue
  doc.rect(0, 0, W, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PRASA METRORAIL", 10, 11);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("e-Ticket — Western Cape", 10, 17);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Ref: ${ticket.ref}`, 10, 24);

  // ── QR code ───────────────────────────────────────────────────────────────
  const qrData = [
    `REF:${ticket.ref}`,
    `FROM:${ticket.from}`,
    `TO:${ticket.to}`,
    `FARE:R${ticket.fare.toFixed(2)}`,
    `VALID:${ticket.validDate}`,
  ].join("|");

  const qrDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });
  const qrSize = 38;
  doc.addImage(qrDataUrl, "PNG", W - qrSize - 8, 32, qrSize, qrSize);

  // ── Route ─────────────────────────────────────────────────────────────────
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(ticket.from, 10, 42);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("TO", 10, 49);

  doc.setTextColor(30, 64, 175);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(ticket.to, 10, 58);

  // ── Divider ───────────────────────────────────────────────────────────────
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(10, 75, W - 10, 75);

  // ── Details grid ─────────────────────────────────────────────────────────
  const fields: [string, string][] = [
    ...(ticket.trainNo   ? [["Train No",    `#${ticket.trainNo}`] as [string, string]] : []),
    ...(ticket.line      ? [["Line",         ticket.line]         as [string, string]] : []),
    ...(ticket.departure ? [["Departs",      ticket.departure]    as [string, string]] : []),
    ...(ticket.arrival   ? [["Arrives",      ticket.arrival]      as [string, string]] : []),
    ["Class",        ticket.travelClass],
    ["Ticket Type",  ticket.ticketType ?? "Single"],
    ["Fare",         `R ${ticket.fare.toFixed(2)}`],
    ["Valid",        ticket.validDate],
    ["Booked",       ticket.bookedAt],
  ];

  let y = 83;
  const col1 = 10;
  const col2 = 55;

  fields.forEach(([label, value], i) => {
    if (i % 2 === 0 && i > 0) {
      // light row stripe every two rows
      doc.setFillColor(248, 249, 250);
      doc.rect(8, y - 5, W - 16, 7, "F");
    }
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(label.toUpperCase(), col1, y);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(value, col2, y);

    y += 9;
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFillColor(30, 64, 175);
  doc.rect(0, doc.internal.pageSize.getHeight() - 14, W, 14, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Valid for date of travel only. Present this ticket at the gate.", 10, doc.internal.pageSize.getHeight() - 8);
  doc.text("PRASA Metrorail Western Cape", W - 10, doc.internal.pageSize.getHeight() - 8, { align: "right" });

  doc.save(`PRASA-${ticket.ref}.pdf`);
}
