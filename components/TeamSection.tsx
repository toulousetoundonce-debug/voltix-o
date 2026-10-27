"use client";

import { Linkedin, MessageCircleMore } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

const IMAGE_PLACEHOLDER = "/images/team/placeholder.svg";

const MEMBERS = [
  {
    name: "المهندس ياسين",
    role: "مهندس كهرباء معتمد NF C 15-100",
    image: "/images/team/yassine.jpg",
  },
  {
    name: "الخبير عماد",
    role: "خبير الأمن السيبراني",
    image: "/images/team/emad.png",
  },
  {
    name: "الأستاذ كمال",
    role: "فني أتمتة ولوحات PLC",
    image: "/images/team/kamal.jpg",
  },
  {
    name: "Electrician Billal",
    role: "خبير أنظمة CCTV و VLAN",
    image: "/images/team/billal.png",
  },
] as const;

export default function TeamSection() {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  return (
    <section id="team" className="vx-fx-divider vx-fx-reveal mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mb-10 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-electric-blue">Team</p>
        <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">عقول هندسية تقف خلف كل سلك</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {MEMBERS.map((member) => (
          <article
            key={member.name}
            className="team-card surface surface-interactive vx-fx-card group rounded-3xl p-5 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-electric-blue/40"
          >
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-page-bg/90 p-3">
              <Image
                src={failedImages[member.image] ? IMAGE_PLACEHOLDER : member.image}
                alt={member.name}
                width={300}
                height={300}
                unoptimized
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                className="h-52 w-full rounded-2xl object-cover"
                onError={() =>
                  setFailedImages((current) => ({ ...current, [member.image]: true }))
                }
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
