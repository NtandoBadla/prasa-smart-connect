import { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";

function verifyToken(token: string): boolean {
  const secret = process.env.ADMIN_JWT_SECRET ?? "prasa-secret-change-me";
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;
  const payload  = token.slice(0, lastDot);
  const sig      = token.slice(lastDot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || !verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
