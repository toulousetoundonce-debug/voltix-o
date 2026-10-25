"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Activity, Factory, Home, Play, X, Zap } from "lucide-react";

const SmartTableauSimulator = dynamic(() => import("./SmartTableauSimulator"), {
  loading: () => (
    <div className="flex min-h-48 items-center justify-center rounded-xl border border-white/10 bg-slate-950 text-sm font-bold text-cyan-200">
      جارٍ تجهيز المحاكي التفاعلي...
    </div>
  ),
});

export default function SmartTableauSimulatorLauncher() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section id="control-center" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-[#080e19] shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_35%,rgba(34,211,238,0.14),transparent_42%),linear-gradient(115deg,transparent_35%,rgba(16,185,129,0.06)_100%)]"
        />

        {!isOpen ? (
          <div className="grid items-center gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_0.9fr] lg:gap-12 lg:p-12">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3.5 py-1.5 text-xs font-extrabold text-emerald-300">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                مختبر Voltix التفاعلي
              </p>

              <h2 className="mt-5 max-w-2xl text-2xl font-black leading-tight text-white sm:text-3xl lg:text-4xl">
                اكتشف ما يحدث خلف لوحة التحكم
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                جرّب بنفسك كيف تتفاعل أنظمة المنزل الذكي والمصنع مع الطاقة الشمسية والأحمال والأعطال، داخل محاكاة تعليمية تفاعلية.
              </p>

              <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">تحكم بالأحمال والقواطع</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">محاكاة الطاقة والطوارئ</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">منزل ذكي ومصنع</span>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(true)}
                aria-expanded={false}
                className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-xl bg-gradient-to-l from-cyan-300 to-emerald-300 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_0_36px_rgba(34,211,238,0.34)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/10">
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                </span>
                افتح المحاكي التفاعلي
              </button>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-5 rounded-[2rem] bg-cyan-400/[0.07] blur-2xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#060b13]/90 p-4 shadow-2xl sm:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-300">
                      <Activity className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-white">معاينة المحاكي</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">نظرة على الأنظمة المتاحة</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-slate-400">تفاعلي</span>
                </div>

                <div className="relative mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.055] p-3.5 sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-white">المنزل الذكي</span>
                      <Home className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-slate-400">طاقة شمسية · بطارية · دوائر المنزل</p>
                    <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                      <span className="h-px flex-1 bg-gradient-to-l from-cyan-300/70 to-cyan-300/10" />
                      <Zap className="h-3.5 w-3.5 text-cyan-300" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.045] p-3.5 sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-white">المصنع الذكي</span>
                      <Factory className="h-4 w-4 text-amber-300" aria-hidden="true" />
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-slate-400">لوحة MCC · محركات · أحمال صناعية</p>
                    <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                      <span className="h-px flex-1 bg-gradient-to-l from-amber-300/70 to-amber-300/10" />
                      <Activity className="h-3.5 w-3.5 text-amber-300" />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                    <span className="text-xs font-bold text-slate-300">سيناريوهات طاقة وحماية قابلة للتجربة</span>
                  </div>
                  <span className="shrink-0 text-[10px] font-mono text-slate-500">HOME ⇄ MCC</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-extrabold text-emerald-300">مختبر Voltix التفاعلي</p>
                <h2 className="mt-1 text-lg font-black text-white sm:text-xl">محاكي المنزل والمصنع الذكي</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-expanded={true}
                aria-label="إغلاق المحاكي والعودة إلى المعاينة"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                إخفاء المحاكي
              </button>
            </div>
            <SmartTableauSimulator />
          </div>
        )}
      </div>
    </section>
  );
}
