"use client";

import { Clock, Lock, ShieldCheck } from "lucide-react";
import { useSiteActions } from "./SiteActionsProvider";

const STATS = [
  { value: "24/7", label: "استجابة طوارئ على مدار الساعة", icon: Clock },
  { value: "100%", label: "تحكم محلي آمن بدون إنترنت", icon: Lock },
  { value: "NF C 15-100", label: "مطابقة معايير التمديدات الكهربائية", icon: ShieldCheck },
] as const;

export default function HeroSection() {
  const { openSos, openCalculator } = useSiteActions();

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1527] via-grid-dark to-grid-dark" />
        <div className="bg-grid-pattern absolute inset-0" />
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-electric-blue/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-electric-blue/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-24 sm:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full border border-electric-blue/30 bg-electric-blue/10 px-4 py-1.5 text-sm font-bold text-electric-blue">
          <span className="h-2 w-2 rounded-full bg-electric-blue" aria-hidden="true" />
          الجيل القادم من الهندسة الكهربائية والأتمتة الذكية
        </p>

        <h1 id="hero-title" className="mt-6 text-4xl font-black leading-[1.3] text-white sm:text-5xl lg:text-6xl">
          نهندس الطاقة. <span className="text-electric-blue">نؤتمت المستقبل.</span>
          <span className="mt-3 block text-xl font-bold leading-relaxed text-slate-300 sm:text-2xl lg:text-3xl">
            من منزلك الذكي إلى خط إنتاج مصنعك.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-loose text-slate-400 sm:text-lg">
          نجمع بين الكهرباء المعمارية والصناعية، والبرمجة والأتمتة، والأمن السيبراني في فريق واحد: تمديدات مطابقة للمعايير،
          لوحات تحكم مصممة بدقة، وأنظمة ذكية تعمل محلياً وتحمي خصوصيتك.
        </p>

        <div className="mt-10 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={openSos}
            className="open-sos-trigger min-h-14 rounded-2xl bg-sos-red px-8 py-4 text-lg font-black text-white shadow-glow-red transition hover:brightness-110 sm:min-w-72"
          >
            SOS - تدخل طوارئ فوري ⚡
          </button>
          <button
            type="button"
            onClick={openCalculator}
            className="min-h-14 rounded-2xl bg-electric-blue px-8 py-4 text-lg font-black text-grid-dark shadow-glow-blue transition hover:brightness-110 sm:min-w-72"
          >
            احسب تكلفة مشروعك الآن 📊
          </button>
        </div>

        <dl className="mx-auto mt-14 grid max-w-4xl gap-3 sm:grid-cols-3">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.value} className="surface rounded-2xl p-5">
                <Icon className="mx-auto h-6 w-6 text-electric-blue" aria-hidden="true" />
                <dt dir="ltr" className="mt-3 text-2xl font-black text-white">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-400">{stat.label}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
