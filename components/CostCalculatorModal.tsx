"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  Camera,
  Building2,
  CheckCircle2,
  Factory,
  Home,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ModalShell from "./ModalShell";
import { firstFieldErrors, postJson } from "@/lib/client";
import { SITE } from "@/lib/site";
import { createWhatsAppHref, WHATSAPP_BUSINESS_NUMBER } from "@/lib/whatsapp";
import {
  AREA_MAX,
  AREA_MIN,
  AREA_STEP,
  PROJECTS,
  PROJECT_TYPE_VALUES,
  TIERS,
  TIER_VALUES,
  type ProjectType,
  type Tier,
} from "@/lib/pricing";
import { computePricingEstimate, formatPricingMoney as formatMoney } from "@/lib/pricing/engine";
import type { Estimate } from "@/lib/pricing";
import type { PricingEstimate } from "@/lib/pricing/types";
import { pricingStrings } from "@/lib/pricing/strings";
import { track } from "@/lib/pricing/analytics";
import { pricingEstimateSchema } from "@/lib/pricing/schema";
import { PRICING_OPTION_IDS } from "@/lib/pricing/types";
import type { RegionalZone } from "@/lib/pricing/types";
import { isValidPhone } from "@/lib/validation";
import { z } from "zod";

type Step = 1 | 2 | 3 | 4;
type Status = "idle" | "submitting" | "success" | "error";

const STEP_LABELS = ["نوع المشروع", "المعايير الفنية", "مستوى التجهيز", "التقدير والطلب"];
const preferredWindowSchema = z.enum(["anytime", "morning", "afternoon", "evening"]);

const TYPE_ICONS: Record<ProjectType, LucideIcon> = {
  smart_home: Home,
  industrial_electrical: Factory,
  commercial: Building2,
  cctv: Camera,
};
const ADDONS_BY_TYPE: Record<ProjectType, Array<keyof typeof pricingStrings.addons>> = {
  smart_home: ["addon-ups-smart", "addon-scenes-smart"],
  industrial_electrical: ["addon-surge-industrial", "addon-ats-industrial"],
  commercial: ["addon-surge-commercial"],
  cctv: ["addon-nightvision-cctv", "addon-vlan-cctv"],
};

const inputCls =
  "w-full rounded-xl border border-white/10 bg-page-bg px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-electric-blue focus:outline-none focus:ring-2 focus:ring-electric-blue/40";
const formatQuantity = (value: number) =>
  new Intl.NumberFormat("ar-DZ-u-nu-latn", { maximumFractionDigits: 0 }).format(value);
const calculatorDraftSchema = z.object({
  projectType: z.enum(PROJECT_TYPE_VALUES).nullable(),
  area: z.number().int().min(AREA_MIN).max(AREA_MAX),
  units: z.number().int().min(1).max(500),
  tier: z.enum(TIER_VALUES),
  city: z.string().max(60),
  includeVat: z.boolean(),
  detailLevel: z.enum(["known", "estimated", "unknown"]),
  requestId: z.string().uuid().optional(),
  options: z.array(z.enum(PRICING_OPTION_IDS)).max(12).default([]),
  renovation: z.boolean().default(false),
  accessDifficulty: z.enum(["normal", "difficult", "unknown"]).default("normal"),
});
const shareSelectionSchema = z.object({
  projectType: z.enum(PROJECT_TYPE_VALUES),
  area: z.number().int().min(AREA_MIN).max(AREA_MAX),
  units: z.number().int().min(1).max(500),
  tier: z.enum(TIER_VALUES),
  includeVat: z.boolean(),
  detailLevel: z.enum(["known", "estimated", "unknown"]),
  options: z.array(z.enum(PRICING_OPTION_IDS)).max(12).default([]),
  renovation: z.boolean().default(false),
  accessDifficulty: z.enum(["normal", "difficult", "unknown"]).default("normal"),
  zone: z.enum(["north-center", "high-plateaux", "south", "other"]),
});
const estimatePreviewSchema = z.object({
  ok: z.literal(true),
  referenceId: z.string().regex(/^EST-\d{6}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/),
  estimate: pricingEstimateSchema.extend({ base: z.number().finite().nonnegative() }),
});
const estimateSubmitSchema = pricingEstimateSchema.extend({
  base: z.number().finite().nonnegative(),
});

