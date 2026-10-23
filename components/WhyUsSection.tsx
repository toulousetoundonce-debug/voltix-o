import { Cable, Cpu, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Pillar {
  icon: LucideIcon;
  title: string;
  body: string;
}

const PILLARS: Pillar[] = [
  {
    icon: ShieldCheck,
    title: "الالتزام بمعايير NF C 15-100",
    body: "نصمم التمديدات ونحسب المقاطع والحمايات وفق المعيار الفرنسي NF C 15-100، فتحصل على تركيب آمن وموثّق وقابل للفحص والتوسعة.",
  },
  {
    icon: Cpu,
    title: "دمج الكهرباء بالبرمجة والأمن السيبراني",
    body: "الكهربائي الذي يفهم الشبكات والبرمجة يبني نظاماً متكاملاً: أتمتة محلية، شبكات معزولة بـ VLAN، وخوادم لا تعتمد على سحابة خارجية.",
  },
  {
    icon: Cable,
    title: "لمسة هندسية في تنظيم الكابلات",
    body: "ترقيم وتصنيف وتمرير مرتّب للكابلات (Cable Management) داخل اللوحات والمجاري، ليسهل التشخيص والصيانة بعد سنوات من التسليم.",
  },
];

export default function WhyUsSection() {
  return (
    <section
      id="why-us"
      aria-labelledby="why-title"
      className="border-y border-white/10 bg-gradient-to-b from-grid-card/60 to-grid-dark py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 id="why-title" className="text-3xl font-black text-white sm:text-4xl">
            لماذا Voltix Dynamics؟
          </h2>
          <p className="mt-4 text-base leading-loose text-slate-400">
            ثلاثة التزامات نطبّقها في كل مشروع، صغيراً كان أو صناعياً.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article key={pillar.title} className="rounded-3xl border border-white/10 bg-grid-card p-6 sm:p-8">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-electric-blue/30 bg-electric-blue/10 text-electric-blue">
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-extrabold leading-snug text-white">{pillar.title}</h3>
                <p className="mt-3 text-base leading-loose text-slate-400">{pillar.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
