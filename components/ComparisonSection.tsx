"use client";

import { useMemo, useState } from "react";

const DOMAINS = [
  {
    title: "تنظيم اللوحات (Armoires & Tableaux)",
    tradSub: "فوضى الأسلاك وصعوبة الصيانة ❌",
    tradPts: ["أسلاك متشابكة بدون ترقيم أو مخطط كهربائي", "اختيار عشوائي للقواطع يسبب سخونة نقاط التلامس"],
    voltSub: "ترقيم الكابلات ومعيار NF C 15-100 ✅",
    voltPts: ["تنظيم هندسي فائق وترقيم كل كابل ودارة", "حساب دقيق للأحمال وتنسيق الحمايات التفاضلية"],
  },
  {
    title: "المنازل الذكية (Smart Homes)",
    tradSub: "أجهزة تجارية تتوقف عند انقطاع الإنترنت ❌",
    tradPts: ["تعتمد على سحابة خارجية وتكشف خصوصية المنزل", "بطء استجابة وتعدد تطبيقات مشتتة"],
    voltSub: "خادم محلي معزول (Local Server) بسرعة البرق ✅",
    voltPts: ["يعمل عبر Docker و Home Assistant بدون إنترنت 100%", "خصوصية سيبرانية مطلقة واستجابة خلال 0.8ms"],
  },
  {
    title: "كاميرات المراقبة (CCTV & Security)",
    tradSub: "توصيل عشوائي يفقد الفولتية بعد أشهر ❌",
    tradPts: ["هبوط الجهد يطفئ الرؤية الليلية IR في المسافات", "وصلات مكشوفة للأكسدة وشبكة سهلة الاختراق"],
    voltSub: "حساب المسافات وحماية ضد الأكسدة وعزل VLAN ✅",
    voltPts: ["ثبات 12.0V/PoE+ وعلب IP67 محكمة الإغلاق", "عزل الكاميرات في شبكة VLAN مشفرة ضد الاختراق"],
  },
] as const;

export default function ComparisonSection() {
  const [mode, setMode] = useState<"traditional" | "voltix">("voltix");

  const cards = useMemo(
    () =>
      DOMAINS.map((domain) => {
        const isVoltix = mode === "voltix";
        const sub = isVoltix ? domain.voltSub : domain.tradSub;
        const points = isVoltix ? domain.voltPts : domain.tradPts;
        return (
          <article key={domain.title} className={`cyber-glass-card vx-fx-card rounded-3xl border p-6 ${isVoltix ? "border-electric-blue/40" : "border-sos-red/40"}`}>
            <div className="cyber-spotlight" />
            <h3 className="relative text-lg font-black text-white">{domain.title}</h3>
            <p className={`relative mt-2 text-sm font-extrabold ${isVoltix ? "text-electric-blue" : "text-red-300"}`}>{sub}</p>
            <ul className="relative mt-4 space-y-2 text-sm text-slate-300">
              {points.map((point) => (
                <li key={point}>{isVoltix ? "✅ " : "❌ "}{point}</li>
              ))}
            </ul>
          </article>
        );
      }),
    [mode],
  );

  return (
    <section id="comparison" className="vx-fx-divider mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-black text-white sm:text-4xl">لماذا لا تقبل مشاريعنا المقارنة مع التركيب التقليدي؟</h2>
        <div className="mx-auto mt-8 inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-grid-card p-2">
          <button
            type="button"
            onClick={() => setMode("traditional")}
            className={mode === "traditional" ? "rounded-xl bg-sos-red px-5 py-3 text-sm font-black text-white shadow-glow-red transition" : "rounded-xl px-5 py-3 text-sm font-black text-slate-400 transition"}
          >
            التركيب العشوائي التقليدي ❌
          </button>
          <button
            type="button"
            onClick={() => setMode("voltix")}
            className={mode === "voltix" ? "rounded-xl bg-electric-blue px-5 py-3 text-sm font-black text-grid-dark shadow-glow-blue transition" : "rounded-xl px-5 py-3 text-sm font-black text-slate-400 transition"}
          >
            المعايير الإمبراطورية لـ Voltix Dynamics ✅
          </button>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">{cards}</div>
    </section>
  );
}
