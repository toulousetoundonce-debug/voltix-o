"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LocateFixed,
  Phone,
  Siren,
  Video,
  Mic,
} from "lucide-react";
import ModalShell from "./ModalShell";
import { firstFieldErrors, postJson } from "@/lib/client";
import { SITE } from "@/lib/site";
import { createWhatsAppHref, WHATSAPP_SOS_NUMBER } from "@/lib/whatsapp";
import {
  EMERGENCY_LABELS,
  EMERGENCY_VALUES,
  SOS_DESCRIPTION_MAX_LENGTH,
  isValidPhone,
  type EmergencyType,
} from "@/lib/validation";

type GeoState = "idle" | "loading" | "ok" | "failed" | "unsupported";
type Status = "idle" | "submitting" | "success" | "error";

interface Coords {
  lat: number;
  lng: number;
  accuracy: number;
}

interface VoiceAnalysis {
  summary: string;
  urgency: "high" | "medium" | "low";
  category: "industrial" | "smart-home" | "cctv" | "electrical-fault";
  safetyAdvice: string;
}

interface VoiceApiResult {
  ok: boolean;
  error?: string;
  transcript?: string;
  analysis?: VoiceAnalysis;
  usedFallback?: boolean;
  usedFallbackModel?: boolean;
}

interface ImageAnalysis {
  diagnosis: string;
  riskLevel: "خطر مرتفع" | "متوسط" | "عادي";
  recommendation: string;
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-grid-dark px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-sos-red focus:outline-none focus:ring-2 focus:ring-sos-red/40";

async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("اختر ملف صورة صالحاً.");
  if (file.size > 15 * 1024 * 1024) throw new Error("حجم الصورة الأصلية يجب ألا يتجاوز 15 ميغابايت.");
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذّر تجهيز الصورة في المتصفح.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL("image/jpeg", 0.78);
    if (compressed.length > 7 * 1024 * 1024) throw new Error("الصورة كبيرة بعد الضغط؛ اختر صورة أصغر.");
    return compressed;
  } finally {
    image.close();
  }
}

