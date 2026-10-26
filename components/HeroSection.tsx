"use client";

import { useState } from "react";
import { ArrowLeft, BarChart3, Clock, Lock, ShieldCheck, Zap } from "lucide-react";
import { useSiteActions } from "./SiteActionsProvider";

export default function HeroSection() {
  const { openSos, openCalculator } = useSiteActions();
  const [standardDetailsOpen, setStandardDetailsOpen] = useState(false);

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-grid-card via-page-bg to-page-bg" />
        <div className="bg-grid-pattern absolute inset-0" />
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-electric-blue/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-electric-blue/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-24 sm:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full border border-electric-blue/30 bg-electric-blue/10 px-4 py-1.5 text-sm font-bold text-electric-blue">
          <span className="h-2 w-2 rounded-full bg-electric-blue" aria-hidden="true" />
          الجيل القادم من الهندسة الكهربائية والأتمتة الذكية
        </p>

        <div className="mx-auto mt-8 max-w-4xl sm:mt-10">
          <h1
            id="hero-title"
            className="font-plex-arabic text-balance text-[2rem] font-bold leading-[1.5] tracking-normal text-white sm:text-5xl sm:leading-[1.35] lg:text-6xl"
          >
            <span className="block">نُهندس الطاقة</span>
            <span className="mt-1 block text-electric-blue sm:mt-2">
              ونُؤتمت المستقبل بثقة.
            </span>
          </h1>
          <div className="mx-auto mt-6 flex max-w-2xl items-stretch gap-3 text-left sm:mt-8 sm:gap-4">
            <span
              aria-hidden="true"
              className="w-px shrink-0 bg-gradient-to-b from-electric-blue/70 via-electric-blue/30 to-transparent"
            />
            <p
              dir="ltr"
              className="font-mono text-[11px] font-medium leading-6 tracking-[0.025em] text-cyan-100/80 sm:text-sm sm:leading-7"
            >
              <span className="block text-balance">
                We engineer energy with precision and automate the future with purpose.
              </span>
              <span className="mt-1 block text-slate-400">
                Where accuracy becomes a methodology, and order leaves its mark.
              </span>
            </p>
          </div>
          <div
            aria-hidden="true"
            className="mx-auto mt-6 h-px w-16 bg-electric-blue/50 sm:mt-7 sm:w-20"
          />
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-loose text-slate-400 sm:text-lg">
          نجمع بين الكهرباء المعمارية والصناعية، والبرمجة والأتمتة، والأمن السيبراني في فريق واحد: تمديدات مطابقة للمعايير،
          لوحات تحكم مصممة بدقة، وأنظمة ذكية تعمل محلياً وتحمي خصوصيتك.
        </p>

        <div className="vx-cta-row">
          <button
            type="button"
            onClick={openSos}
            className="vx-btn vx-sos open-sos-trigger"
          >
            <span className="vx-ico">
              <Zap className="vx-zap" aria-hidden="true" />
            </span>
            <span className="vx-text">
              <span>SOS - تدخل طوارئ فوري</span>
              <small><i className="vx-live" aria-hidden="true" />استجابة 24/7</small>
            </span>
          </button>
          <button
            type="button"
            onClick={openCalculator}
            className="vx-btn vx-calc"
          >
            <span className="vx-ico vx-calc-ico">
              <BarChart3 aria-hidden="true" />
            </span>
            <span className="vx-text">
              <span className="vx-calc-title">احسب تكلفة مشروعك الآن</span>
              <small className="vx-calc-caption">تقدير فوري · 4 خطوات بسيطة</small>
            </span>
            <span className="vx-calc-arrow" aria-hidden="true">
              <ArrowLeft />
            </span>
          </button>
        </div>

        <dl className="mx-auto mt-14 grid max-w-6xl gap-4 text-start sm:grid-cols-2 md:grid-cols-3">
          <div className="group relative h-full overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-900/60 p-5 text-center shadow-[0_20px_40px_-26px_rgba(15,118,110,0.7)] backdrop-blur-md transition duration-300 hover:-translate-y-1.5 hover:border-electric-blue/40 hover:bg-slate-900/75 hover:shadow-[0_22px_50px_-18px_rgba(34,211,238,0.38)] motion-reduce:transform-none motion-reduce:transition-none">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-electric-blue/70 to-transparent opacity-80" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_55%)] opacity-0 transition duration-300 group-hover:opacity-100" aria-hidden="true" />
            <div className="relative z-10">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-electric-blue/20 bg-electric-blue/10 text-electric-blue shadow-[0_0_18px_rgba(34,211,238,0.22)]">
                <ShieldCheck className="h-6 w-6 motion-safe:animate-pulse motion-reduce:animate-none" aria-hidden="true" />
              </div>
              <dt dir="ltr" className="mt-4 text-xl font-black text-white sm:text-2xl">
                NF C 15-100
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-slate-400">
                تمديدات كهربائية تراعي معايير السلامة الفرنسية وتقلل المخاطر التشغيلية.
              </dd>
              <button
                type="button"
                className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-electric-blue/20 bg-electric-blue/5 px-3 text-xs font-bold text-electric-blue transition hover:border-electric-blue/50 hover:bg-electric-blue/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue"
                aria-expanded={standardDetailsOpen}
                aria-controls="nf-standard-detail"
                onClick={() => setStandardDetailsOpen((open) => !open)}
              >
                {standardDetailsOpen ? "إخفاء التفاصيل" : "لماذا هذا المعيار مهم؟"}
                <ArrowLeft className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${standardDetailsOpen ? "-rotate-90" : ""}`} aria-hidden="true" />
              </button>
              <p
                id="nf-standard-detail"
                hidden={!standardDetailsOpen}
                className="mt-3 rounded-2xl border border-white/5 bg-black/20 p-3 text-start text-xs leading-relaxed text-slate-300 shadow-inner shadow-black/20"
              >
                يحدد المعيار قواعد تصميم وتركيب التمديدات الكهربائية في فرنسا، ويساعد الالتزام به على الحد من مخاطر الصعق والحرائق. وتُراجع متطلبات كل مشروع بحسب موقعه وتجهيزاته.
              </p>
            </div>
          </div>

          <div className="group relative h-full overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-900/60 p-5 text-center shadow-[0_20px_40px_-26px_rgba(56,189,248,0.5)] backdrop-blur-md transition duration-300 hover:-translate-y-1.5 hover:border-electric-blue/40 hover:bg-slate-900/75 hover:shadow-[0_22px_50px_-18px_rgba(34,211,238,0.3)] motion-reduce:transform-none motion-reduce:transition-none">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent opacity-80" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_60%)] opacity-0 transition duration-300 group-hover:opacity-100" aria-hidden="true" />
            <div className="relative z-10">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.2)]">
                <Lock className="h-6 w-6 motion-safe:animate-pulse motion-reduce:animate-none" aria-hidden="true" />
              </div>
              <dt className="mt-4 text-2xl font-black text-white">تحكم محلي آمن</dt>
              <dd className="mt-2 text-sm leading-relaxed text-slate-400">
                تحكم بأجهزتك محلياً دون الاعتماد على اتصال الإنترنت أو خدمات خارجية.
              </dd>
              <div className="mt-4 inline-flex min-h-8 items-center gap-2 rounded-full border border-electric-blue/20 bg-electric-blue/5 px-3 text-xs font-bold text-cyan-200">
                <span className="h-1.5 w-1.5 rounded-full bg-electric-blue motion-safe:animate-pulse" aria-hidden="true" />
                تشفير كامل · خصوصيتك أولاً
              </div>
              <p className="mt-3 text-[11px] font-medium tracking-[0.2em] text-slate-500">
                LOCAL-FIRST SECURITY
              </p>
            </div>
          </div>

          <div className="group relative h-full overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-900/60 p-5 text-center shadow-[0_20px_40px_-26px_rgba(251,146,60,0.55)] backdrop-blur-md transition duration-300 hover:-translate-y-1.5 hover:border-orange-400/40 hover:bg-slate-900/75 hover:shadow-[0_22px_50px_-18px_rgba(251,146,60,0.28)] motion-reduce:transform-none motion-reduce:transition-none sm:col-span-2 md:col-span-1">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/70 to-transparent opacity-80" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.12),_transparent_60%)] opacity-0 transition duration-300 group-hover:opacity-100" aria-hidden="true" />
            <div className="relative z-10">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-orange-300 shadow-[0_0_18px_rgba(251,146,60,0.2)]">
                <Clock className="h-6 w-6 motion-safe:animate-pulse motion-reduce:animate-none" aria-hidden="true" />
              </div>
              <dt dir="ltr" className="mt-4 text-2xl font-black text-white">24/7</dt>
              <dd className="mt-2 text-sm leading-relaxed text-slate-400">
                استجابة طوارئ فورية على مدار الساعة.
              </dd>
              <div className="mt-4 inline-flex min-h-8 items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 text-xs font-bold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 motion-safe:animate-ping" aria-hidden="true" />
                <span aria-live="polite">Live Status</span>
              </div>
              <p className="mt-3 text-[11px] font-medium text-slate-400">
                جاهزون للتدخل الآن · متوسط استجابة 12 دقيقة
              </p>
            </div>
          </div>
        </dl>
      </div>
    </section>
  );
}
