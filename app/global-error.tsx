"use client";

import { SITE } from "@/lib/site";
import { createWhatsAppHref, WHATSAPP_BUSINESS_NUMBER } from "@/lib/whatsapp";

export default function GlobalErrorPage({ reset }: { reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <main className="max-w-xl rounded-2xl border border-slate-700 bg-slate-900/80 p-8 text-center shadow-2xl shadow-cyan-500/10">
          <p className="mb-3 text-sm font-medium tracking-[0.2em] text-cyan-300">Voltix Dynamics</p>
          <h1 className="text-3xl font-black text-white">فشل تحميل التطبيق</h1>
          <p className="mt-4 text-sm text-slate-300">
            هناك مشكلة في التطبيق. يمكنك المحاولة مرة أخرى أو التواصل مباشرة عبر الاتصال أو واتساب.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-full bg-cyan-400 px-4 py-2 font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              إعادة المحاولة
            </button>
            {SITE.phoneHref ? (
              <a href={SITE.phoneHref} className="rounded-full border border-slate-600 px-4 py-2 font-semibold text-white hover:border-cyan-300">
                الاتصال
              </a>
            ) : null}
            <a
              href={createWhatsAppHref(WHATSAPP_BUSINESS_NUMBER, "مرحباً، أحتاج إلى مساعدة بشأن الموقع.")}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 font-semibold text-emerald-200 hover:bg-emerald-500/20"
            >
              واتساب
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
