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
  Factory,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ModalShell from "./ModalShell";
import { firstFieldErrors, postJson } from "@/lib/client";
import { SITE } from "@/lib/site";
import { createWhatsAppHref, WHATSAPP_SOS_NUMBER } from "@/lib/whatsapp";
import { uploadFaultImage } from "@/lib/supabase-storage";
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

const EMERGENCY_ICONS: Record<EmergencyType, LucideIcon> = {
  industrial_line_down: Factory,
  dangerous_short_circuit: Zap,
  security_system_down: Video,
  control_panel_fault: Siren,
};
const MAX_COMPRESSED_IMAGE_BYTES = 150 * 1024;
const MAX_AUDIO_BYTES = Math.floor(5.5 * 1024 * 1024);
const AUDIO_WARNING_BYTES = Math.floor(4.5 * 1024 * 1024);

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("تعذّر تجهيز معاينة الصورة.")));
    reader.onerror = () => reject(new Error("تعذّر تجهيز معاينة الصورة."));
    reader.readAsDataURL(blob);
  });
}

async function compressImage(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  if (!file.type.startsWith("image/")) throw new Error("اختر ملف صورة صالحاً.");
  if (file.size > 15 * 1024 * 1024) throw new Error("حجم الصورة الأصلية يجب ألا يتجاوز 15 ميغابايت.");
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذّر تجهيز الصورة في المتصفح.");

    let scale = Math.min(1, 1280 / Math.max(image.width, image.height));
    for (let resize = 0; resize < 8; resize += 1) {
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (let quality = 0.88; quality >= 0.4; quality -= 0.08) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
        if (blob?.type === "image/webp" && blob.size <= MAX_COMPRESSED_IMAGE_BYTES) {
          return { blob, dataUrl: await blobToDataUrl(blob) };
        }
      }
      scale *= 0.82;
    }
    throw new Error("تعذّر ضغط الصورة إلى أقل من 150 كيلوبايت. اختر صورة أصغر أو أوضح.");
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
  const [imageUrl, setImageUrl] = useState("");
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [imageMode, setImageMode] = useState<"automated" | "manual-review" | null>(null);
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
    setImageUrl("");
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
      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 32_000,
        ...(supportedType ? { mimeType: supportedType } : {}),
      };
      const recorder = new MediaRecorder(stream, recorderOptions);
      const chunks: BlobPart[] = [];
      let recordedBytes = 0;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          recordedBytes += event.data.size;
          if (recordedBytes > AUDIO_WARNING_BYTES && recordedBytes <= MAX_AUDIO_BYTES) {
            setVoiceMessage("التسجيل طويل، الرجاء إيقافه أو تقصيره.");
          }
          if (recordedBytes > MAX_AUDIO_BYTES && recorder.state !== "inactive") {
            setVoiceMessage("تجاوز التسجيل الحد المسموح؛ جارٍ إيقافه.");
            recorder.stop();
          }
        }
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
        if (audioBlob.size > MAX_AUDIO_BYTES) {
          setVoiceMessage("حجم التسجيل يتجاوز الحد المسموح (5.5 ميبيبايت). اختصر التسجيل وحاول مجدداً.");
          return;
        }
        if (!extension) {
          setVoiceMessage(`صيغة التسجيل ${mimeType || "غير معروفة"} غير مدعومة للإرسال. استخدم متصفحاً يدعم WebM أو MP4.`);
          return;
        }
        const form = new FormData();
        form.append("audio", audioBlob, `recording.${extension}`);
        if (phone.trim()) form.append("phone", phone.trim());
        if (emergencyType) form.append("emergencyType", emergencyType);
        if (description.trim()) form.append("description", description.trim());
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
              ? "تم تفريغ التسجيل، لكن التحليل غير مكتمل؛ أُضيف النص إلى البلاغ مع تنبيه أمان احترازي."
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
      recorder.start(1_000);
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
    setImagePreview("");
    setImageAnalysis(null);
    setImageMode(null);
    setImageUrl("");
    try {
      const compressed = await compressImage(file);
      setImagePreview(compressed.dataUrl);
      const uploadedImageUrl = await uploadFaultImage(compressed.blob);
      setImageUrl(uploadedImageUrl ?? "");
      const response = await fetch("/api/vision-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(uploadedImageUrl ? { imageUrl: uploadedImageUrl } : { imageBase64: compressed.dataUrl }),
          emergencyType: emergencyType || undefined,
          description: description || undefined,
        }),
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
      setImageMode(result.mode === "manual-review" ? "manual-review" : "automated");
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
    if (!isValidPhone(phone)) next.phone = "أدخل رقم هاتف صالحاً";
    if (!emergencyType) next.emergencyType = "اختر نوع الطوارئ";
    return next;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting" || imageBusy || voiceBusy || recording) return;

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
      ...(imageUrl ? { imageUrl } : { imageBase64: imagePreview || undefined }),
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
  const directDanger =
    emergencyType === "dangerous_short_circuit" ||
    /شرر|دخان|حريق|احتراق|يحترق|صعق|ماس|انفجار/.test(description);

  const footer =
    status === "success" ? (
      <button
        type="button"
        onClick={handleClose}
        className="sos-pro-submit"
      >
        إغلاق
      </button>
    ) : (
      <div className="sos-pro-footer-actions">
        <button
          type="submit"
          form="sos-form"
          disabled={submitting || voiceBusy || imageBusy || recording}
          className="sos-pro-submit"
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
          className="sos-pro-whatsapp"
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
      panelClassName="sos-modal-pro"
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
        <form id="sos-form" onSubmit={onSubmit} noValidate className="sos-pro-form">
          <div className={`sos-pro-safety${directDanger ? " is-danger" : ""}`} role={directDanger ? "alert" : "note"}>
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <strong>{directDanger ? "خطر مباشر: تصرّف الآن" : "سلامتك أولاً"}</strong>
              <p>
                {directDanger
                  ? "ابتعد عن المكان ولا تلمس أي سلك أو جهاز. افصل التيار إن كان ذلك آمناً، واتصل بخدمات الإنقاذ المحلية قبل إكمال البلاغ."
                  : "عند وجود شرر أو دخان أو رائحة احتراق، ابتعد عن مصدر الخطر وافصل التيار إن كان ذلك آمناً، ثم اتصل بخدمات الإنقاذ المحلية."}
              </p>
            </div>
          </div>

          {status === "error" && message ? (
            <div role="alert" className="sos-pro-error">
              <p>{message}</p>
              {SITE.phoneHref ? (
                <a href={SITE.phoneHref} className="mt-2 inline-flex min-h-11 items-center font-bold underline underline-offset-4">
                  اتصل بنا مباشرة إذا كانت الحالة عاجلة
                </a>
              ) : null}
            </div>
          ) : null}

          <fieldset className="sos-pro-fieldset">
            <legend className="sos-pro-label">
              ما نوع الطوارئ؟ <span className="text-sos-red">*</span>
            </legend>
            <div className="sos-pro-types">
              {EMERGENCY_VALUES.map((value) => {
                const Icon = EMERGENCY_ICONS[value];
                const selected = emergencyType === value;
                return (
                  <label
                    key={value}
                    className={`sos-pro-type${value === "dangerous_short_circuit" ? " is-danger" : ""}${selected ? " is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="emergencyType"
                      value={value}
                      checked={selected}
                      aria-invalid={Boolean(errors.emergencyType)}
                      aria-describedby={errors.emergencyType ? "sos-type-err" : undefined}
                      onChange={() => {
                        setEmergencyType(value);
                        setErrors((previous) => ({ ...previous, emergencyType: "" }));
                      }}
                    />
                    <span className="sos-pro-type-card">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                      <span>{EMERGENCY_LABELS[value]}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.emergencyType ? (
              <p id="sos-type-err" className="sos-pro-field-error">
                {errors.emergencyType}
              </p>
            ) : null}
          </fieldset>

          <div>
            <label htmlFor="sos-phone" className="sos-pro-label">
              رقم هاتفك <span className="text-sos-red">*</span>
            </label>
            <input
              id="sos-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              maxLength={25}
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "sos-phone-err" : "sos-phone-hint"}
              className="sos-pro-input text-left"
              placeholder="0550 00 00 00"
            />
            <p id="sos-phone-hint" className="sos-pro-hint">
              سنتصل بك على هذا الرقم. اكتبه كما تستعمله عادةً.
            </p>
            {errors.phone ? (
              <p id="sos-phone-err" className="sos-pro-field-error">
                {errors.phone}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="sos-name" className="sos-pro-label">
              الاسم <span className="text-slate-400">(اختياري)</span>
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
              className="sos-pro-input"
              placeholder="مثال: محمد العلمي"
            />
            {errors.fullName ? (
              <p id="sos-name-err" className="sos-pro-field-error">{errors.fullName}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="sos-description" className="sos-pro-label">
              تفاصيل تساعدنا على الوصول أسرع <span className="text-slate-400">(اختياري)</span>
            </label>
            <textarea
              id="sos-description"
              name="description"
              rows={3}
              maxLength={SOS_DESCRIPTION_MAX_LENGTH}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="sos-pro-input resize-y"
              placeholder="صف العطل باختصار..."
            />
          </div>

          <section className="sos-pro-assist" aria-label="أدوات إضافية للبلاغ">
            <p className="sos-pro-assist-title">أضف معلومات تساعد الفريق</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={startOrStopRecording}
                disabled={voiceBusy}
                className={`sos-pro-tool ${
                  recording
                    ? "is-recording"
                    : ""
                }`}
              >
                {voiceBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden="true" />
                )}
                {voiceBusy
                  ? "جارٍ تحليل التسجيل..."
                  : recording
                    ? "إيقاف التسجيل وإرساله"
                    : "صوت"}
              </button>
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
                aria-busy={imageBusy}
                className="sos-pro-tool"
              >
                {imageBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Video className="h-4 w-4" aria-hidden="true" />
                )}
                {imageBusy ? "جارٍ الفحص..." : "صورة"}
              </button>
              <button
                type="button"
                onClick={requestLocation}
                disabled={geo === "loading"}
                className="sos-pro-tool"
              >
                {geo === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LocateFixed className="h-4 w-4" aria-hidden="true" />
                )}
                {geo === "ok" ? "تم تحديد موقعي" : "موقعي"}
              </button>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              تُضغط الصورة إلى WebP أقل من 150 كيلوبايت. عند ضبط Supabase تُرفع إلى مساحة عامة ليتمكن محرك التحليل وفريق الصيانة من عرضها؛ تجنّب إظهار بيانات شخصية فيها.
            </p>
            {imageBusy ? (
              <p role="status" aria-live="polite" className="sos-pro-assist-message">
                جارٍ تحليل الصورة...
              </p>
            ) : null}
            {voiceMessage ? (
              <p role="status" className="sos-pro-assist-message">{voiceMessage}</p>
            ) : null}
            {voiceAnalysis ? (
              <div className="sos-pro-analysis">
                <p className="font-bold text-electric-blue">ملخص البلاغ: {voiceAnalysis.summary}</p>
                <p className="leading-relaxed text-amber-100">نصيحة الأمان الفورية: {voiceAnalysis.safetyAdvice}</p>
                <p className="text-slate-400">مستوى الاستعجال: {voiceAnalysis.urgency}</p>
              </div>
            ) : null}
              {imageMessage ? (
                <p role="alert" className="sos-pro-assist-message is-warning">
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
                <div className="sos-pro-analysis">
                  <h3 className="font-bold text-electric-blue">
                    {imageMode === "manual-review"
                      ? "إرشادات أمان أولية قبل المراجعة الهندسية"
                      : "نتيجة الفحص الأولي للصورة"}
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
          </section>

          <div>
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
