"use client";

import { Cable, CircuitBoard, Home, ShieldCheck, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSiteActions } from "./SiteActionsProvider";

interface Service {
  id: string;
  number: string;
  category: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tags: string[];
  outcome: string;
  className: string;
}

const SERVICES: Service[] = [
  {
    id: "smart-homes",
    number: "01",
    category: "أتمتة ذكية",
    icon: Home,
    title: "المنازل الذكية والأتمتة (Smart Homes)",
    description:
      "أتمتة منزلية عبر Home Assistant وDocker على خادمك المحلي. تعمل الوظائف الأساسية دون إنترنت، وتبقى بيانات منزلك داخل شبكتك.",
    tags: ["Docker", "Home Assistant", "تحكم محلي", "خصوصية كاملة"],
    outcome: "تحكم محلي يحفظ خصوصية منزلك",
    className: "lg:col-span-2",
  },
  {
    id: "industrial",
    number: "02",
    category: "كهرباء صناعية",
    icon: CircuitBoard,
    title: "الكهرباء الصناعية ولوحات التحكم",
    description:
      "تصميم وتجميع لوحات التحكم بعد حساب الأحمال، مع تنسيق القواطع وحماية المحركات والتأريض وفق متطلبات المشروع.",
    tags: ["Armoire Électrique", "حساب الأحمال", "حماية المحركات"],
    outcome: "لوحات منظمة وحماية محسوبة",
    className: "",
  },
  {
    id: "security",
    number: "03",
    category: "أمن ومراقبة",
    icon: ShieldCheck,
    title: "الأنظمة الأمنية والشبكات (CCTV & Networking)",
    description:
      "أنظمة كاميرات عالية الدقة وشبكات مراقبة معزولة. نراعي هبوط الجهد في المسارات الطويلة ونفصل الشبكة عبر VLANs.",
    tags: ["كاميرات HD", "Voltage Drop", "VLANs"],
    outcome: "مراقبة موثوقة وشبكة معزولة",
    className: "",
  },
  {
    id: "maintenance",
    number: "04",
    category: "تشخيص وصيانة",
    icon: Wrench,
    title: "الصيانة الوقائية والتشخيص المنهجي",
    description:
      "فحص الكابلات والدوائر بأجهزة القياس لتحديد موقع العطل بدقة، وتقليل أعمال التكسير غير الضرورية.",
    tags: ["فحص الكابلات", "أجهزة قياس", "بدون تكسير عشوائي"],
    outcome: "تشخيص دقيق قبل بدء الإصلاح",
    className: "lg:col-span-2",
  },
];

export default function ServicesBentoGrid() {
  const { openCalculator } = useSiteActions();

  return (
    <section
      id="services"
      aria-labelledby="services-title"
      className="vx-fx-divider vx-fx-reveal relative isolate overflow-hidden py-16 sm:py-24"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-40 top-12 h-96 w-96 rounded-full bg-electric-blue/[0.07] blur-3xl" />
        <div className="absolute -left-40 bottom-0 h-80 w-80 rounded-full bg-cyan-400/[0.05] blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 flex flex-col justify-between gap-6 md:mb-12 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-electric-blue/20 bg-electric-blue/[0.07] px-3 py-1.5 text-xs font-extrabold tracking-wide text-electric-blue">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-electric-blue shadow-[0_0_10px_rgba(0,229,255,0.8)]" />
              خدماتنا الهندسية
            </p>
            <h2 id="services-title" className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
              خدمات متخصصة، <span className="text-electric-blue">منظومة واحدة</span>
            </h2>
            <p className="mt-4 max-w-xl text-base leading-loose text-slate-400 sm:text-lg">
              كهرباء وأتمتة وأمان، من التخطيط الدقيق إلى التنفيذ والاختبار والتسليم.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 self-start rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 md:self-auto">
            <span className="text-2xl font-black text-electric-blue">04</span>
            <span className="max-w-28 text-xs font-bold leading-relaxed text-slate-400">
              تخصصات هندسية
              <br />
              تحت سقف واحد
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          return (
            <article
              key={service.id}
              className={`surface surface-interactive vx-fx-card group relative flex min-h-[260px] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.045] via-grid-dark/90 to-grid-dark p-5 shadow-[0_16px_40px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1 hover:border-electric-blue/35 hover:shadow-[0_20px_50px_rgba(0,229,255,0.09)] sm:min-h-72 sm:p-7 ${service.className}`}
            >
              <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full bg-electric-blue/[0.08] blur-3xl transition duration-300 group-hover:bg-electric-blue/[0.16]" />
              <div aria-hidden="true" className="absolute inset-x-7 top-0 h-px bg-gradient-to-l from-transparent via-electric-blue/45 to-transparent opacity-60 transition group-hover:opacity-100" />
              <div className="relative flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-electric-blue/20 bg-electric-blue/[0.08] text-electric-blue shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition group-hover:border-electric-blue/40 group-hover:bg-electric-blue/[0.14]">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-bold text-slate-400">
                  {service.category}
                </span>
              </div>
              <p className="relative mt-4 text-xs font-black tracking-[0.18em] text-electric-blue/65 sm:mt-5" dir="ltr">
                {service.number} <span className="text-slate-600">/ 04</span>
              </p>
              <h3 className="relative mt-2 text-xl font-extrabold leading-snug text-white">{service.title}</h3>
              <p className="relative mt-2 flex-1 text-sm leading-7 text-slate-400 sm:mt-3 sm:text-base sm:leading-8">{service.description}</p>
              <div className="relative mt-4 border-t border-white/[0.08] pt-3 sm:mt-5 sm:pt-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300 sm:mb-3">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {service.outcome}
                </p>
                <ul className="flex flex-wrap gap-1.5 sm:gap-2">
                  {service.tags.map((tag) => (
                    <li key={tag} className="badge-tech">
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
        </div>

        <div className="relative mt-7 flex flex-col items-start justify-between gap-5 overflow-hidden rounded-3xl border border-electric-blue/20 bg-gradient-to-l from-electric-blue/[0.11] via-electric-blue/[0.045] to-transparent p-6 sm:flex-row sm:items-center sm:p-7">
          <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-16 h-40 w-40 rounded-full bg-electric-blue/10 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-electric-blue/25 bg-electric-blue/10 text-electric-blue">
              <Cable className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-extrabold text-white">لديك مشروع قيد التخطيط؟</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">
                احصل على تقدير أولي للتكلفة في أقل من دقيقة.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCalculator}
            className="relative inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-electric-blue px-6 py-3 text-sm font-extrabold text-grid-dark shadow-glow-blue transition hover:-translate-y-0.5 hover:brightness-110 sm:w-auto"
          >
            افتح حاسبة التكلفة
          </button>
        </div>
      </div>
    </section>
  );
}