export default function CostCalculatorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [area, setArea] = useState(150);
  const [units, setUnits] = useState(30);
  const [tier, setTier] = useState<Tier>("advanced");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [preferredWindow, setPreferredWindow] = useState<"anytime" | "morning" | "afternoon" | "evening">("anytime");
  const [renovation, setRenovation] = useState(false);
  const [accessDifficulty, setAccessDifficulty] = useState<"normal" | "difficult" | "unknown">("normal");
  const [shareZone, setShareZone] = useState<RegionalZone | null>(null);
  const [honeypot, setHoneypot] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [serverEstimate, setServerEstimate] = useState<PricingEstimate | null>(null);
  const [includeVat, setIncludeVat] = useState(true);
  const [detailLevel, setDetailLevel] = useState<"known" | "estimated" | "unknown">("unknown");
  const [referenceId, setReferenceId] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Array<(typeof PRICING_OPTION_IDS)[number]>>([]);
  const requestIdRef = useRef("");

  const project = projectType ? PROJECTS[projectType] : null;
  const pricingEstimate = projectType
    ? (() => {
        const serviceLine = projectType === "smart_home"
          ? "smart-home"
          : projectType === "cctv"
            ? "cctv-network"
            : projectType === "commercial"
              ? "commercial"
              : "industrial";
        return computePricingEstimate({
          serviceLine,
          areaM2: area,
          quantity: units,
          tier: tier === "economic" ? "economy" : tier === "professional" ? "premium" : "standard",
          wilaya: city,
          detailLevel,
          includeVat,
          options: selectedOptions,
          renovation,
          accessDifficulty,
        });
      })()
    : null;
  const estimate = pricingEstimate
    ? {
        base: pricingEstimate.expected,
        min: pricingEstimate.min,
        max: pricingEstimate.max,
      }
    : null;

  useEffect(() => {
    if (!open) return;
    track("started");
    try {
      const encodedSelections = new URLSearchParams(window.location.search).get("pricing");
      if (encodedSelections) {
        const shared = shareSelectionSchema.safeParse(JSON.parse(encodedSelections) as unknown);
        if (shared.success) {
          setProjectType(shared.data.projectType);
          setArea(shared.data.area);
          setUnits(Math.min(shared.data.units, PROJECTS[shared.data.projectType].unitMax));
          setTier(shared.data.tier);
          setIncludeVat(shared.data.includeVat);
          setDetailLevel(shared.data.detailLevel);
          setSelectedOptions(shared.data.options);
          setRenovation(shared.data.renovation);
          setAccessDifficulty(shared.data.accessDifficulty);
          setShareZone(shared.data.zone);
          setStep(4);
          setShareMessage("تم تحميل إعدادات التقدير المشتركة.");
          return;
        }
      }
      const saved = sessionStorage.getItem("voltix-pricing-draft");
      if (!saved) return;
      const parsed = calculatorDraftSchema.safeParse(JSON.parse(saved) as unknown);
      if (!parsed.success) {
        sessionStorage.removeItem("voltix-pricing-draft");
        return;
      }
      const draft = parsed.data;
      setProjectType(draft.projectType);
      setArea(draft.area);
      setUnits(draft.units);
      setTier(draft.tier);
      setCity(draft.city);
      setIncludeVat(draft.includeVat);
      setDetailLevel(draft.detailLevel);
      setSelectedOptions(draft.options);
      setRenovation(draft.renovation);
      setAccessDifficulty(draft.accessDifficulty);
      requestIdRef.current = draft.requestId ?? "";
    } catch {
      sessionStorage.removeItem("voltix-pricing-draft");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    try {
      sessionStorage.setItem("voltix-pricing-draft", JSON.stringify({ projectType, area, units, tier, city, includeVat, detailLevel, options: selectedOptions, renovation, accessDifficulty, ...(requestIdRef.current ? { requestId: requestIdRef.current } : {}) }));
    } catch {
      // Draft persistence is best-effort; calculator use remains available.
    }
  }, [open, projectType, area, units, tier, city, includeVat, detailLevel, selectedOptions, renovation, accessDifficulty]);

  const reset = () => {
    setStep(1);
    setProjectType(null);
    setArea(150);
    setUnits(30);
    setTier("advanced");
    setFullName("");
    setPhone("");
    setCity("");
    setHoneypot("");
    setErrors({});
    setStatus("idle");
    setMessage("");
    setServerEstimate(null);
    setIncludeVat(true);
    setDetailLevel("unknown");
    setReferenceId("");
    setSelectedOptions([]);
    setRenovation(false);
    setAccessDifficulty("normal");
    setAddress("");
    setPreferredWindow("anytime");
    setShareZone(null);
    requestIdRef.current = "";
  };

  const handleClose = () => {
    if (status === "success") reset();
    onClose();
  };

  const selectType = (type: ProjectType) => {
    if (type !== projectType) {
      setProjectType(type);
      setUnits(PROJECTS[type].unitDefault);
      setSelectedOptions([ADDONS_BY_TYPE[type][0]]);
    }
  };

  const goNext = () => {
    track("step_completed");
    setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
    if (step === 3) track("result_viewed");
  };
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  const selectTier = (value: Tier) => {
    setTier(value);
    track("tier_selected");
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting" || !projectType) return;
    track("inspection_requested");

    const found: Record<string, string> = {};
    if (fullName.trim().length < 2) found.fullName = "أدخل اسمك الكامل";
    if (!isValidPhone(phone)) found.phone = "أدخل رقم هاتف / واتساب صالحاً";
    if (city.trim().length < 2) found.city = "أدخل اسم المدينة";
    setErrors(found);
    if (Object.keys(found).length > 0) {
      if (found.city) setStep(2);
      return;
    }

    setStatus("submitting");
    setMessage("");
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();

    const result = await postJson("/api/quote", {
      requestId: requestIdRef.current,
      pricingDetailLevel: detailLevel,
      includeVat,
      options: selectedOptions,
      renovation,
      accessDifficulty,
      zone: shareZone ?? undefined,
      projectType,
      area,
      units,
      tier,
      fullName,
      phone,
      city,
      address,
      preferredWindow,
      website: honeypot,
    });

    if (result.ok) {
      const parsedEstimate = estimateSubmitSchema.safeParse(result.estimate);
      if (!parsedEstimate.success) {
        setStatus("error");
        setMessage("تعذّر التحقق من التقدير الذي أعاده الخادم. أعد المحاولة.");
        return;
      }
      setServerEstimate(parsedEstimate.data);
      const parsedReference = z.string().regex(/^EST-\d{6}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/).safeParse(result.referenceId);
      setReferenceId(parsedReference.success ? parsedReference.data : "");
      setStatus("success");
      setMessage(result.message ?? "تم استلام طلبك.");
    } else {
      setStatus("error");
      setMessage(result.error ?? "حدث خطأ غير متوقع. حاول مرة أخرى.");
      setErrors(firstFieldErrors(result.fieldErrors));
    }
  };

  const submitting = status === "submitting";
  const shownEstimate = serverEstimate
    ? { base: serverEstimate.expected, min: serverEstimate.min, max: serverEstimate.max }
    : estimate;
  const whatsappMessage = project && shownEstimate
    ? [
        "سلام عليكم Voltix Dynamics، أرسل لكم طلب استفسار حول عرض السعر الأولي.",
        `المشروع: ${project.label}`,
        `المساحة: ${formatQuantity(area)} م²`,
        `${project.unitLabel}: ${formatMoney(units)}`,
        `مستوى التجهيز: ${TIERS[tier].label}`,
        `السعر التقديري: ${formatMoney(shownEstimate.min)} – ${formatMoney(shownEstimate.max)}`,
        "أرجو التواصل معي لتأكيد التفاصيل وموعد المعاينة.",
      ].join("\n")
    : "";
  const whatsappHref = createWhatsAppHref(WHATSAPP_BUSINESS_NUMBER, whatsappMessage);

  const refreshServerEstimate = async (): Promise<PricingEstimate | null> => {
    if (!projectType) return null;
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    const response = await fetch("/api/quote/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: requestIdRef.current,
        serviceLine: projectType === "smart_home" ? "smart-home" : projectType === "cctv" ? "cctv-network" : projectType === "commercial" ? "commercial" : "industrial",
        quantity: units,
        areaM2: area,
        tier: tier === "economic" ? "economy" : tier === "professional" ? "premium" : "standard",
        wilaya: city,
        detailLevel,
        includeVat,
        options: selectedOptions,
        renovation,
        accessDifficulty,
      }),
    });
    const payload: unknown = await response.json().catch(() => null);
    const parsed = estimatePreviewSchema.safeParse(payload);
    if (!response.ok || !parsed.success) return null;
    setServerEstimate(parsed.data.estimate);
    setReferenceId(parsed.data.referenceId);
    return parsed.data.estimate;
  };

  useEffect(() => {
    if (!open || step !== 4 || !projectType) return;
    let active = true;
    void refreshServerEstimate().then((verified) => {
      if (active && !verified) setMessage("تعذّر تحديث التقدير من الخادم؛ الأرقام تبقى استرشادية.");
    }).catch(() => {
      if (active) setMessage("تعذّر تحديث التقدير من الخادم؛ الأرقام تبقى استرشادية.");
    });
    return () => { active = false; };
  }, [open, step, projectType, area, units, tier, city, detailLevel, includeVat, selectedOptions, renovation, accessDifficulty, shareZone]);

  const printEstimate = (
    estimateForDocument = shownEstimate,
    detailsForDocument = serverEstimate,
  ) => {
    if (!project || !estimateForDocument) return;
    const date = new Intl.DateTimeFormat("ar-DZ", { dateStyle: "long" }).format(new Date());
    const boqRows = detailsForDocument?.boq.map((line) =>
      `<tr><td>${line.nameAr}</td><td>${line.quantity}</td><td>${line.unitPriceDzd}</td><td>${line.totalDzd}</td></tr>`,
    ).join("") ?? "";
    const assumptions = detailsForDocument?.assumptions.map((item) => `<li>${item}</li>`).join("") ?? "";
    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>العرض الأولي - Voltix Dynamics</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; font-family: Cairo, "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl; }
    header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #00bcd4; padding-bottom: 18px; }
    h1 { margin: 0; color: #0b1527; font-size: 24px; font-weight: 900; }
    .brand { color: #008da0; font-size: 13px; font-weight: 700; }
    .date { color: #64748b; font-size: 13px; }
    h2 { margin: 28px 0 12px; font-size: 19px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #d7dee8; padding: 12px; text-align: right; }
    th { width: 32%; background: #f1f7f9; }
    .price { margin-top: 24px; padding: 18px; border: 1px solid #00bcd4; border-radius: 12px; text-align: center; }
    .price strong { display: block; margin-top: 4px; color: #007c8e; font-size: 24px; }
    .legal { margin-top: 28px; padding: 14px; background: #fff8e6; border-right: 4px solid #e7a008; font-size: 12px; line-height: 1.9; }
    footer { margin-top: 34px; border-top: 1px solid #d7dee8; padding-top: 12px; color: #64748b; font-size: 11px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <header><div><h1>Voltix Dynamics</h1><div class="brand">الهندسة الكهربائية · الأتمتة · الأنظمة الذكية</div></div><div class="date">تاريخ العرض: ${date}</div></header>
  <h2>تقدير أولي · ${referenceId}</h2>
  <table>
    <tbody>
      <tr><th>الخدمة المختارة</th><td>${project.label}</td></tr>
      <tr><th>المساحة</th><td>${formatQuantity(area)} م²</td></tr>
      <tr><th>${project.unitLabel}</th><td>${formatMoney(units)}</td></tr>
      <tr><th>مستوى التجهيز</th><td>${TIERS[tier].label}</td></tr>
    </tbody>
  </table>
  <h2>جدول الكميات المختصر</h2>
  <table><thead><tr><th>البند</th><th>الكمية</th><th>سعر الوحدة (دج)</th><th>الإجمالي (دج)</th></tr></thead><tbody>${boqRows}</tbody></table>
  <h2>الافتراضات والاستثناءات</h2><ul>${assumptions}<li>الأعمال المخفية أو غير الظاهرة لا تدخل في هذا التقدير.</li></ul>
  <div class="price">تقدير استرشادي غير ملزم · ${includeVat ? "شامل TVA" : "HT"}<strong>${formatMoney(estimateForDocument.min)} – ${formatMoney(estimateForDocument.max)}</strong></div>
  <p>المتوقع: ${formatMoney(estimateForDocument.base)} · مستوى الثقة: ${pricingEstimate?.confidence ?? "منخفضة"}</p>
  <p class="legal">${pricingStrings.indicative}، ${pricingStrings.validity}. ${pricingStrings.finalAfterInspection}، بعد الدراسة الفنية وتحديد نطاق الأعمال والمواد المطلوبة.</p>
  <footer>Voltix Dynamics — وثيقة تقدير أولي مولّدة بتاريخ ${date}</footer>
</body>
</html>`;

    const printFrame = document.createElement("iframe");
    printFrame.title = "معاينة العرض الأولي للطباعة";
    printFrame.setAttribute("aria-hidden", "true");
    printFrame.tabIndex = -1;
    printFrame.style.position = "fixed";
    printFrame.style.left = "-10000px";
    printFrame.style.bottom = "0";
    printFrame.style.width = "1px";
    printFrame.style.height = "1px";
    printFrame.style.border = "0";
    printFrame.onload = () => {
      window.setTimeout(() => {
        try {
          const printWindow = printFrame.contentWindow;
          if (!printWindow) throw new Error("Print frame is not available.");
          printWindow.focus();
          printWindow.print();
          printWindow.addEventListener("afterprint", () => printFrame.remove(), { once: true });
          window.setTimeout(() => printFrame.remove(), 60_000);
        } catch (error) {
          printFrame.remove();
          console.error("[QUOTE PRINT] Failed to open print dialog.", error);
          window.alert("تعذّرت طباعة العرض. حاول مجدداً أو تحقق من إعدادات الطباعة في المتصفح.");
        }
      }, 250);
    };
    printFrame.srcdoc = html;
    document.body.appendChild(printFrame);
  };

  const footer =
    status === "success" ? (
      <button
        type="button"
        onClick={handleClose}
        className="w-full rounded-xl bg-white/10 px-5 py-3.5 text-base font-bold text-white transition hover:bg-white/20"
      >
        إغلاق
      </button>
    ) : (
      <div className="flex gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3.5 text-base font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
            السابق
          </button>
        ) : null}

        {step < 4 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={step === 1 && !projectType}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-electric-blue px-5 py-3.5 text-base font-extrabold text-grid-dark shadow-glow-blue transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            التالي
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            form="quote-form"
            disabled={submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-electric-blue px-5 py-3.5 text-base font-extrabold text-grid-dark shadow-glow-blue transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                جارٍ الإرسال...
              </>
            ) : (
              "إرسال طلب الدراسة"
            )}
          </button>
        )}
      </div>
    );

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="حاسبة تكلفة المشروع"
      titleId="calc-title"
      subtitle="أربع خطوات قصيرة للحصول على نطاق سعري تقريبي فوري."
      accent="blue"
      icon={<Calculator className="h-7 w-7 text-electric-blue" aria-hidden="true" />}
      footer={footer}
      scrollKey={`${step}-${status}`}
    >
      {/* Progress */}
      <div className="mb-6">
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={step}
          aria-valuetext={`الخطوة ${step} من 4: ${STEP_LABELS[step - 1]}`}
          className="h-2 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full w-full origin-right rounded-full bg-electric-blue shadow-glow-blue transition-transform duration-300"
            style={{ transform: `scaleX(${step / 4})` }}
          />
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-300">
          الخطوة {step} من 4 <span className="text-slate-500">— {STEP_LABELS[step - 1]}</span>
        </p>
      </div>

      {status === "success" && shownEstimate ? (
        <div className="py-2 text-center" role="status">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" aria-hidden="true" />
          <p className="mt-4 text-lg font-bold text-white">{message}</p>
          {referenceId ? <p className="mt-2 text-sm text-slate-300">مرجع التقدير: <bdi dir="ltr">{referenceId}</bdi></p> : null}
          <div className="mt-5 rounded-2xl border border-electric-blue/30 bg-electric-blue/5 p-4">
            <p className="text-sm text-slate-400">النطاق التقريبي المرسل مع طلبك</p>
            <p className="mt-1 text-xl font-extrabold text-electric-blue">
              <bdi>{formatMoney(shownEstimate.min)}</bdi> – <bdi>{formatMoney(shownEstimate.max)}</bdi>
            </p>
            {referenceId ? <p className="mt-2 text-sm text-slate-300">مرجع التقدير: <bdi dir="ltr">{referenceId}</bdi></p> : null}
          </div>
          {project ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-3 text-sm font-bold text-[#75f0a2] transition hover:bg-[#25D366]/20"
            >
              💬 إرسال عرض السعر والطلب عبر واتساب
            </a>
          ) : null}
        </div>
      ) : null}

      {status !== "success" && step === 1 ? (
        <div role="radiogroup" aria-label="نوع المشروع" className="space-y-3">
          {PROJECT_TYPE_VALUES.map((type) => {
            const Icon = TYPE_ICONS[type];
            const selected = projectType === type;
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectType(type)}
                className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-right transition ${
                  selected
                    ? "border-electric-blue bg-electric-blue/10 shadow-glow-blue"
                    : "border-white/10 bg-page-bg hover:border-white/30"
                }`}
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    selected ? "bg-electric-blue text-grid-dark" : "bg-white/5 text-electric-blue"
                  }`}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-base font-bold text-white">{PROJECTS[type].label}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-slate-400">
                    {PROJECTS[type].description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {status !== "success" && step === 2 && project ? (
        <div className="space-y-8">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="calc-area" className="text-base font-bold text-white">
                المساحة الإجمالية
              </label>
              <output htmlFor="calc-area" className="text-xl font-extrabold text-electric-blue">
                <bdi>{formatQuantity(area)}</bdi> م²
              </output>
            </div>
            <input
              id="calc-area"
              type="range"
              className="range-neon mt-4"
              min={AREA_MIN}
              max={AREA_MAX}
              step={AREA_STEP}
              value={area}
              onChange={(e) => setArea(Number(e.target.value))}
            />
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>{AREA_MIN} م²</span>
              <span>{formatQuantity(AREA_MAX)} م²</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">قرّب مساحة المنزل أو المنشأة بالمتر المربع؛ الرقم يساعد على إعداد تقدير أولي فقط.</p>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="calc-units" className="text-base font-bold text-white">
                {project.unitLabel}
              </label>
              <output htmlFor="calc-units" className="text-xl font-extrabold text-electric-blue">
                <bdi>{units}</bdi>
              </output>
            </div>
            <input
              id="calc-units"
              type="range"
              className="range-neon mt-4"
              min={project.unitMin}
              max={project.unitMax}
              step={1}
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
            />
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>{project.unitMin}</span>
              <span>{project.unitMax}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{project.unitHint}</p>
          </div>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-page-bg px-4 py-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={detailLevel === "unknown"}
              onChange={(event) => setDetailLevel(event.target.checked ? "unknown" : "known")}
              className="h-5 w-5 accent-electric-blue"
            />
            {pricingStrings.unknown} — وسّع النطاق إذا كانت الكميات تقريبية
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-200">
              <span className="mb-1.5 block">{pricingStrings.siteCondition}</span>
              <select value={renovation ? "renovation" : "new"} onChange={(event) => setRenovation(event.target.value === "renovation")} className={inputCls}>
                <option value="new">{pricingStrings.newSite}</option>
                <option value="renovation">{pricingStrings.renovationSite}</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-200">
              <span className="mb-1.5 block">{pricingStrings.access}</span>
              <select value={accessDifficulty} onChange={(event) => {
                const parsed = z.enum(["normal", "difficult", "unknown"]).safeParse(event.target.value);
                if (parsed.success) setAccessDifficulty(parsed.data);
              }} className={inputCls}>
                <option value="normal">{pricingStrings.accessNormal}</option>
                <option value="difficult">{pricingStrings.accessDifficult}</option>
                <option value="unknown">{pricingStrings.accessUnknown}</option>
              </select>
            </label>
          </div>
          <div>
            <label htmlFor="quote-city" className="mb-1.5 block text-sm font-semibold text-slate-200">{pricingStrings.wilaya}</label>
            <input
              id="quote-city"
              name="city"
              type="text"
              autoComplete="address-level1"
              maxLength={60}
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setShareZone(null);
              }}
              aria-invalid={Boolean(errors.city)}
              aria-describedby={errors.city ? "quote-city-err" : undefined}
              className={inputCls}
            />
            {errors.city ? <p id="quote-city-err" className="mt-1 text-sm text-red-300">{errors.city}</p> : null}
          </div>
        </div>
      ) : null}

      {status !== "success" && step === 3 ? (
        <div className="space-y-5">
        <div role="radiogroup" aria-label="مستوى التجهيز" className="space-y-3">
          {TIER_VALUES.map((value) => {
            const selected = tier === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectTier(value)}
                className={`w-full rounded-2xl border p-4 text-right transition ${
                  selected
                    ? "border-electric-blue bg-electric-blue/10 shadow-glow-blue"
                    : "border-white/10 bg-page-bg hover:border-white/30"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-base font-bold text-white">{TIERS[value].label}</span>
                  <span
                    dir="ltr"
                    className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-sm font-bold text-electric-blue"
                  >
                    ×{TIERS[value].multiplier.toFixed(2)}
                  </span>
                </span>
                <span className="mt-1.5 block text-sm leading-relaxed text-slate-400">
                  {TIERS[value].description}
                </span>
              </button>
            );
          })}
        </div>
        {projectType && pricingEstimate ? (
          <fieldset className="space-y-2 border-t border-white/10 pt-4">
            <legend className="mb-2 text-base font-bold text-white">إضافات اختيارية</legend>
            {ADDONS_BY_TYPE[projectType].map((id, index) => {
              const details = pricingStrings.addons[id];
              const withAddon = computePricingEstimate({
                serviceLine: projectType === "smart_home" ? "smart-home" : projectType === "cctv" ? "cctv-network" : projectType === "commercial" ? "commercial" : "industrial",
                areaM2: area,
                quantity: units,
                tier: tier === "economic" ? "economy" : tier === "professional" ? "premium" : "standard",
                wilaya: city,
                detailLevel,
                includeVat,
                renovation,
                accessDifficulty,
                options: [...selectedOptions.filter((option) => option !== id), id],
              });
              const withoutAddon = computePricingEstimate({
                serviceLine: projectType === "smart_home" ? "smart-home" : projectType === "cctv" ? "cctv-network" : projectType === "commercial" ? "commercial" : "industrial",
                areaM2: area,
                quantity: units,
                tier: tier === "economic" ? "economy" : tier === "professional" ? "premium" : "standard",
                wilaya: city,
                detailLevel,
                includeVat,
                renovation,
                accessDifficulty,
                options: selectedOptions.filter((option) => option !== id),
              });
              const delta = Math.max(0, withAddon.expected - withoutAddon.expected);
              return (
                <label key={id} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3">
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(id)}
                    onChange={(event) => setSelectedOptions((previous) =>
                      event.target.checked ? [...previous, id] : previous.filter((item) => item !== id),
                    )}
                    className="mt-1 h-5 w-5 accent-electric-blue"
                  />
                  <span className="flex-1">
                    <span className="block font-bold text-white">{details.label} {index === 0 ? <span className="text-xs text-electric-blue">مقترح</span> : null}</span>
                    <span className="block text-xs text-slate-400">{details.benefit}</span>
                  </span>
                  <bdi dir="ltr" className="text-xs text-electric-blue">+{formatMoney(delta)}</bdi>
                </label>
              );
            })}
          </fieldset>
        ) : null}
        </div>
      ) : null}

      {status !== "success" && step === 4 && project && estimate ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-white">{pricingStrings.indicative}</p>
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-200">
              <input type="checkbox" checked={includeVat} onChange={(event) => setIncludeVat(event.target.checked)} className="h-5 w-5 accent-electric-blue" />
              {includeVat ? pricingStrings.includeVat : pricingStrings.excludeVat}
            </label>
          </div>
          <div className="estimate-card rounded-2xl border border-electric-blue/30 p-4 text-center">
            <p className="text-sm text-slate-400">النطاق السعري التقريبي</p>
            <p dir="ltr" className="estimate-price mt-1 font-black text-electric-blue">
              <bdi>{formatMoney(estimate.min)}</bdi> – <bdi>{formatMoney(estimate.max)}</bdi>
            </p>
            <p className="mt-2 text-sm font-bold text-white">
              {pricingStrings.confidence}: {pricingEstimate?.confidence ?? "منخفضة"} ({pricingEstimate?.confidenceScore ?? 0}%)
            </p>
            <div
              role="meter"
              aria-label={pricingStrings.confidence}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pricingEstimate?.confidenceScore ?? 0}
              className="mx-auto mt-2 h-2 max-w-xs overflow-hidden rounded-full bg-white/10"
            >
              <div className="h-full rounded-full bg-electric-blue transition-[width] duration-200" style={{ width: `${pricingEstimate?.confidenceScore ?? 0}%` }} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              {pricingStrings.validity}. {pricingStrings.finalAfterInspection}. {pricingStrings.estimateWarning}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="مستويات التجهيز">
            {(["economic", "advanced", "professional"] as const).map((value) => {
              const tierKey = value === "economic" ? "economy" : value === "professional" ? "premium" : "standard";
              const tierEstimate = pricingEstimate?.tiers[tierKey];
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTier(value)}
                  aria-pressed={tier === value}
                  className={`min-h-24 rounded-xl border p-3 text-right transition ${tier === value ? "border-electric-blue bg-electric-blue/10" : "border-white/10 bg-page-bg"}`}
                >
                  {value === "advanced" ? <span className="mb-1 block text-xs font-bold text-electric-blue">{pricingStrings.requested}</span> : null}
                  <span className="block text-sm font-bold text-white">{TIERS[value].label}</span>
                  {tierEstimate ? <span dir="ltr" className="mt-1 block text-xs text-electric-blue">{formatMoney(tierEstimate.min)} – {formatMoney(tierEstimate.max)}</span> : null}
                </button>
              );
            })}
          </div>
          {pricingEstimate ? (
            <div className="space-y-3 rounded-xl border border-white/10 bg-page-bg p-4">
              <h3 className="font-bold text-white">{pricingStrings.drivers}</h3>
              <div className="flex flex-wrap gap-2">
                {pricingEstimate.priceDrivers.map((driver) => <span key={driver} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{driver}</span>)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(pricingEstimate.breakdown).map(([key, amount]) => (
                  <p key={key} className="rounded-lg bg-white/5 p-2 text-slate-300">
                    {key === "materials" ? "المواد" : key === "labor" ? "التركيب" : key === "transport" ? "النقل" : "الاحتياط"}: <bdi>{formatMoney(amount)}</bdi>
                  </p>
                ))}
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <svg viewBox="0 0 36 36" className="h-14 w-14" role="img" aria-label="توزيع تكاليف المشروع">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="5" className="text-electric-blue" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22c55e" strokeWidth="5" strokeDasharray="25 75" strokeDashoffset="25" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="5" strokeDasharray="15 85" strokeDashoffset="50" />
                </svg>
                <span>مدة التنفيذ: {pricingEstimate.durationRangeDays.min}–{pricingEstimate.durationRangeDays.max} يوم</span>
              </div>
              <p className="text-sm font-bold text-white">{pricingStrings.phasePlan}</p>
              <p className="text-sm text-slate-400">المرحلة الأولى: تحديد المسارات والأحمال — {formatMoney(Math.round(estimate.base * 0.4))}</p>
              <p className="text-sm text-slate-400">المرحلة الثانية: التوريد والتركيب والاختبار — {formatMoney(Math.round(estimate.base * 0.6))}</p>
            </div>
          ) : null}
          <button
            type="button"
            className="min-h-12 w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/5"
            onClick={() => {
              const shareSelection = shareSelectionSchema.safeParse({
                projectType,
                area,
                units,
                tier,
                includeVat,
                detailLevel,
                options: selectedOptions,
                renovation,
                accessDifficulty,
                zone: shareZone ?? pricingEstimate?.zone ?? "other",
              });
              if (!shareSelection.success) {
                setShareMessage("تعذّر تجهيز رابط صالح للإعدادات الحالية.");
                return;
              }
              const shareUrl = new URL(window.location.href);
              shareUrl.searchParams.set("pricing", JSON.stringify(shareSelection.data));
              void navigator.clipboard.writeText(shareUrl.toString()).then(
                () => setShareMessage("نُسخ رابط الإعدادات فقط؛ لا يتضمن بيانات شخصية."),
                () => setShareMessage("تعذّر النسخ. تحقق من إذن الحافظة في المتصفح."),
              );
            }}
          >
            نسخ رابط بالإعدادات فقط
          </button>
          {shareMessage ? <p role="status" className="text-sm text-slate-300">{shareMessage}</p> : null}

          <button
            type="button"
            onClick={() => {
              void refreshServerEstimate().then((verified) => {
                if (verified) printEstimate({ base: verified.expected, min: verified.min, max: verified.max }, verified);
                else setMessage("تعذّر تأكيد التقدير من الخادم. أعد المحاولة قبل إنشاء الوثيقة.");
              }).catch(() => setMessage("تعذّر الاتصال بالخادم لتأكيد التقدير."));
            }}
            className="primary-action flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-electric-blue transition"
          >
            📄 تحميل العرض الأولي (Devis PDF)
          </button>
          <button
            type="button"
            onClick={() => {
              const shareWindow = window.open("about:blank", "_blank");
              void refreshServerEstimate().then((verified) => {
                if (!verified || !shareWindow) {
                  shareWindow?.close();
                  setMessage("تعذّر تأكيد التقدير لمشاركته. أعد المحاولة.");
                  return;
                }
                shareWindow.location.href = createWhatsAppHref(
                  WHATSAPP_BUSINESS_NUMBER,
                  [
                    `تقدير استرشادي غير ملزم: ${project?.label ?? ""}`,
                    `النطاق: ${formatMoney(verified.min)} – ${formatMoney(verified.max)}`,
                    pricingStrings.validity,
                    pricingStrings.finalAfterInspection,
                  ].join("\n"),
                );
              }).catch(() => {
                shareWindow?.close();
                setMessage("تعذّر الاتصال بالخادم لتأكيد التقدير.");
              });
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2.5 text-sm font-bold text-[#75f0a2] transition hover:bg-[#25D366]/20"
          >
            💬 إرسال عرض السعر والطلب عبر واتساب
          </button>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="readout rounded-xl p-3">
              <dt className="text-slate-400">المشروع</dt>
              <dd className="mt-0.5 font-semibold text-white">{project.label}</dd>
            </div>
            <div className="readout rounded-xl p-3">
              <dt className="text-slate-400">المساحة</dt>
              <dd className="mt-0.5 font-semibold text-white">
                <bdi>{formatQuantity(area)}</bdi> م²
              </dd>
            </div>
            <div className="readout rounded-xl p-3">
              <dt className="text-slate-400">{project.unitLabel}</dt>
              <dd className="mt-0.5 font-semibold text-white">
                <bdi>{units}</bdi>
              </dd>
            </div>
            <div className="readout rounded-xl p-3">
              <dt className="text-slate-400">التجهيز</dt>
              <dd className="mt-0.5 font-semibold text-white">{TIERS[tier].label}</dd>
            </div>
          </dl>

          <form id="quote-form" onSubmit={onSubmit} noValidate className="space-y-4 border-t border-white/10 pt-5">
            <p className="text-base font-bold text-white">احجز معاينة ميدانية</p>

            {status === "error" && message ? (
              <div
                role="alert"
                className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100"
              >
                <p className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  {message}
                </p>
                {SITE.phoneHref ? (
                  <a href={SITE.phoneHref} className="mt-2 inline-flex min-h-11 items-center font-bold underline underline-offset-4">
                    تواصل هاتفياً عند تعذّر الإرسال
                  </a>
                ) : null}
              </div>
            ) : null}

            <div>
              <label htmlFor="quote-name" className="mb-1.5 block text-sm font-semibold text-slate-200">
                الاسم الكامل
              </label>
              <input
                id="quote-name"
                name="fullName"
                type="text"
                autoComplete="name"
                maxLength={80}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={errors.fullName ? "quote-name-err" : undefined}
                className={inputCls}
              />
              {errors.fullName ? (
                <p id="quote-name-err" className="mt-1 text-sm text-red-300">
                  {errors.fullName}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="quote-phone" className="mb-1.5 block text-sm font-semibold text-slate-200">
                رقم الهاتف / واتساب
              </label>
              <input
                id="quote-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                maxLength={25}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "quote-phone-err" : undefined}
                className={`${inputCls} text-left`}
                placeholder="0550 00 00 00"
              />
              <p className="mt-1 text-xs text-slate-400">نقبل الرقم المحلي أو الدولي، مع المسافات أو بدونها.</p>
              {errors.phone ? (
                <p id="quote-phone-err" className="mt-1 text-sm text-red-300">
                  {errors.phone}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="quote-address" className="mb-1.5 block text-sm font-semibold text-slate-200">
                {pricingStrings.inspectionAddress}
              </label>
              <input
                id="quote-address"
                name="address"
                type="text"
                autoComplete="street-address"
                maxLength={160}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className={inputCls}
                aria-describedby="quote-address-hint"
              />
              <p id="quote-address-hint" className="mt-1 text-xs text-slate-400">{pricingStrings.inspectionAddressHint}</p>
            </div>
            <div>
              <label htmlFor="quote-window" className="mb-1.5 block text-sm font-semibold text-slate-200">
                {pricingStrings.preferredWindow}
              </label>
              <select
                id="quote-window"
                name="preferredWindow"
                value={preferredWindow}
                onChange={(event) => {
                  const parsed = preferredWindowSchema.safeParse(event.target.value);
                  if (parsed.success) setPreferredWindow(parsed.data);
                }}
                className={inputCls}
              >
                {(["anytime", "morning", "afternoon", "evening"] as const).map((value) => (
                  <option key={value} value={value}>{pricingStrings.preferredWindows[value]}</option>
                ))}
              </select>
            </div>

            {/* Honeypot: invisible to people, tempting to bots. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="quote-website">لا تملأ هذا الحقل</label>
              <input
                id="quote-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>
          </form>
        </div>
      ) : null}
    </ModalShell>
  );
}