export default function SosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [emergencyType, setEmergencyType] = useState<EmergencyType | "">("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceAnalysis, setVoiceAnalysis] = useState<VoiceAnalysis | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageMessage, setImageMessage] = useState("");
  const [imageNotice, setImageNotice] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [imageMode, setImageMode] = useState<"gemini" | "manual-review" | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(
    () => () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const reset = () => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    setFullName("");
    setPhone("");
    setDescription("");
    setEmergencyType("");
    setCoords(null);
    setGeo("idle");
    setHoneypot("");
    setErrors({});
    setStatus("idle");
    setMessage("");
    setRecording(false);
    setVoiceBusy(false);
    setVoiceMessage("");
    setVoiceTranscript("");
    setVoiceAnalysis(null);
    setImageBusy(false);
    setImageMessage("");
    setImageNotice("");
    setImagePreview("");
    setImageAnalysis(null);
    setImageMode(null);
  };

  const handleClose = () => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    setRecording(false);
    if (status === "success") reset();
    onClose();
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setRecording(false);
  };

  const startOrStopRecording = async () => {
    if (recording) {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceMessage("المتصفح لا يدعم تسجيل الصوت. يمكنك كتابة وصف العطل يدوياً.");
      return;
    }

    setVoiceMessage("");
    setVoiceAnalysis(null);
    setVoiceTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const supportedType = supportedTypes.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!openRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const recorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        setVoiceMessage("حدث خطأ أثناء التسجيل. تحقق من إذن الميكروفون وحاول مجدداً.");
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        setRecording(false);
        const mimeType = (recorder.mimeType || chunks[0] instanceof Blob && chunks[0].type || "").split(";")[0].toLowerCase();
        const extension = mimeType === "audio/mp4"
          ? "m4a"
          : mimeType === "audio/webm"
            ? "webm"
            : mimeType === "audio/ogg"
              ? "ogg"
              : mimeType === "audio/wav" || mimeType === "audio/x-wav"
                ? "wav"
                : "";
        const audioBlob = new Blob(chunks, { type: mimeType });
        if (!audioBlob.size) {
          setVoiceMessage("لم يتم التقاط صوت. حاول التسجيل مجدداً.");
          return;
        }
        if (!extension) {
          setVoiceMessage(`صيغة التسجيل ${mimeType || "غير معروفة"} غير مدعومة للإرسال. استخدم متصفحاً يدعم WebM أو MP4.`);
          return;
        }
        const form = new FormData();
        form.append("audio", audioBlob, `recording.${extension}`);
        setVoiceBusy(true);
        try {
          const response = await fetch("/api/voice-sos", { method: "POST", body: form });
          const result = (await response.json().catch(() => null)) as VoiceApiResult | null;
          if (!result) {
            throw new Error("تعذّرت قراءة رد خدمة الصوت. حاول مجدداً أو اكتب وصف العطل يدوياً.");
          }
          if (!response.ok || !result.ok || !result.transcript || !result.analysis) {
            throw new Error(result.error ?? "تعذّر تحليل التسجيل.");
          }
          const transcript = result.transcript.slice(0, SOS_DESCRIPTION_MAX_LENGTH);
          setVoiceTranscript(transcript);
          setVoiceAnalysis(result.analysis);
          setDescription(transcript);
          setVoiceMessage(
            result.usedFallback
              ? "تم تفريغ التسجيل، لكن التحليل الآلي غير مكتمل؛ أُضيف النص إلى البلاغ مع تنبيه أمان احترازي."
              : result.usedFallbackModel
                ? "تم تفريغ التسجيل وتحليله بنموذج بديل متاح. أُضيف النص إلى تفاصيل البلاغ."
                : "تم تفريغ التسجيل وتحليله. أُضيف النص إلى تفاصيل البلاغ.",
          );
        } catch (error) {
          setVoiceMessage(
            error instanceof TypeError
              ? "تعذّر الاتصال بخدمة الصوت. تحقق من الإنترنت واكتب وصف العطل يدوياً إذا استمر الأمر."
              : error instanceof Error
                ? error.message
                : "تعذّر إرسال التسجيل.",
          );
        } finally {
          setVoiceBusy(false);
        }
      };
      recorder.start();
      setRecording(true);
      recordingTimerRef.current = setTimeout(() => stopRecording(), 15_000);
    } catch {
      setVoiceMessage("تعذّر الوصول إلى الميكروفون. اسمح باستخدامه أو اكتب وصف العطل يدوياً.");
    }
  };

  const inspectImage = async (file: File | undefined) => {
    if (!file) return;
    setImageBusy(true);
    setImageMessage("");
    setImageNotice("");
    setImageAnalysis(null);
    setImageMode(null);
    try {
      const imageBase64 = await compressImage(file);
      setImagePreview(imageBase64);
      const response = await fetch("/api/vision-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, emergencyType: emergencyType || undefined }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok: boolean;
        error?: string;
        result?: ImageAnalysis;
        mode?: string;
        message?: string;
      } | null;
      if (!result) {
        throw new Error("تعذّرت قراءة رد خدمة الصور. احتفظ بالصورة وأعد المحاولة أو أرسل البلاغ للمراجعة.");
      }
      if (!response.ok || !result.ok || !result.result) {
        throw new Error(result.error ?? "تعذّر فحص الصورة.");
      }
      setImageAnalysis(result.result);
      setImageMode(result.mode === "manual-review" ? "manual-review" : "gemini");
      setImageNotice(
        result.mode === "manual-review"
          ? result.message ?? "ستُرفق الصورة للمراجعة الهندسية عند إرسال بلاغ SOS."
          : "",
      );
      setImageMessage("");
    } catch (error) {
      setImageMessage(
        error instanceof TypeError
          ? "تعذّر الاتصال بخدمة الصور. احتفظ بالصورة وأعد المحاولة أو أرسل البلاغ للمراجعة."
          : error instanceof Error
            ? error.message
            : "تعذّر تجهيز الصورة.",
      );
    } finally {
      setImageBusy(false);
    }
  };

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeo("unsupported");
      return;
    }
    setGeo("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        });
        setGeo("ok");
      },
      () => {
        setCoords(null);
        setGeo("failed");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2) next.fullName = "أدخل اسمك الكامل";
    if (!isValidPhone(phone)) next.phone = "أدخل رقم هاتف صالحاً";
    if (!emergencyType) next.emergencyType = "اختر نوع الطوارئ";
    return next;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") return;

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setStatus("submitting");
    setMessage("");

    const result = await postJson("/api/sos", {
      fullName,
      phone,
      description,
      emergencyType,
      aiDiagnosis: [
        imageAnalysis
          ? `تشخيص الصورة (${imageAnalysis.riskLevel}): ${imageAnalysis.diagnosis}. التوصية: ${imageAnalysis.recommendation}`
          : "",
        voiceAnalysis
          ? `تحليل الصوت (${voiceAnalysis.urgency}): ${voiceAnalysis.summary}. نصيحة الأمان: ${voiceAnalysis.safetyAdvice}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 1_500),
      voiceTranscript,
      imageBase64: imagePreview || undefined,
      location: coords ? { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy } : null,
      website: honeypot,
    });

    if (result.ok) {
      setStatus("success");
      setMessage(
        [
          result.message ?? "تم استلام بلاغ الطوارئ.",
          ...(result.imageAttachmentError ? [`تنبيه: لم تُرسل الصورة للمراجعة الفنية: ${result.imageAttachmentError}`] : []),
        ].join(" "),
      );
    } else {
      setStatus("error");
      setMessage(result.error ?? "حدث خطأ غير متوقع. حاول مرة أخرى.");
      setErrors(firstFieldErrors(result.fieldErrors));
    }
  };

  const submitting = status === "submitting";
  const whatsappMessage = [
    "بلاغ طوارئ جديد إلى Voltix Dynamics",
    `الاسم: ${fullName.trim() || "غير مذكور"}`,
    `رقم الهاتف: ${phone.trim() || "غير مذكور"}`,
    `نوع الطوارئ: ${emergencyType ? EMERGENCY_LABELS[emergencyType] : "غير محدد"}`,
    `وصف المشكلة: ${description.trim() || "لا يوجد وصف إضافي"}`,
    ...(imagePreview ? ["أرفقت صورة للوحة/العطل في نموذج البلاغ؛ سأرسلها هنا أيضاً."] : []),
    ...(coords ? [`الموقع: https://www.google.com/maps?q=${coords.lat},${coords.lng}`] : []),
    ...(imageAnalysis
      ? [`تشخيص الصورة: ${imageAnalysis.diagnosis}`, `التوصية: ${imageAnalysis.recommendation}`]
      : []),
    ...(voiceAnalysis ? [`ملخص التسجيل: ${voiceAnalysis.summary}`] : []),
  ].join("\n");
  const whatsappHref = createWhatsAppHref(WHATSAPP_SOS_NUMBER, whatsappMessage);

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
      <div className="space-y-2">
        <button
          type="submit"
          form="sos-form"
          disabled={submitting || voiceBusy || imageBusy || recording}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-sos-red px-5 py-3.5 text-base font-extrabold text-white shadow-glow-red transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              جارٍ الإرسال...
            </>
          ) : voiceBusy || imageBusy || recording ? (
            "أكمل التسجيل أو الفحص قبل الإرسال"
          ) : (
            <>
              <Siren className="h-5 w-5" aria-hidden="true" />
              إرسال بلاغ الطوارئ
            </>
          )}
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2.5 text-sm font-bold text-[#75f0a2] transition hover:bg-[#25D366]/20"
        >
          💬 إرسال البلاغ عبر واتساب مباشرة
        </a>
        {imagePreview ? (
          <p className="text-center text-xs text-slate-400">
            أرفق الصورة يدوياً داخل محادثة واتساب؛ لا يمكن فتحها تلقائياً عبر رابط الرسالة.
          </p>
        ) : null}
      </div>
    );

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="تدخل طوارئ فوري"
      titleId="sos-title"
      subtitle="أرسل بياناتك وسيتصل بك فريق Voltix Dynamics في أسرع وقت."
      accent="red"
      icon={<Siren className="h-7 w-7 text-sos-red" aria-hidden="true" />}
      footer={footer}
      scrollKey={status}
    >
      {status === "success" ? (
        <div className="py-6 text-center" role="status">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" aria-hidden="true" />
          <p className="mt-4 text-lg font-bold text-white">{message}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            أبقِ هاتفك قريباً. وإن كان هناك خطر مباشر على الأرواح فاتصل بخدمات الإنقاذ المحلية أولاً.
          </p>
          {SITE.phoneHref ? (
            <a
              href={SITE.phoneHref}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-bold text-white transition hover:bg-white/10"
            >
              <Phone className="h-5 w-5" aria-hidden="true" />
              اتصل بنا مباشرة
            </a>
          ) : null}
        </div>
      ) : (
        <form id="sos-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <p className="flex gap-2 rounded-xl border border-sos-red/30 bg-sos-red/10 p-3 text-sm leading-relaxed text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sos-red" aria-hidden="true" />
            عند وجود شرر أو دخان أو رائحة احتراق: ابتعد عن مصدر الخطر وافصل التيار إن كان ذلك آمناً، ثم اتصل بخدمات الإنقاذ المحلية.
          </p>

          {status === "error" && message ? (
            <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
              <p>{message}</p>
              {SITE.phoneHref ? (
                <a href={SITE.phoneHref} className="mt-2 inline-flex min-h-11 items-center font-bold underline underline-offset-4">
                  اتصل بنا مباشرة إذا كانت الحالة عاجلة
                </a>
              ) : null}
            </div>
          ) : null}

          <section className="surface space-y-3 rounded-2xl p-4" aria-label="المساعدة الذكية للبلاغ">
            <div>
              <button
                type="button"
                onClick={startOrStopRecording}
                disabled={voiceBusy}
                className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition disabled:opacity-60 ${
                  recording
                    ? "border-sos-red/50 bg-sos-red/15 text-red-100"
                    : "border-white/15 text-white hover:bg-white/10"
                }`}
              >
                {voiceBusy ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Mic className="h-5 w-5 text-electric-blue" aria-hidden="true" />
                )}
                {voiceBusy
                  ? "جارٍ تحليل التسجيل..."
                  : recording
                    ? "إيقاف التسجيل وإرساله"
                    : "🎤 اشرح العطل بصوتك (15 ثانية)"}
              </button>
              {voiceMessage ? (
                <p role="status" className="mt-2 rounded-lg bg-white/5 p-2.5 text-sm text-slate-300">
                  {voiceMessage}
                </p>
              ) : null}
              {voiceAnalysis ? (
                <div className="mt-2 space-y-2 rounded-xl border border-electric-blue/25 bg-electric-blue/5 p-3 text-sm">
                  <p className="font-bold text-electric-blue">ملخص البلاغ: {voiceAnalysis.summary}</p>
                  <p className="leading-relaxed text-amber-100">
                    نصيحة الأمان الفورية: {voiceAnalysis.safetyAdvice}
                  </p>
                  <p className="text-slate-400">مستوى الاستعجال: {voiceAnalysis.urgency}</p>
                </div>
              ) : null}
            </div>

            <div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                aria-label="اختر أو التقط صورة للوحة الكهربائية"
                onChange={(event) => {
                  void inspectImage(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                {imageBusy ? (
                  <Loader2 className="h-5 w-5 animate-spin text-electric-blue" aria-hidden="true" />
                ) : (
                  <Video className="h-5 w-5 text-electric-blue" aria-hidden="true" />
                )}
                {imageBusy ? "جارٍ ضغط الصورة وفحصها..." : "📷 فحص ذكي للوحة الكهرباء / العطل"}
              </button>
              {imageMessage ? (
                <p role="alert" className="mt-2 rounded-lg bg-amber-500/10 p-2.5 text-sm text-amber-100">
                  {imageMessage}
                </p>
              ) : null}
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="الصورة المختارة لفحص العطل الكهربائي"
                  className="mt-3 aspect-video max-h-56 w-full rounded-xl border border-white/10 object-contain"
                />
              ) : null}
              {imageAnalysis ? (
                <div className="mt-3 space-y-2 rounded-xl border border-electric-blue/25 bg-electric-blue/5 p-3 text-sm">
                  <h3 className="font-bold text-electric-blue">
                    {imageMode === "manual-review"
                      ? "إرشادات أمان أولية قبل المراجعة الهندسية"
                      : "نتيجة تحليل الصورة عبر Gemini"}
                  </h3>
                  <p className="leading-relaxed text-slate-200">{imageAnalysis.diagnosis}</p>
                  <p className="font-semibold text-amber-100">مستوى الخطر: {imageAnalysis.riskLevel}</p>
                  <p className="leading-relaxed text-slate-300">{imageAnalysis.recommendation}</p>
                  <p className="text-xs leading-relaxed text-slate-500">
                    الفحص عن بُعد أولي. لا تفتح اللوحة ولا تلمس الأسلاك؛ انتظر فحص مهندس مؤهل.
                  </p>
                  {imageNotice ? (
                    <p role="status" className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-2 text-xs leading-relaxed text-amber-100">
                      {imageNotice}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <div>
            <label htmlFor="sos-description" className="mb-1.5 block text-sm font-semibold text-slate-200">
              وصف المشكلة
            </label>
            <textarea
              id="sos-description"
              name="description"
              rows={3}
              maxLength={SOS_DESCRIPTION_MAX_LENGTH}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={inputCls}
              placeholder="صف العطل باختصار، أو استخدم التسجيل الصوتي لتعبئة الحقل تلقائياً."
            />
          </div>

          <div>
            <label htmlFor="sos-name" className="mb-1.5 block text-sm font-semibold text-slate-200">
              الاسم الكامل
            </label>
            <input
              id="sos-name"
              name="fullName"
              type="text"
              autoComplete="name"
              maxLength={80}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? "sos-name-err" : undefined}
              className={inputCls}
              placeholder="مثال: محمد العلمي"
            />
            {errors.fullName ? (
              <p id="sos-name-err" className="mt-1 text-sm text-red-300">
                {errors.fullName}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="sos-phone" className="mb-1.5 block text-sm font-semibold text-slate-200">
              رقم الهاتف
            </label>
            <input
              id="sos-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              maxLength={25}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "sos-phone-err" : undefined}
              className={`${inputCls} text-left`}
              placeholder="0550 00 00 00"
            />
            <p className="mt-1 text-xs text-slate-400">اكتب رقمك المحلي كما تستعمله عادةً، مثال: 0550 00 00 00.</p>
            {errors.phone ? (
              <p id="sos-phone-err" className="mt-1 text-sm text-red-300">
                {errors.phone}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="sos-type" className="mb-1.5 block text-sm font-semibold text-slate-200">
              نوع الطوارئ
            </label>
            <select
              id="sos-type"
              name="emergencyType"
              value={emergencyType}
              onChange={(e) => setEmergencyType(e.target.value as EmergencyType | "")}
              aria-invalid={Boolean(errors.emergencyType)}
              aria-describedby={errors.emergencyType ? "sos-type-err" : undefined}
              className={inputCls}
            >
              <option value="">اختر نوع الطوارئ...</option>
              {EMERGENCY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {EMERGENCY_LABELS[value]}
                </option>
              ))}
            </select>
            {errors.emergencyType ? (
              <p id="sos-type-err" className="mt-1 text-sm text-red-300">
                {errors.emergencyType}
              </p>
            ) : null}
          </div>

          <div>
            <button
              type="button"
              onClick={requestLocation}
              disabled={geo === "loading"}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              {geo === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <LocateFixed className="h-5 w-5 text-electric-blue" aria-hidden="true" />
              )}
              {geo === "ok" ? "تحديث موقعي الجغرافي" : "إرفاق موقعي الجغرافي (اختياري)"}
            </button>
            <p className="mt-1.5 min-h-5 text-sm" role="status" aria-live="polite">
              {geo === "ok" && coords ? (
                <span className="text-emerald-300">تم التقاط الموقع (دقة تقريبية ±{coords.accuracy} م)</span>
              ) : null}
              {geo === "failed" ? (
                <span className="text-amber-300">تعذّر الحصول على الموقع. يمكنك المتابعة بدونه.</span>
              ) : null}
              {geo === "unsupported" ? (
                <span className="text-amber-300">المتصفح لا يدعم تحديد الموقع.</span>
              ) : null}
            </p>
          </div>

          {/* Honeypot: invisible to people, tempting to bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="sos-website">لا تملأ هذا الحقل</label>
            <input
              id="sos-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>
        </form>
      )}
    </ModalShell>
  );
}
