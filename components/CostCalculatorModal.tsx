"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  Camera,
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
  CURRENCY,
  PROJECTS,
  PROJECT_TYPE_VALUES,
  TIERS,
  TIER_VALUES,
  computeEstimate,
  formatMoney,
  type Estimate,
  type ProjectType,
  type Tier,
} from "@/lib/pricing";
import { isValidPhone } from "@/lib/validation";

type Step = 1 | 2 | 3 | 4;
type Status = "idle" | "submitting" | "success" | "error";

const STEP_LABELS = ["نوع المشروع", "المعايير الفنية", "مستوى التجهيز", "التقدير والطلب"];

const TYPE_ICONS: Record<ProjectType, LucideIcon> = {
  smart_home: Home,
  industrial_electrical: Factory,
  cctv: Camera,
};

const inputCls =
  "w-full rounded-xl border border-white/10 bg-grid-dark px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-electric-blue focus:outline-none focus:ring-2 focus:ring-electric-blue/40";

export default function CostCalculatorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [area, setArea] = useState(150);
  const [units, setUnits] = useState(30);
  const [tier, setTier] = useState<Tier>("advanced");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [serverEstimate, setServerEstimate] = useState<Estimate | null>(null);

  const project = projectType ? PROJECTS[projectType] : null;
  const estimate = projectType ? computeEstimate({ projectType, area, units, tier }) : null;

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
  };

  const handleClose = () => {
    if (status === "success") reset();
    onClose();
  };

  const selectType = (type: ProjectType) => {
    if (type !== projectType) {
      setProjectType(type);
      setUnits(PROJECTS[type].unitDefault);
    }
  };

  const goNext = () => setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting" || !projectType) return;

    const found: Record<string, string> = {};
    if (fullName.trim().length < 2) found.fullName = "أدخل اسمك الكامل";
    if (!isValidPhone(phone)) found.phone = "أدخل رقم هاتف / واتساب صالحاً";
    if (city.trim().length < 2) found.city = "أدخل اسم المدينة";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setStatus("submitting");
    setMessage("");

    const result = await postJson("/api/quote", {
      projectType,
      area,
      units,
      tier,
      fullName,
      phone,
      city,
      website: honeypot,
    });

    if (result.ok) {
      setServerEstimate(result.estimate ?? estimate);
      setStatus("success");
      setMessage(result.message ?? "تم استلام طلبك.");
    } else {
      setStatus("error");
      setMessage(result.error ?? "حدث خطأ غير متوقع. حاول مرة أخرى.");
      setErrors(firstFieldErrors(result.fieldErrors));
    }
  };

  const submitting = status === "submitting";
  const shownEstimate = serverEstimate ?? estimate;
  const whatsappMessage = project && shownEstimate
    ? [
        "سلام عليكم Voltix Dynamics، أرسل لكم طلب استفسار حول عرض السعر الأولي.",
        `المشروع: ${project.label}`,
        `المساحة: ${formatMoney(area)} م²`,
        `${project.unitLabel}: ${formatMoney(units)}`,
        `مستوى التجهيز: ${TIERS[tier].label}`,
        `السعر التقديري: ${formatMoney(shownEstimate.min)} – ${formatMoney(shownEstimate.max)} ${CURRENCY}`,
        "أرجو التواصل معي لتأكيد التفاصيل وموعد المعاينة.",
        ...(fullName.trim() ? [`الاسم: ${fullName.trim()}`] : []),
        ...(phone.trim() ? [`رقم الهاتف: ${phone.trim()}`] : []),
        ...(city.trim() ? [`المدينة: ${city.trim()}`] : []),
      ].join("\n")
    : "";
  const whatsappHref = createWhatsAppHref(WHATSAPP_BUSINESS_NUMBER, whatsappMessage);

  const printEstimate = () => {
    if (!project || !shownEstimate) return;
    const date = new Intl.DateTimeFormat("ar-DZ", { dateStyle: "long" }).format(new Date());
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
  <h2>العرض الأولي للمشروع</h2>
  <table>
    <tbody>
      <tr><th>الخدمة المختارة</th><td>${project.label}</td></tr>
      <tr><th>المساحة</th><td>${formatMoney(area)} م²</td></tr>
      <tr><th>${project.unitLabel}</th><td>${formatMoney(units)}</td></tr>
      <tr><th>مستوى التجهيز</th><td>${TIERS[tier].label}</td></tr>
    </tbody>
  </table>
  <div class="price">السعر التقديري (DZD)<strong>${formatMoney(shownEstimate.min)} – ${formatMoney(shownEstimate.max)} د.ج</strong></div>
  <p class="legal">ملاحظة قانونية: هذا العرض تقديري أولي وغير ملزم، ولا يُعد عرض سعر نهائياً. يخضع السعر النهائي للمعاينة الميدانية والدراسة الفنية وتحديد نطاق الأعمال والمواد المطلوبة.</p>
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
          <div className="mt-5 rounded-2xl border border-electric-blue/30 bg-electric-blue/5 p-4">
            <p className="text-sm text-slate-400">النطاق التقريبي المرسل مع طلبك</p>
            <p className="mt-1 text-xl font-extrabold text-electric-blue">
              <bdi>{formatMoney(shownEstimate.min)}</bdi> – <bdi>{formatMoney(shownEstimate.max)}</bdi> {CURRENCY}
            </p>
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
                    : "border-white/10 bg-grid-dark hover:border-white/30"
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
                <bdi>{formatMoney(area)}</bdi> م²
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
              <span>{formatMoney(AREA_MAX)} م²</span>
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
        </div>
      ) : null}

      {status !== "success" && step === 3 ? (
        <div role="radiogroup" aria-label="مستوى التجهيز" className="space-y-3">
          {TIER_VALUES.map((value) => {
            const selected = tier === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTier(value)}
                className={`w-full rounded-2xl border p-4 text-right transition ${
                  selected
                    ? "border-electric-blue bg-electric-blue/10 shadow-glow-blue"
                    : "border-white/10 bg-grid-dark hover:border-white/30"
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
      ) : null}

      {status !== "success" && step === 4 && project && estimate ? (
        <div className="space-y-5">
          <div className="estimate-card rounded-2xl border border-electric-blue/30 p-4 text-center">
            <p className="text-sm text-slate-400">النطاق السعري التقريبي</p>
            <p dir="ltr" className="estimate-price mt-1 font-black text-electric-blue">
              <bdi>{formatMoney(estimate.min)}</bdi> – <bdi>{formatMoney(estimate.max)}</bdi>{" "}
              <span className="text-lg font-bold">{CURRENCY}</span>
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              تقدير أولي غير ملزم. يتحدد السعر النهائي بعد المعاينة الميدانية والدراسة الفنية.
            </p>
          </div>

          <button
            type="button"
            onClick={printEstimate}
            className="primary-action flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-electric-blue transition"
          >
            📄 تحميل العرض الأولي (Devis PDF)
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2.5 text-sm font-bold text-[#75f0a2] transition hover:bg-[#25D366]/20"
          >
            💬 إرسال عرض السعر والطلب عبر واتساب
          </a>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="readout rounded-xl p-3">
              <dt className="text-slate-400">المشروع</dt>
              <dd className="mt-0.5 font-semibold text-white">{project.label}</dd>
            </div>
            <div className="readout rounded-xl p-3">
              <dt className="text-slate-400">المساحة</dt>
              <dd className="mt-0.5 font-semibold text-white">
                <bdi>{formatMoney(area)}</bdi> م²
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
            <p className="text-base font-bold text-white">أرسل طلب الدراسة الفنية</p>

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
              <label htmlFor="quote-city" className="mb-1.5 block text-sm font-semibold text-slate-200">
                المدينة
              </label>
              <input
                id="quote-city"
                name="city"
                type="text"
                autoComplete="address-level2"
                maxLength={60}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                aria-invalid={Boolean(errors.city)}
                aria-describedby={errors.city ? "quote-city-err" : undefined}
                className={inputCls}
              />
              {errors.city ? (
                <p id="quote-city-err" className="mt-1 text-sm text-red-300">
                  {errors.city}
                </p>
              ) : null}
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
