"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, MoonStar, SunMedium, X } from "lucide-react";
import BrandLogo from "./BrandLogo";

const LINKS = [
  { href: "#services", label: "الخدمات" },
  { href: "#why-us", label: "لماذا Voltix" },
  { href: "#portfolio", label: "أعمالنا" },
  { href: "/achievements.html", label: "إنجازاتنا" },
  { href: "#contact", label: "تواصل معنا" },
] as const;

type SiteTheme = "light" | "dark";
const THEME_STORAGE_KEY = "voltix-theme";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<SiteTheme | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const changeTheme = (nextTheme: SiteTheme, animate = true) => {
    const root = document.documentElement;
    if (transitionTimer.current) clearTimeout(transitionTimer.current);

    if (animate) {
      root.classList.add("theme-changing");
      transitionTimer.current = setTimeout(() => {
        root.classList.remove("theme-changing");
        transitionTimer.current = null;
      }, 520);
    } else {
      root.classList.remove("theme-changing");
    }

    root.classList.toggle("light", nextTheme === "light");
    root.classList.toggle("dark", nextTheme === "dark");
    root.style.colorScheme = nextTheme;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", nextTheme === "dark" ? "#090D16" : "#F8FAFC");
    setTheme(nextTheme);
  };

  useEffect(() => {
    const currentTheme = document.documentElement.classList.contains("light") ? "light" : "dark";
    setTheme(currentTheme);

    const systemTheme = window.matchMedia("(prefers-color-scheme: light)");
    const syncSystemTheme = () => {
      if (localStorage.getItem(THEME_STORAGE_KEY) === null) {
        changeTheme(systemTheme.matches ? "light" : "dark");
      }
    };
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const nextTheme =
        event.newValue === "light" || event.newValue === "dark"
          ? event.newValue
          : systemTheme.matches
            ? "light"
            : "dark";
      changeTheme(nextTheme);
    };

    systemTheme.addEventListener("change", syncSystemTheme);
    window.addEventListener("storage", syncStoredTheme);
    return () => {
      systemTheme.removeEventListener("change", syncSystemTheme);
      window.removeEventListener("storage", syncStoredTheme);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, []);

  const toggleTheme = () => {
    const currentTheme =
      theme ?? (document.documentElement.classList.contains("light") ? "light" : "dark");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    changeTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-page-bg/80 backdrop-blur-md">
      <nav aria-label="التنقل الرئيسي" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href="#main" className="flex min-h-11 items-center gap-2.5" aria-label="Voltix Dynamics - الصفحة الرئيسية">
          <BrandLogo priority />
          <span dir="ltr" className="text-lg font-black tracking-tight text-white">
            Voltix <span className="text-electric-blue">Dynamics</span>
          </span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={
              theme === "dark"
                ? "التبديل إلى الوضع النهاري"
                : theme === "light"
                  ? "التبديل إلى الوضع الليلي"
                  : "تبديل الوضع الليلي والنهاري"
            }
            aria-pressed={theme === "dark"}
            onClick={toggleTheme}
            className="theme-toggle flex h-11 w-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition-colors duration-500 ease-in-out hover:border-electric-blue/40 hover:text-electric-blue"
          >
            <span className="relative h-5 w-5" aria-hidden="true">
              <SunMedium className="theme-toggle-icon theme-toggle-sun absolute inset-0 h-5 w-5" />
              <MoonStar className="theme-toggle-icon theme-toggle-moon absolute inset-0 h-5 w-5" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
            className="flex h-11 w-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 md:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <div id="mobile-menu" className="border-t border-white/10 bg-page-bg/95 md:hidden">
          <ul className="mx-auto max-w-7xl space-y-1 px-4 py-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-semibold text-slate-200 transition hover:bg-white/5"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
