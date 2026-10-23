"use client";

import { useState, type FormEvent } from "react";
import { Bot, Calculator, PhoneCall, SendHorizonal, Siren, Sparkles, X } from "lucide-react";
import { postJson } from "@/lib/client";
import { SITE } from "@/lib/site";
import { useSiteActions } from "./SiteActionsProvider";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const GREETING: ChatMessage = {
  role: "assistant",
  content: "مرحباً! أنا مساعد Voltix AI. اسألني عن الخدمات، أو استخدم الحاسبة لتقدير تكلفة مشروعك.",
};

export default function AIFloatingChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackBusy, setCallbackBusy] = useState(false);
  const [callbackMessage, setCallbackMessage] = useState("");
  const { openSos, openCalculator } = useSiteActions();

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const priorMessages = messages.at(-1)?.role === "user" ? messages.slice(0, -1) : messages;
    const userMessage: ChatMessage = { role: "user", content: question };
    const conversation = [...priorMessages, userMessage].slice(-12);

    setMessages(conversation);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const result = await postJson("/api/chat", { messages: conversation });
      if (!result.ok) {
        setError(result.error ?? "تعذّر الاتصال بالمساعد. حاول مرة أخرى.");
        return;
      }

      const answer = result.message?.trim();
      if (!answer) {
        setError("وصل رد غير متوقع من المساعد. حاول مرة أخرى.");
        return;
      }

      setMessages([...conversation, { role: "assistant", content: answer }]);
    } finally {
      setLoading(false);
    }
  };

  const requestCallback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (callbackBusy) return;
    setCallbackBusy(true);
    setCallbackMessage("");
    try {
      const result = await postJson("/api/callback-request", { phone: callbackPhone });
      if (result.ok) {
        setCallbackMessage(result.message ?? "وصل طلبك إلى فريق Voltix.");
        setCallbackPhone("");
      } else {
        setCallbackMessage(result.error ?? "تعذّر إرسال الطلب. تحقق من رقم الهاتف وحاول مجدداً.");
      }
    } finally {
      setCallbackBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={open ? "إغلاق مساعد الذكاء الاصطناعي" : "فتح مساعد الذكاء الاصطناعي"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="chat-launcher fixed bottom-5 left-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-electric-blue to-cyan-300 text-grid-dark transition hover:scale-105"
      >
        {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Bot className="h-6 w-6" aria-hidden="true" />}
      </button>

      {open ? (
        <div
          className="chat-overlay fixed inset-0 z-50 flex items-end justify-end bg-slate-950/25 p-4"
          onClick={() => setOpen(false)}
        >
          <section
            aria-label="محادثة Voltix AI"
            className="chat-panel flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col overflow-hidden rounded-[28px] border border-white/10"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-electric-blue/20 text-electric-blue">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white">مساعد Voltix AI</h2>
                  <p className="text-[11px] text-slate-400">إجابات معلوماتية باللغة العربية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:text-white"
                aria-label="إغلاق المحادثة"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div
              aria-live="polite"
              aria-relevant="additions"
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
            >
              {messages.map((message, index) => (
                <p
                  key={`${message.role}-${index}`}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-7 ${
                    message.role === "user"
                      ? "ml-auto rounded-bl-md bg-electric-blue/20 text-white"
                      : "mr-auto rounded-br-md bg-white/5 text-slate-200"
                  }`}
                >
                  {message.content}
                </p>
              ))}

              {loading ? (
                <p className="mr-auto rounded-2xl rounded-br-md bg-white/5 px-3 py-2 text-sm text-slate-300">
                  جارٍ إعداد الرد...
                </p>
              ) : null}

              {error ? (
                <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 px-4 pb-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openCalculator();
                }}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:border-electric-blue/40"
              >
                <Calculator className="h-4 w-4" aria-hidden="true" />
                حاسبة التكلفة
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openSos();
                }}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-sos-red/30 px-3 py-2 text-xs font-bold text-red-200 hover:bg-sos-red/10"
              >
                <Siren className="h-4 w-4" aria-hidden="true" />
                طوارئ SOS
              </button>
            </div>

            <div className="px-4 pb-3">
              {!callbackOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setCallbackOpen(true);
                    setCallbackMessage("");
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-electric-blue/40 bg-electric-blue/10 px-3 py-2 text-sm font-extrabold text-electric-blue transition hover:bg-electric-blue/20"
                >
                  <PhoneCall className="h-4 w-4" aria-hidden="true" />
                  ⚡ أطلب اتصالاً فورياً من مهندس
                </button>
              ) : (
                <form onSubmit={requestCallback} className="space-y-2 rounded-xl border border-electric-blue/30 bg-electric-blue/5 p-3">
                  <label htmlFor="chat-callback-phone" className="block text-xs font-bold text-slate-200">
                    أدخل رقم هاتفك فقط ليعاود مهندس Voltix الاتصال بك
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="chat-callback-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      dir="ltr"
                      required
                      maxLength={25}
                      value={callbackPhone}
                      onChange={(event) => setCallbackPhone(event.target.value)}
                      placeholder="+213 555 000 000"
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-electric-blue/50 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={callbackBusy || !callbackPhone.trim()}
                      className="min-h-11 rounded-lg bg-electric-blue px-3 py-2 text-xs font-extrabold text-grid-dark disabled:opacity-50"
                    >
                      {callbackBusy ? "جارٍ الإرسال..." : "اطلب الاتصال"}
                    </button>
                  </div>
                  {callbackMessage ? (
                    <div role={callbackMessage.includes("تعذّر") ? "alert" : "status"} className="text-xs leading-relaxed text-slate-200">
                      <p>{callbackMessage}</p>
                      {callbackMessage.includes("تعذّر") && SITE.phoneHref ? (
                        <a href={SITE.phoneHref} className="mt-1 inline-flex min-h-11 items-center font-bold text-electric-blue underline underline-offset-4">
                          اتصل بنا مباشرة
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </form>
              )}
            </div>

            <form onSubmit={sendMessage} className="border-t border-white/10 px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={1}
                  maxLength={1500}
                  placeholder="اكتب سؤالك هنا..."
                  className="max-h-28 min-h-[44px] flex-1 resize-y rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-electric-blue/50 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="إرسال الرسالة"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-electric-blue text-grid-dark shadow-glow-blue transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading || !input.trim()}
                >
                  <SendHorizonal className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
