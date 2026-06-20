import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { api } from "@/lib/api";
import { CheckCircle2, XCircle, AlertTriangle, ScanLine, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/security/")({
  component: SecurityScanner,
});

type ScanResult = Awaited<ReturnType<typeof api.securityScan>>;

function SecurityScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning]   = useState(false);
  const [result, setResult]       = useState<ScanResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [camError, setCamError]   = useState("");
  const [station, setStation]     = useState("");

  const stopScanner = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop().catch(() => {});
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    setResult(null);
    setCamError("");
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    setScanning(true);
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await stopScanner();
          setLoading(true);
          try {
            const res = await api.securityScan(decodedText, station || undefined);
            setResult(res);
          } finally {
            setLoading(false);
          }
        },
        () => { /* ignore QR parse errors */ }
      );
    } catch (err: any) {
      setScanning(false);
      setCamError(err?.message ?? "Camera not available. Check permissions.");
    }
  }, [station, stopScanner]);

  useEffect(() => () => { stopScanner(); }, [stopScanner]);

  const badge = result
    ? result.valid
      ? { bg: "bg-green-50 border-green-300", icon: <CheckCircle2 className="h-10 w-10 text-green-600" />, label: "VALID TICKET", labelCls: "text-green-700" }
      : result.reason === "blacklisted"
        ? { bg: "bg-red-50 border-red-400", icon: <AlertTriangle className="h-10 w-10 text-red-600" />, label: "BLACKLISTED TICKET", labelCls: "text-red-700" }
        : result.reason === "no_rides"
          ? { bg: "bg-orange-50 border-orange-300", icon: <XCircle className="h-10 w-10 text-orange-600" />, label: "NO RIDES REMAINING", labelCls: "text-orange-700" }
          : { bg: "bg-red-50 border-red-300", icon: <XCircle className="h-10 w-10 text-red-600" />, label: result.reason === "expired" ? "EXPIRED TICKET" : result.reason === "used" ? "TICKET ALREADY USED" : "INVALID TICKET", labelCls: "text-red-700" }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-primary" /> Ticket Scanner
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Scan a passenger's QR code to validate their ticket.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">Your Station</label>
        <input
          type="text"
          placeholder="e.g. Cape Town"
          value={station}
          onChange={(e) => setStation(e.target.value)}
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* QR Reader container — always rendered so html5-qrcode can mount into it */}
      <div className="rounded-md border border-border overflow-hidden bg-muted min-h-[260px] flex items-center justify-center">
        <div id="qr-reader" className="w-full" />
        {!scanning && !loading && (
          <div className="absolute flex flex-col items-center gap-2 text-muted-foreground pointer-events-none">
            <ScanLine className="h-12 w-12 opacity-30" />
            <span className="text-sm">Camera preview will appear here</span>
          </div>
        )}
      </div>

      {camError && <p className="text-sm text-destructive">{camError}</p>}

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Validating ticket…
        </div>
      )}

      {result && badge && (
        <div className={`rounded-lg border-2 p-5 ${badge.bg} space-y-3`}>
          <div className="flex flex-col items-center gap-2 text-center">
            {badge.icon}
            <span className={`text-lg font-bold tracking-wide ${badge.labelCls}`}>{badge.label}</span>
          </div>

          {result.ticket && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-3">
              {result.ticket.passenger_name && (
                <>
                  <dt className="text-muted-foreground">Passenger</dt>
                  <dd className="font-medium text-foreground">{result.ticket.passenger_name}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Ticket No</dt>
              <dd className="font-medium text-foreground">{result.ticket.ticket_ref}</dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium text-foreground">{result.ticket.travel_class}</dd>
              <dt className="text-muted-foreground">Route</dt>
              <dd className="font-medium text-foreground">{result.ticket.from_station} → {result.ticket.to_station}</dd>
              <dt className="text-muted-foreground">Departs</dt>
              <dd className="font-medium text-foreground">{result.ticket.departure}</dd>
              {result.ticket.expires_at && (
                <>
                  <dt className="text-muted-foreground">Expires</dt>
                  <dd className="font-medium text-foreground">
                    {(() => {
                      const exp = new Date(result.ticket!.expires_at!);
                      const diff = Math.round((exp.getTime() - Date.now()) / 86_400_000);
                      return diff >= 0 ? `In ${diff} day(s)` : `${Math.abs(diff)} day(s) ago`;
                    })()}
                  </dd>
                </>
              )}
              {result.rides_remaining !== undefined && result.rides_remaining !== null && (
                <>
                  <dt className="text-muted-foreground">Rides Remaining</dt>
                  <dd className="font-medium text-foreground">{result.rides_remaining}</dd>
                </>
              )}
              {result.ticket && (() => {
                const tc = (result.ticket.travel_class ?? "").toLowerCase();
                const isPass = tc.includes("weekly") || tc.includes("monthly");
                return isPass ? (
                  <>
                    <dt className="text-muted-foreground">Pass Type</dt>
                    <dd className="font-medium text-foreground">{result.ticket.travel_class} — unlimited rides until expiry</dd>
                  </>
                ) : null;
              })()}
              <dt className="text-muted-foreground">Status</dt>
              <dd className={`font-bold uppercase ${result.valid ? "text-green-600" : "text-red-600"}`}>
                {result.valid ? "ACTIVE" : result.reason.replace(/_/g, " ")}
              </dd>
            </dl>
          )}

          {result.reason === "blacklisted" && (
            <p className="text-sm text-red-700 font-medium">
              Reason: {result.blacklist_reason ?? "Fraudulent Activity"}
            </p>
          )}
          {result.reason === "no_rides" && (
            <p className="text-sm text-orange-700">Action: Passenger must purchase a new ticket.</p>
          )}
          {result.reason === "expired" && (
            <p className="text-sm text-red-700">Action: Passenger must renew their ticket.</p>
          )}
          {result.reason === "used" && result.used_at && (
            <p className="text-sm text-red-700">
              Used at: {new Date(result.used_at).toLocaleString("en-ZA")}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {!scanning ? (
          <button
            onClick={startScanner}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <ScanLine className="h-4 w-4" />
            {result ? "Scan Next Ticket" : "Start Scanner"}
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="flex flex-1 items-center justify-center gap-2 rounded-sm border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary"
          >
            <RotateCcw className="h-4 w-4" /> Stop Scanner
          </button>
        )}
      </div>
    </div>
  );
}
