"use client";

import { useEffect } from "react";

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

export default function GraphicSignature() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.fx !== "on") return;

    const hero = document.querySelector<HTMLElement>(".vx-fx-hero");
    const pointerMedia = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (min-width: 1024px)",
    );
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hints = navigator as NavigatorWithHints;
    if (
      !hero ||
      !pointerMedia.matches ||
      motionMedia.matches ||
      hints.connection?.saveData ||
      (hints.deviceMemory !== undefined && hints.deviceMemory <= 4)
    ) {
      return;
    }

    let frame = 0;
    const update = (event: PointerEvent) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = hero.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
        const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
        hero.style.setProperty("--vx-fx-pointer-x", `${x}%`);
        hero.style.setProperty("--vx-fx-pointer-y", `${y}%`);
        frame = 0;
      });
    };
    const reset = () => {
      hero.style.removeProperty("--vx-fx-pointer-x");
      hero.style.removeProperty("--vx-fx-pointer-y");
    };

    hero.addEventListener("pointermove", update, { passive: true });
    hero.addEventListener("pointerleave", reset, { passive: true });
    return () => {
      hero.removeEventListener("pointermove", update);
      hero.removeEventListener("pointerleave", reset);
      if (frame) cancelAnimationFrame(frame);
      reset();
    };
  }, []);

  return null;
}
