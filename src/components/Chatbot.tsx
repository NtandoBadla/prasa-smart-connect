import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, Mic, MicOff } from "lucide-react";
import { SCHEDULES, ALERTS, searchTrains, STATIONS } from "@/data/prasa";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const GREETING =
  "Hi! I'm your PRASA assistant. Ask me about train schedules, delays, fares or routes — e.g. \"Train from Cape Town to Simon's Town\" or \"Are there delays on the Central Line?\"";

function detectStations(text: string): { from?: string; to?: string } {
  const lower = text.toLowerCase();
  const found = STATIONS.filter((s) => lower.includes(s.toLowerCase()));
  if (found.length === 0) return {};
  // Try "from X to Y" pattern
  const m = lower.match(/from\s+([a-z' ]+?)\s+to\s+([a-z' ]+)/i);
  if (m) {
    const from = STATIONS.find((s) => m[1].toLowerCase().includes(s.toLowerCase()));
    const to = STATIONS.find((s) => m[2].toLowerCase().includes(s.toLowerCase()));
    if (from && to) return { from, to };
  }
  if (found.length >= 2) return { from: found[0], to: found[1] };
  return { from: found[0] };
}

function generateReply(text: string): string {
  const lower = text.toLowerCase();

  // Greetings
  if (/\b(hi|hello|hey|sawubona|molo)\b/.test(lower)) {
    return "Hello! How can I help with your journey today? I can look up trains, delays, fares or service alerts.";
  }

  // Alerts / delays
  if (/(delay|alert|cancel|disruption|status|problem)/.test(lower)) {
    const lineMatch = ["Southern Line", "Northern Line", "Central Line", "Cape Flats Line"].find((l) =>
      lower.includes(l.toLowerCase()),
    );
    const list = lineMatch ? ALERTS.filter((a) => a.line === lineMatch) : ALERTS;
    if (list.length === 0) return `Good news — no active alerts${lineMatch ? ` on the ${lineMatch}` : ""}.`;
    return (
      `Here are the current alerts${lineMatch ? ` for the ${lineMatch}` : ""}:\n\n` +
      list.map((a) => `• **${a.title}** — ${a.message}`).join("\n")
    );
  }

  // Fare
  if (/(fare|cost|price|ticket|how much)/.test(lower)) {
    const { from, to } = detectStations(text);
    if (from && to) {
      const t = searchTrains(from, to)[0];
      if (t) return `A Metro ticket from ${from} to ${to} on the ${t.line} costs **R ${t.fare.toFixed(2)}** (one way).`;
    }
    return "Metro fares depend on the route and class. For example, Cape Town to Simon's Town is R 14.50 (Metro). Tell me your origin and destination for an exact fare.";
  }

  // Schedule / route lookup
  if (/(train|schedule|when|next|depart|arriv|route|trip|from|to)/.test(lower)) {
    const { from, to } = detectStations(text);
    if (from && to) {
      const trains = searchTrains(from, to);
      if (trains.length === 0)
        return `I couldn't find a direct train from ${from} to ${to} in the current timetable. Try a nearby station or check connections via Cape Town.`;
      const top = trains.slice(0, 3);
      return (
        `Here are the next trains from **${from}** to **${to}**:\n\n` +
        top
          .map(
            (t) =>
              `• **${t.departure} → ${t.arrival}** · ${t.line} · Train #${t.trainNo} · Platform ${t.platform} · ${t.status}${
                t.delayMin ? ` (+${t.delayMin}m)` : ""
              } · R ${t.fare.toFixed(2)}`,
          )
          .join("\n")
      );
    }
    if (from && !to) return `Got it — departing from **${from}**. Which station are you travelling to?`;
    return "Sure — which station are you leaving from, and where are you headed?";
  }

  // Stations list
  if (/(station|stop)/.test(lower)) {
    const lines = Array.from(new Set(SCHEDULES.map((s) => s.line)));
    return `PRASA Metrorail Western Cape operates on: ${lines.join(", ")}. Major stations include Cape Town, Bellville, Claremont, Wynberg, Muizenberg, Simon's Town and Khayelitsha.`;
  }

  // Help
  if (/(help|what can you|how to)/.test(lower)) {
    return "I can help with:\n• Train schedules between any two stations\n• Live service alerts and delays\n• Fares for Metro tickets\n• Saving frequent routes\n\nTry: \"Next train from Bellville to Cape Town\".";
  }

  return "I'm focused on PRASA train info. Try asking about a route (e.g. \"Cape Town to Khayelitsha\"), a fare, or current delays.";
}

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", content: GREETING }]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = generateReply(trimmed);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      setTyping(false);
    }, 500 + Math.random() * 400);
  };

  const suggestions = ["Next train Cape Town to Simon's Town", "Any delays today?", "Fare to Bellville"];

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-elevated transition-transform hover:scale-105"
          aria-label="Open assistant"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-warning" />
          </span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[560px] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-md border border-border bg-card shadow-elevated">
          <header className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-destructive">
                <Bot className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">PRASA Assistant</div>
                <div className="text-[11px] opacity-80">Online · usually replies instantly</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 hover:opacity-80">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-secondary/40 p-4">
            {messages.map((m, i) => (
              <Bubble key={i} msg={m} />
            ))}
            {typing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Bot className="h-4 w-4" />
                <span className="flex gap-1">
                  <Dot /><Dot delay={0.15} /><Dot delay={0.3} />
                </span>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 border-t border-border bg-card px-3 py-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground hover:bg-secondary"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <ChatInputBar input={input} setInput={setInput} onSend={send} />
        </div>
      )}
    </>
  );
}

function ChatInputBar({
  input,
  setInput,
  onSend,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setSupported(!!SR);
  }, []);

  const toggleMic = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening && recRef.current) {
      recRef.current.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "en-ZA";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput((finalText + interim).trim());
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) onSend(finalText.trim());
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [listening, onSend, setInput]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend(input);
      }}
      className="flex items-center gap-2 border-t border-border bg-card p-3"
    >
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={listening ? "Listening…" : "Ask about trains, delays, fares…"}
        className="flex-1 rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
      {supported && (
        <button
          type="button"
          onClick={toggleMic}
          className={`flex h-9 w-9 items-center justify-center rounded-sm border transition-colors ${
            listening
              ? "border-destructive bg-destructive text-destructive-foreground animate-pulse"
              : "border-border bg-background text-muted-foreground hover:bg-secondary"
          }`}
          aria-label={listening ? "Stop listening" : "Voice input"}
          title={listening ? "Stop listening" : "Voice input"}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      )}
      <button
        type="submit"
        className="flex h-9 w-9 items-center justify-center rounded-sm bg-destructive text-destructive-foreground hover:opacity-90"
        aria-label="Send"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}

function Bubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={`max-w-[78%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card text-foreground border border-border rounded-bl-sm"
        }`}
      >
        {formatMarkdown(msg.content)}
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function formatMarkdown(text: string) {
  // Lightweight: bold **x** support
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}
