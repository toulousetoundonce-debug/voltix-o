import { Linkedin, MessageCircleMore } from "lucide-react";
import Image from "next/image";

const MEMBERS = [
  {
    name: "المهندس ياسين",
    role: "مهندس كهرباء معتمد NF C 15-100",
    image: "https://ui-avatars.com/api/?name=ياسين+الهدادي&background=0ea5e9&color=fff&size=300",
  },
  {
    name: "المهندسة سارة",
    role: "مهندسة شبكات وأمن سيبراني",
    image: "https://ui-avatars.com/api/?name=سارة+حسن&background=8b5cf6&color=fff&size=300",
  },
  {
    name: "الأستاذ كمال",
    role: "فني أتمتة ولوحات PLC",
    image: "https://ui-avatars.com/api/?name=كمال+زايد&background=0ea5e9&color=fff&size=300",
  },
  {
    name: "المهندس رامي",
    role: "خبير أنظمة CCTV و VLAN",
    image: "https://ui-avatars.com/api/?name=رامي+حمد&background=22c55e&color=fff&size=300",
  },
] as const;

export default function TeamSection() {
  return (
    <section id="team" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mb-10 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-electric-blue">Team</p>
        <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">عقول هندسية تقف خلف كل سلك</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {MEMBERS.map((member) => (
          <article
            key={member.name}
            className="team-card surface surface-interactive group rounded-3xl p-5 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-electric-blue/40"
          >
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-grid-dark/90 p-3">
              <Image
                src={member.image}
                alt={member.name}
                width={300}
                height={300}
                unoptimized
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                className="h-52 w-full rounded-2xl object-cover"
              />

              <div className="absolute inset-x-5 bottom-5 flex items-center justify-center gap-2 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
                <a
                  href="#"
                  aria-label="LinkedIn"
                  className="flex h-11 w-11 min-w-11 items-center justify-center rounded-full bg-slate-950/75 text-white transition hover:bg-electric-blue hover:text-grid-dark"
                >
                  <Linkedin className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="#"
                  aria-label="WhatsApp"
                  className="flex h-11 w-11 min-w-11 items-center justify-center rounded-full bg-slate-950/75 text-white transition hover:bg-emerald-500 hover:text-white"
                >
                  <MessageCircleMore className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-black text-white">{member.name}</h3>
              <p className="mt-1 text-sm text-electric-blue">{member.role}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
