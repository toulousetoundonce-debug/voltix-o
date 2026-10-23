"use client";

import { Cable, CircuitBoard, Home, ShieldCheck, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSiteActions } from "./SiteActionsProvider";

interface Service {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tags: string[];
  className: string;
}

const SERVICES: Service[] = [
  {
    id: "smart-homes",
    icon: Home,
    title: "المنازل الذكية والأتمتة (Smart Homes)",
    description:
      "نبني منزلك الذكي على خادم محلي (Local Control) يعمل بتقنية Docker وHome Assistant داخل شبكتك، بدون الاعتماد على الإنترنت أو سحابة خارجية. تبقى الأتمتة شغّالة حتى عند انقطاع الاتصال، وتبقى بياناتك داخل بيتك.",
    tags: ["Docker", "Home Assistant", "تحكم محلي", "خصوصية كاملة"],
    className: "lg:col-span-2",
  },
  {
    id: "industrial",
    icon: CircuitBoard,
    title: "الكهرباء الصناعية ولوحات التحكم",
    description:
      "تصميم وتجميع خزائن التحكم (Armoires Électriques) بعد حساب الأحمال بدقة، مع حماية المحركات وتنسيق القواطع والتأريض.",
    tags: ["Armoire Électrique", "حساب الأحمال", "حماية المحركات"],
    className: "",
  },
  {
    id: "security",
    icon: ShieldCheck,
    title: "الأنظمة الأمنية والشبكات (CCTV & Networking)",
    description:
      "كاميرات عالية الدقة مع معالجة هبوط الجهد (Voltage Drop) في المسافات الطويلة، وعزل شبكة المراقبة عبر VLANs لحمايتها من الاختراق.",
    tags: ["كاميرات HD", "Voltage Drop", "VLANs"],
    className: "",
  },
  {
    id: "maintenance",
    icon: Wrench,
    title: "الصيانة الوقائية والتشخيص المنهجي",
    description:
      "فحص الكابلات وتحديد الأعطال بأحدث أجهزة القياس، لنصل إلى موضع العطل بدقة دون تكسير عشوائي للجدران والأرضيات.",
    tags: ["فحص الكابلات", "أجهزة قياس", "بدون تكسير عشوائي"],
    className: "lg:col-span-2",
  },
];

export default function ServicesBentoGrid() {
  const { openCalculator } = useSiteActions();

  return (
    <section id="services" aria-labelledby="services-title" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <h2 id="services-title" className="text-3xl font-black text-white sm:text-4xl">
          خدمات هندسية تغطي المنظومة كلها
        </h2>
        <p className="mt-4 text-base leading-loose text-slate-400">
          من تمديد الكابل الأول إلى برمجة آخر سيناريو: نصمم ونركّب ونختبر ونوثّق، لنسلّمك نظاماً تفهمه وتتحكم فيه.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          return (
            <article
              key={service.id}
              className={`surface surface-interactive group relative flex flex-col overflow-hidden p-6 transition hover:border-electric-blue/40 sm:p-8 ${service.className}`}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-electric-blue/10 blur-3xl transition group-hover:bg-electric-blue/20"
              />
              <span className="corner-ticks relative flex h-12 w-12 items-center justify-center rounded-xl bg-electric-blue/10 text-electric-blue">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="relative mt-5 text-xl font-extrabold leading-snug text-white">{service.title}</h3>
              <p className="relative mt-3 flex-1 text-base leading-loose text-slate-400">{service.description}</p>
              <ul className="relative mt-5 flex flex-wrap gap-2">
                {service.tags.map((tag) => (
                  <li key={tag} className="badge-tech">
                    {tag}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-3xl border border-electric-blue/20 bg-electric-blue/5 p-6 sm:flex-row sm:items-center">
        <p className="flex items-center gap-3 text-base font-semibold text-slate-200">
          <Cable className="h-6 w-6 shrink-0 text-electric-blue" aria-hidden="true" />
          لديك مشروع؟ احصل على نطاق سعري تقريبي في أقل من دقيقة.
        </p>
        <button
          type="button"
          onClick={openCalculator}
          className="shrink-0 rounded-xl bg-electric-blue px-6 py-3 font-extrabold text-grid-dark shadow-glow-blue transition hover:brightness-110"
        >
          افتح حاسبة التكلفة
        </button>
      </div>
    </section>
  );
}
