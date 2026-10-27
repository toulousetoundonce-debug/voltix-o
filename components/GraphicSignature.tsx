"use client";

import { useEffect, useRef, useState } from "react";

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

interface ConductorTrace {
  height: number;
  path: string;
  nodes: number[];
  light: boolean;
}

export default function GraphicSignature() {
  const [trace, setTrace] = useState<ConductorTrace | null>(null);
  const progressPathRef = useRef<SVGPathElement>(null);
  const nodesRef = useRef<SVGCircleElement[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    if (
      root.dataset.fx !== "on" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const targets = document.querySelectorAll<HTMLElement>(".vx-fx-reveal, .vx-fx-divider");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).dataset.fxVisible = "true";
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08 },
    );

    targets.forEach((target) => {
      target.dataset.fxReady = "true";
      observer.observe(target);
    });

    return () => {
      observer.disconnect();
      targets.forEach((target) => {
        delete target.dataset.fxReady;
        delete target.dataset.fxVisible;
      });
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.fx !== "on" || window.matchMedia("(max-width: 767px)").matches) return;

    const sectionIds = [
      "control-center",
      "diagnostic",
      "services",
      "comparison",
      "why-us",
      "portfolio",
      "team",
      "contact",
    ];
    const hints = navigator as NavigatorWithHints;
    const light =
      hints.connection?.saveData === true ||
      (hints.deviceMemory !== undefined && hints.deviceMemory <= 4);
    const rebuild = () => {
      const height = Math.ceil(
        Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      );
      let cursor = 20;
      const nodeY = sectionIds.flatMap((id) => {
        const section = document.getElementById(id);
        if (!section) return [];
        const y = Math.max(
          cursor + 32,
          Math.min(height - 20, section.getBoundingClientRect().top + window.scrollY + 36),
        );
        cursor = y + 8;
        return [Math.round(y)];
      });
      const segments = [`M 8 0`];
      for (const y of nodeY) {
        segments.push(`L 8 ${y - 8} L 16 ${y} L 8 ${y + 8}`);
      }
      segments.push(`L 8 ${height}`);
      setTrace({ height, path: segments.join(" "), nodes: nodeY, light });
    };

    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(document.documentElement);
    window.addEventListener("resize", rebuild, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", rebuild);
    };
  }, []);

  useEffect(() => {
    const path = progressPathRef.current;
    if (!trace || !path) return;
    const length = path.getTotalLength();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    path.style.strokeDasharray = `${length}`;

    let frame = 0;
    const update = () => {
      frame = 0;
      const threshold = window.scrollY + window.innerHeight * 0.68;
      const progress = Math.max(0, Math.min(1, threshold / trace.height));
      path.style.strokeDashoffset = `${reduceMotion ? 0 : length * (1 - progress)}`;
      const activeIndex = trace.nodes.reduce(
        (last, y, index) => (y <= threshold ? index : last),
        -1,
      );
      nodesRef.current.forEach((node, index) => {
        node.dataset.lit = String(trace.nodes[index] <= threshold);
        node.dataset.current = String(index === activeIndex);
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    if (reduceMotion) return;
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [trace]);

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

  if (!trace) return null;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="vx-fx-layer vx-fx-conductor"
      data-quality={trace.light ? "light" : "full"}
      viewBox={`0 0 18 ${trace.height}`}
      style={{ height: `${trace.height}px` }}
    >
      <path className="vx-fx-trace-base" d={trace.path} />
      <path ref={progressPathRef} className="vx-fx-trace-progress" d={trace.path} />
      {trace.nodes.map((y, index) => (
        <circle
          key={`${y}-${index}`}
          ref={(node) => {
            if (node) nodesRef.current[index] = node;
          }}
          className="vx-fx-trace-node"
          cx="8"
          cy={y}
          r="2.4"
        />
      ))}
    </svg>
  );
}
