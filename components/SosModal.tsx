"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CircleHelp,
  Flame,
  Loader2,
  LocateFixed,
  MapPin,
  Phone,
  PlugZap,
  Power,
  Siren,
  Trash2,
  Video,
  Mic,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ModalShell from "./ModalShell";
import { firstFieldErrors, postJson } from "@/lib/client";
import { createMapsCoordinatesHref, EMERGENCY_SERVICES_PHONE, SITE } from "@/lib/site";
import {
  GPS_CACHE_MAX_AGE_MS,
  GPS_CAPTURE_MAX_WAIT_MS,
  GPS_DRAFT_MAX_AGE_MS,
  isFreshAccurateGpsFix,
} from "@/lib/geolocation";
import { uploadFaultImage } from "@/lib/supabase-storage";
import {
  EMERGENCY_VALUES,
  SOS_DESCRIPTION_MAX_LENGTH,
  type EmergencyType,
} from "@/lib/validation";
import {
  classifyEmergencySeverity,
  emergencyLocaleSchema,
  emergencyPhoneSchema,
  legacyVoiceAnalysisSchema,
  voiceApiResponseSchema,
  type EmergencyLocale,
} from "@/lib/emergency-voice";
import { emergencyArabicError, emergencyStrings } from "@/lib/emergency-strings";
import { z } from "zod";

type GeoState = "idle" | "loading" | "ok" | "failed" | "unsupported";
type Status = "idle" | "submitting" | "success" | "error";

interface Coords {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: number;
}

interface VoiceAnalysis {
  summary: string;
  urgency: "high" | "medium" | "low";
  category: "industrial" | "smart-home" | "cctv" | "electrical-fault";
  safetyAdvice: string;
}

interface ImageAnalysis {
  diagnosis: string;
  riskLevel: "خطر مرتفع" | "متوسط" | "عادي";
  recommendation: string;
}

type EmergencyOption = (typeof emergencyStrings.emergencyTypes)[number]["id"];
type VoiceStatus = "idle" | "listening" | "processing" | "error";

const EMERGENCY_TYPE_BY_OPTION: Record<EmergencyOption, EmergencyType> = {
  power: "industrial_line_down",
  short: "dangerous_short_circuit",
  fire: "dangerous_short_circuit",
  shock: "dangerous_short_circuit",
  security: "security_system_down",
  other: "control_panel_fault",
};

const EMERGENCY_ICONS: Record<EmergencyOption, LucideIcon> = {
  power: Power,
  short: PlugZap,
  fire: Flame,
  shock: Zap,
  security: Video,
  other: CircleHelp,
};

const MAX_COMPRESSED_IMAGE_BYTES = 150 * 1024;
const MAX_AUDIO_BYTES = Math.floor(5.5 * 1024 * 1024);
const AUDIO_WARNING_BYTES = Math.floor(4.5 * 1024 * 1024);
const DRAFT_KEY = "voltix-emergency-draft";
const LOCALE_KEY = "voltix-emergency-voice-locale";

interface SpeechAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechResultLike extends ArrayLike<SpeechAlternativeLike> {
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onspeechend: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(1_000_000),
  capturedAt: z.number().int().positive().optional(),
});

const sosSuccessResponseSchema = z.object({
  ok: z.literal(true),
  message: z.string().max(500).optional(),
  referenceId: z.string().regex(/^VX-\d{6}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/),
  safetyAdvice: z.array(z.string().trim().min(1).max(300)).max(3),
});

const draftSchema = z.object({
  fullName: z.string().max(80),
  phone: z.string().max(40),
  description: z.string().max(SOS_DESCRIPTION_MAX_LENGTH),
  emergencyType: z.enum(EMERGENCY_VALUES).or(z.literal("")),
  emergencyOption: z.enum(["power", "short", "fire", "shock", "security", "other"]).or(z.literal("")),
  coords: coordsSchema.nullable(),
  voiceTranscript: z.string().max(SOS_DESCRIPTION_MAX_LENGTH),
  voiceLocale: emergencyLocaleSchema,
  imagePreview: z.string().max(300_000),
  imageUrl: z.string().max(2_048),
  requestId: z.string().uuid().optional(),
});

const imageAnalysisResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  result: z.object({
    diagnosis: z.string(),
    riskLevel: z.enum([
      emergencyStrings.errors.imageDangerHigh,
      emergencyStrings.errors.imageDangerMedium,
      emergencyStrings.errors.imageDangerNormal,
    ]),
    recommendation: z.string(),
  }).optional(),
  mode: z.string().optional(),
  message: z.string().optional(),
});

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error(emergencyStrings.errors.imagePreview)));
    reader.onerror = () => reject(new Error(emergencyStrings.errors.imagePreview));
    reader.readAsDataURL(blob);
  });
}

async function compressImage(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  if (!file.type.startsWith("image/")) throw new Error(emergencyStrings.errors.imageInvalid);
  if (file.size > 15 * 1024 * 1024) throw new Error(emergencyStrings.errors.imageOriginalTooLarge);
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error(emergencyStrings.errors.imagePrepare);

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
    throw new Error(emergencyStrings.errors.imageCompressedTooLarge);
  } finally {
    image.close();
  }
}

export default function SosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [emergencyType, setEmergencyType] = useState<EmergencyType | "">("");
  const [emergencyOption, setEmergencyOption] = useState<EmergencyOption | "">("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");
  const [geoErrorMessage, setGeoErrorMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceInterim, setVoiceInterim] = useState("");
  const [voiceLocale, setVoiceLocale] = useState<EmergencyLocale>("ar-DZ");
  const [voiceAnalysis, setVoiceAnalysis] = useState<VoiceAnalysis | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageMessage, setImageMessage] = useState("");
  const [imageNotice, setImageNotice] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [imageMode, setImageMode] = useState<"automated" | "manual-review" | null>(null);
  const [draftError, setDraftError] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [successSafetyAdvice, setSuccessSafetyAdvice] = useState<string[]>([]);
  const draftLoadedRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechFinalRef = useRef("");
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);
  const geoWatchRef = useRef<number | null>(null);
  const geoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geoRequestRef = useRef(0);
  const bestCoordsRef = useRef<Coords | null>(null);
  const requestIdRef = useRef("");

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    draftLoadedRef.current = false;
    try {
      const storedLocale = localStorage.getItem(LOCALE_KEY);
      const parsedLocale = emergencyLocaleSchema.safeParse(storedLocale);
      if (parsedLocale.success) setVoiceLocale(parsedLocale.data);
    } catch {
      setDraftError(emergencyStrings.errors.draftUnavailable);
    }
    try {
      const storedDraft = sessionStorage.getItem(DRAFT_KEY);
      if (!storedDraft) {
        draftLoadedRef.current = true;
        return;
      }
      const parsedDraft = draftSchema.safeParse(JSON.parse(storedDraft) as unknown);
      if (!parsedDraft.success) {
        sessionStorage.removeItem(DRAFT_KEY);
        setDraftError(emergencyStrings.errors.draftUnavailable);
        draftLoadedRef.current = true;
        return;
      }
      const draft = parsedDraft.data;
      setFullName(draft.fullName);
      setPhone(draft.phone);
      setDescription(draft.description);
      setEmergencyType(draft.emergencyType);
      setEmergencyOption(draft.emergencyOption);
      const restoredCoords =
        draft.coords?.capturedAt &&
        Date.now() - draft.coords.capturedAt <= GPS_DRAFT_MAX_AGE_MS
          ? { ...draft.coords, capturedAt: draft.coords.capturedAt }
          : null;
      setCoords(restoredCoords);
      setGeo(restoredCoords ? "ok" : "idle");
      setVoiceTranscript(draft.voiceTranscript);
      setVoiceLocale(draft.voiceLocale);
      setImagePreview(draft.imagePreview);
      setImageUrl(draft.imageUrl);
      requestIdRef.current = draft.requestId ?? "";
      draftLoadedRef.current = true;
    } catch {
      setDraftError(emergencyStrings.errors.draftUnavailable);
      draftLoadedRef.current = true;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(LOCALE_KEY, voiceLocale);
    } catch {
      setDraftError(emergencyStrings.errors.draftUnavailable);
    }
  }, [open, voiceLocale]);

  useEffect(() => {
    if (!open || status === "success" || !draftLoadedRef.current) return;
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          fullName,
          phone,
          description,
          emergencyType,
          emergencyOption,
          coords,
          voiceTranscript,
          voiceLocale,
          imagePreview,
          imageUrl,
          ...(requestIdRef.current ? { requestId: requestIdRef.current } : {}),
        }),
      );
    } catch {
      setDraftError(emergencyStrings.errors.draftUnavailable);
    }
  }, [
    open,
    status,
    fullName,
    phone,
    description,
    emergencyType,
    emergencyOption,
    coords,
    voiceTranscript,
    voiceLocale,
    imagePreview,
    imageUrl,
  ]);

  useEffect(
    () => () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (silenceCheckRef.current) clearInterval(silenceCheckRef.current);
      if (geoWatchRef.current !== null) navigator.geolocation.clearWatch(geoWatchRef.current);
      geoRequestRef.current += 1;
      if (geoTimeoutRef.current) clearTimeout(geoTimeoutRef.current);
      speechRecognitionRef.current?.stop();
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close().catch((error: unknown) => {
          console.warn("[SOS] Audio monitor cleanup failed.", error);
        });
      }
    },
    [],
  );

  const reset = () => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    if (geoWatchRef.current !== null) navigator.geolocation.clearWatch(geoWatchRef.current);
    geoRequestRef.current += 1;
    geoWatchRef.current = null;
    if (geoTimeoutRef.current) clearTimeout(geoTimeoutRef.current);
    geoTimeoutRef.current = null;
    bestCoordsRef.current = null;
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    setFullName("");
    setPhone("");
    setDescription("");
    setEmergencyType("");
    setEmergencyOption("");
    setCoords(null);
    setGeo("idle");
    setGeoErrorMessage("");
    setHoneypot("");
    setErrors({});
    setStatus("idle");
    setMessage("");
    setRecording(false);
    setVoiceBusy(false);
    setVoiceStatus("idle");
    setVoiceMessage("");
    setVoiceTranscript("");
    setVoiceInterim("");
    setVoiceAnalysis(null);
    setImageBusy(false);
    setImageMessage("");
    setImageNotice("");
    setImagePreview("");
    setImageUrl("");
    setImageAnalysis(null);
    setImageMode(null);
    setDraftError("");
    setReferenceNumber("");
    setSuccessSafetyAdvice([]);
    requestIdRef.current = "";
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      setDraftError(emergencyStrings.errors.draftUnavailable);
    }
  };

  const handleClose = () => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (silenceCheckRef.current) clearInterval(silenceCheckRef.current);
    silenceCheckRef.current = null;
    if (geoWatchRef.current !== null) navigator.geolocation.clearWatch(geoWatchRef.current);
    geoRequestRef.current += 1;
    geoWatchRef.current = null;
    if (geoTimeoutRef.current) clearTimeout(geoTimeoutRef.current);
    geoTimeoutRef.current = null;
    bestCoordsRef.current = null;
    setGeoErrorMessage("");
    speechRecognitionRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    setRecording(false);
    if (status === "success") reset();
    onClose();
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (silenceCheckRef.current) clearInterval(silenceCheckRef.current);
    silenceCheckRef.current = null;
    speechRecognitionRef.current?.stop();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setRecording(false);
  };

  const setVoiceError = (error: string) => {
    setVoiceMessage(error);
    setVoiceStatus("error");
  };

  const startOrStopRecording = async () => {
    if (recording) {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError(emergencyStrings.errors.unsupportedBrowser);
      return;
    }

    setVoiceMessage("");
    setVoiceStatus("idle");
    setVoiceAnalysis(null);
    setVoiceTranscript("");
    setVoiceInterim("");
    speechFinalRef.current = "";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const supportedType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type));
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
      if (typeof window.AudioContext !== "undefined") {
        try {
          const audioContext = new AudioContext();
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 512;
          audioContext.createMediaStreamSource(stream).connect(analyser);
          const samples = new Uint8Array(analyser.fftSize);
          let speechDetected = false;
          let lastSoundAt = Date.now();
          audioContextRef.current = audioContext;
          silenceCheckRef.current = setInterval(() => {
            analyser.getByteTimeDomainData(samples);
            const energy =
              samples.reduce((sum, sample) => sum + (sample - 128) ** 2, 0) / samples.length;
            if (Math.sqrt(energy) > 3.2) {
              speechDetected = true;
              lastSoundAt = Date.now();
            } else if (speechDetected && Date.now() - lastSoundAt > 1_600) {
              stopRecording();
            }
          }, 200);
        } catch (error) {
          console.warn("[SOS] Audio silence detection is unavailable.", error);
        }
      }

      const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (Recognition) {
        const recognition = new Recognition();
        recognition.lang = voiceLocale;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        recognition.onresult = (event) => {
          const finalParts: string[] = [];
          const interimParts: string[] = [];
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            let best: SpeechAlternativeLike | undefined;
            for (let alternativeIndex = 0; alternativeIndex < result.length; alternativeIndex += 1) {
              const alternative = result[alternativeIndex];
              if (!best || alternative.confidence > best.confidence) best = alternative;
            }
            if (!best?.transcript.trim()) continue;
            (result.isFinal ? finalParts : interimParts).push(best.transcript.trim());
          }
          if (finalParts.length > 0) {
            speechFinalRef.current = `${speechFinalRef.current} ${finalParts.join(" ")}`.trim();
            setVoiceTranscript(speechFinalRef.current.slice(0, SOS_DESCRIPTION_MAX_LENGTH));
          }
          setVoiceInterim(interimParts.join(" "));
        };
        recognition.onerror = (event) => {
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            setVoiceError(emergencyStrings.errors.micDenied);
          }
        };
        recognition.onspeechend = () => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => stopRecording(), 1_500);
        };
        recognition.onend = () => {
          const browserTranscript = speechFinalRef.current.trim().slice(0, SOS_DESCRIPTION_MAX_LENGTH);
          if (browserTranscript) {
            setVoiceTranscript(browserTranscript);
            setDescription(browserTranscript);
          }
        };
        speechRecognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          speechRecognitionRef.current = null;
        }
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          recordedBytes += event.data.size;
          if (recordedBytes > AUDIO_WARNING_BYTES && recordedBytes <= MAX_AUDIO_BYTES) {
            setVoiceMessage(emergencyStrings.errors.audioTooLarge);
          }
          if (recordedBytes > MAX_AUDIO_BYTES && recorder.state !== "inactive") recorder.stop();
        }
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        setVoiceError(emergencyStrings.errors.recording);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (silenceCheckRef.current) clearInterval(silenceCheckRef.current);
        silenceCheckRef.current = null;
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          void audioContextRef.current.close().catch((error: unknown) => {
            console.warn("[SOS] Audio monitor cleanup failed.", error);
          });
        }
        audioContextRef.current = null;
        recorderRef.current = null;
        speechRecognitionRef.current = null;
        setRecording(false);
        const browserTranscript = speechFinalRef.current.trim().slice(0, SOS_DESCRIPTION_MAX_LENGTH);
        if (browserTranscript) {
          setVoiceTranscript(browserTranscript);
          setDescription(browserTranscript);
        }
        const mimeType = (
          recorder.mimeType || (chunks[0] instanceof Blob ? chunks[0].type : "")
        )
          .split(";")[0]
          .toLowerCase();
        const extension =
          mimeType === "audio/mp4"
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
          setVoiceError(emergencyStrings.errors.noSpeech);
          return;
        }
        if (audioBlob.size > MAX_AUDIO_BYTES) {
          setVoiceError(emergencyStrings.errors.audioTooLarge);
          return;
        }
        if (!extension) {
          setVoiceError(emergencyStrings.errors.unsupportedAudio);
          return;
        }
        const form = new FormData();
        form.append("audio", audioBlob, `recording.${extension}`);
        form.append("locale", voiceLocale);
        if (phone.trim()) form.append("phone", phone.trim());
        if (emergencyType) form.append("emergencyType", emergencyType);
        if (description.trim()) form.append("description", description.trim());
        setVoiceBusy(true);
        setVoiceStatus("processing");
        setVoiceInterim("");
        try {
          const response = await fetch("/api/voice-sos", { method: "POST", body: form });
          const payload: unknown = await response.json().catch(() => null);
          const parsed = voiceApiResponseSchema.safeParse(payload);
          if (!parsed.success) throw new Error(emergencyStrings.errors.transcriptRead);
          const result = parsed.data;
          if (!response.ok || !result.ok || !result.transcript || !result.analysis) {
            throw new Error(result.error ?? emergencyStrings.errors.noSpeech);
          }
          const transcript = result.transcript.slice(0, SOS_DESCRIPTION_MAX_LENGTH);
          const localSeverity = classifyEmergencySeverity(transcript);
          const parsedAnalysis = legacyVoiceAnalysisSchema.parse(result.analysis);
          const safeAnalysis: VoiceAnalysis = {
            ...parsedAnalysis,
            urgency:
              localSeverity === "critical" || localSeverity === "high"
                ? "high"
                : parsedAnalysis.urgency,
            safetyAdvice:
              localSeverity === "critical" || localSeverity === "high"
                ? emergencyStrings.safetyDangerMessage
                : parsedAnalysis.safetyAdvice,
          };
          setVoiceTranscript(transcript);
          setVoiceAnalysis(safeAnalysis);
          setDescription(transcript);
          setVoiceStatus("idle");
          setVoiceMessage(
            result.usedFallback
              ? emergencyStrings.errors.analysisUnavailable
              : emergencyStrings.errors.analysisComplete,
          );
        } catch (error) {
          setVoiceError(
            error instanceof TypeError
              ? emergencyStrings.errors.network
              : emergencyArabicError(error, emergencyStrings.errors.transcriptRead),
          );
        } finally {
          setVoiceBusy(false);
        }
      };
      recorder.start(1_000);
      setRecording(true);
      setVoiceStatus("listening");
      recordingTimerRef.current = setTimeout(() => stopRecording(), 15_000);
    } catch (error) {
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      setVoiceError(denied ? emergencyStrings.errors.micDenied : emergencyStrings.errors.unsupportedBrowser);
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
      const payload: unknown = await response.json().catch(() => null);
      const parsed = imageAnalysisResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(emergencyStrings.errors.imageRead);
      }
      const result = parsed.data;
      if (!response.ok || !result.ok || !result.result) throw new Error(result.error ?? emergencyStrings.errors.imageInspect);
      setImageAnalysis(result.result);
      setImageMode(result.mode === "manual-review" ? "manual-review" : "automated");
      setImageNotice(
        result.mode === "manual-review"
          ? result.message ?? emergencyStrings.errors.imageManualReview
          : "",
      );
      setImageMessage("");
    } catch (error) {
      setImageMessage(
        error instanceof TypeError
          ? emergencyStrings.errors.imageConnection
          : emergencyArabicError(error, emergencyStrings.errors.imagePrepare),
      );
    } finally {
      setImageBusy(false);
    }
  };

  const requestLocation = () => {
    setErrors((previous) => ({ ...previous, location: "" }));
    setGeoErrorMessage("");
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeo("unsupported");
      return;
    }
    if (geoWatchRef.current !== null) navigator.geolocation.clearWatch(geoWatchRef.current);
    if (geoTimeoutRef.current) clearTimeout(geoTimeoutRef.current);
    const requestId = ++geoRequestRef.current;
    bestCoordsRef.current = null;
    setGeo("loading");
    setCoords(null);
    const finish = (errorMessage = "") => {
      if (geoRequestRef.current !== requestId) return;
      geoRequestRef.current += 1;
      if (geoWatchRef.current !== null) navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
      if (geoTimeoutRef.current) clearTimeout(geoTimeoutRef.current);
      geoTimeoutRef.current = null;
      const best = bestCoordsRef.current;
      setCoords(best);
      setGeo(best ? "ok" : "failed");
      setGeoErrorMessage(best ? "" : errorMessage);
      if (best) setErrors((previous) => ({ ...previous, location: "" }));
    };
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (geoRequestRef.current !== requestId) return;
        const nextCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          capturedAt: position.timestamp,
        };
        const freshAccurate = isFreshAccurateGpsFix(nextCoords.accuracy, nextCoords.capturedAt);
        if (
          freshAccurate ||
          !bestCoordsRef.current ||
          nextCoords.accuracy < bestCoordsRef.current.accuracy
        ) {
          bestCoordsRef.current = nextCoords;
          setCoords(nextCoords);
        }
        if (freshAccurate) finish();
      },
      (error) => {
        if (geoRequestRef.current !== requestId) return;
        if (error.code === error.PERMISSION_DENIED) {
          finish(emergencyStrings.form.locationDenied);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: GPS_CAPTURE_MAX_WAIT_MS + 2_000,
        maximumAge: GPS_CACHE_MAX_AGE_MS,
      },
    );
    geoTimeoutRef.current = setTimeout(() => {
      finish(emergencyStrings.form.locationFailed);
    }, GPS_CAPTURE_MAX_WAIT_MS);
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!emergencyPhoneSchema.safeParse(phone).success) next.phone = emergencyStrings.errors.phoneInvalid;
    if (!emergencyType) next.emergencyType = emergencyStrings.errors.emergencyTypeRequired;
    if (!description.trim() && !imagePreview) {
      next.description = emergencyStrings.form.descriptionOrPhotoRequired;
    }
    if (!coords || Date.now() - coords.capturedAt > GPS_DRAFT_MAX_AGE_MS) {
      next.location = emergencyStrings.form.locationRequired;
    }
    return next;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting" || imageBusy || voiceBusy || recording || geo === "loading") return;

    if (coords && Date.now() - coords.capturedAt > GPS_DRAFT_MAX_AGE_MS) {
      setCoords(null);
      setGeo("idle");
      bestCoordsRef.current = null;
    }
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setStatus("submitting");
    setMessage("");
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();

    const result = await postJson("/api/sos", {
      fullName,
      phone,
      description: description.trim().slice(0, SOS_DESCRIPTION_MAX_LENGTH),
      emergencyType,
      aiDiagnosis: [
        imageAnalysis
          ? `${emergencyStrings.errors.submitImageDiagnosis} (${imageAnalysis.riskLevel}): ${imageAnalysis.diagnosis}. ${emergencyStrings.errors.recommendation}: ${imageAnalysis.recommendation}`
          : "",
        voiceAnalysis
          ? `${emergencyStrings.errors.voiceAnalysis} (${emergencyStrings.form.urgencyLevels[voiceAnalysis.urgency]}): ${voiceAnalysis.summary}. ${emergencyStrings.errors.safetyAdviceLabel}: ${voiceAnalysis.safetyAdvice}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 1_500),
      voiceTranscript,
      ...(imageUrl ? { imageUrl } : { imageBase64: imagePreview || undefined }),
      location: coords ? { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy } : null,
      website: honeypot,
      requestId: requestIdRef.current,
    });

    if (result.ok) {
      const success = sosSuccessResponseSchema.safeParse(result);
      if (success.success) {
        setStatus("success");
        setReferenceNumber(success.data.referenceId);
        setSuccessSafetyAdvice(success.data.safetyAdvice);
        setMessage(success.data.message ?? emergencyStrings.form.successTitle);
      } else {
        setStatus("error");
        setMessage(emergencyStrings.errors.submitFailed);
      }
    } else {
      setStatus("error");
      setMessage(result.error ?? emergencyStrings.errors.submitFailed);
      setErrors(firstFieldErrors(result.fieldErrors));
    }
  };

  const submitting = status === "submitting";
  const directDanger =
    emergencyType === "dangerous_short_circuit" ||
    voiceAnalysis?.urgency === "high" ||
    classifyEmergencySeverity(`${description} ${voiceTranscript}`) === "high" ||
    classifyEmergencySeverity(`${description} ${voiceTranscript}`) === "critical";
  const phoneValid = emergencyPhoneSchema.safeParse(phone).success;
  const canSubmit =
    Boolean(emergencyType) &&
    Boolean(description.trim() || imagePreview) &&
    Boolean(coords) &&
    geo !== "loading" &&
    phoneValid &&
    !submitting &&
    !voiceBusy &&
    !imageBusy &&
    !recording;
  const mapHref = coords ? createMapsCoordinatesHref(coords.lat, coords.lng) : "";
  const locationStatus =
    geo === "loading"
      ? emergencyStrings.form.locationLoading
      : geo === "ok"
        ? emergencyStrings.form.locationSuccess
        : geo === "unsupported"
          ? emergencyStrings.form.locationUnsupported
          : geo === "failed"
            ? emergencyStrings.form.locationFailed
            : "";

  const footer =
    status === "success" ? (
      <button type="button" onClick={handleClose} className="sos-pro-submit">
        {emergencyStrings.form.close}
      </button>
    ) : (
      <div className="sos-pro-footer-actions">
        {!canSubmit && !submitting && !voiceBusy && !imageBusy && !recording ? (
          <p className="sos-pro-required-hint" role="status">
            {emergencyStrings.form.requiredFieldsHint}
          </p>
        ) : null}
        <button
          type="submit"
          form="sos-form"
          disabled={!canSubmit}
          className="sos-pro-submit"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              {emergencyStrings.form.sending}
            </>
          ) : status === "error" ? (
            emergencyStrings.form.retry
          ) : voiceBusy || imageBusy || recording ? (
            emergencyStrings.form.completeRecording
          ) : (
            <>
              <Siren className="h-5 w-5" aria-hidden="true" />
              {emergencyStrings.form.send}
            </>
          )}
        </button>
        {SITE.phoneHref ? (
          <a href={SITE.phoneHref} className="sos-pro-call">
            <Phone className="h-5 w-5" aria-hidden="true" />
            {emergencyStrings.form.call}
          </a>
        ) : null}
      </div>
    );

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={emergencyStrings.title}
      titleId="sos-title"
      subtitle={emergencyStrings.subtitle}
      accent="blue"
      icon={<Siren className="h-6 w-6 text-sos-red" aria-hidden="true" />}
      footer={footer}
      scrollKey={status}
      panelClassName="sos-modal-pro"
    >
      {status === "success" ? (
        <div className="sos-pro-success" role="status" aria-live="polite">
          <CheckCircle2 className="mx-auto h-14 w-14" aria-hidden="true" />
          <h3>{emergencyStrings.form.successTitle}</h3>
          <p>{message}</p>
          <p className="sos-pro-reference">
            {emergencyStrings.form.referenceLabel}: <span dir="ltr">{referenceNumber || emergencyStrings.form.noReference}</span>
          </p>
          {successSafetyAdvice.length ? (
            <p>
              <strong>{emergencyStrings.form.safetyAdvice}:</strong>{" "}
              {successSafetyAdvice.slice(0, 3).join(" ")}
            </p>
          ) : null}
          <p>{emergencyStrings.form.nextSteps}</p>
          {SITE.phoneHref ? (
            <a href={SITE.phoneHref} className="sos-pro-call-inline">
              <Phone className="h-5 w-5" aria-hidden="true" />
              {emergencyStrings.form.call}
            </a>
          ) : null}
        </div>
      ) : (
        <form id="sos-form" onSubmit={onSubmit} noValidate className="sos-pro-form">
          <div className={`sos-pro-safety${directDanger ? " is-danger" : ""}`} role={directDanger ? "alert" : "note"}>
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="sos-pro-safety-content">
              <strong>{directDanger ? emergencyStrings.safetyDangerTitle : emergencyStrings.safetyTitle}</strong>
              <p>{emergencyStrings.safetyMessage}</p>
              {directDanger ? <p>{emergencyStrings.safetyDangerMessage}</p> : null}
              <a href={`tel:${EMERGENCY_SERVICES_PHONE}`} dir="ltr">
                <Phone className="h-4 w-4" aria-hidden="true" />
                {emergencyStrings.civilProtection}
              </a>
            </div>
          </div>

          {draftError ? <p role="status" className="sos-pro-assist-message is-warning">{draftError}</p> : null}
          {status === "error" && message ? (
            <div role="alert" className="sos-pro-error">
              <p>{message}</p>
            </div>
          ) : null}

          <fieldset className="sos-pro-fieldset">
            <legend className="sos-pro-label">
              {emergencyStrings.form.emergencyTypeLegend} <span className="text-sos-red">*</span>
            </legend>
            <div className="sos-pro-types">
              {emergencyStrings.emergencyTypes.map((option) => {
                const Icon = EMERGENCY_ICONS[option.id];
                const selected = emergencyOption === option.id;
                return (
                  <label
                    key={option.id}
                    className={`sos-pro-type${selected ? " is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="emergencyType"
                      value={EMERGENCY_TYPE_BY_OPTION[option.id]}
                      checked={selected}
                      aria-invalid={Boolean(errors.emergencyType)}
                      aria-describedby={errors.emergencyType ? "sos-type-err" : undefined}
                      onChange={() => {
                        setEmergencyOption(option.id);
                        setEmergencyType(EMERGENCY_TYPE_BY_OPTION[option.id]);
                        setErrors((previous) => ({ ...previous, emergencyType: "" }));
                      }}
                    />
                    <span className="sos-pro-type-card">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                      <span>{option.label}</span>
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

          <section className="sos-pro-section" aria-label={emergencyStrings.form.voiceTitle}>
            <div className="sos-pro-section-heading">
              <h3 className="sos-pro-label">{emergencyStrings.form.descriptionLabel}</h3>
              <span className="sos-pro-optional">{emergencyStrings.form.optional}</span>
            </div>
            <div className="sos-pro-voice">
              <button
                type="button"
                onClick={startOrStopRecording}
                disabled={voiceBusy}
                aria-pressed={recording}
                className={`sos-pro-mic${recording ? " is-recording" : ""}${voiceStatus === "error" ? " is-error" : ""}`}
              >
                {voiceStatus === "processing" ? (
                  <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
                ) : (
                  <Mic className="h-7 w-7" aria-hidden="true" />
                )}
                <span>
                  {voiceStatus === "processing"
                    ? emergencyStrings.form.voiceProcessing
                    : recording
                      ? emergencyStrings.form.voiceListening
                      : voiceStatus === "error"
                        ? emergencyStrings.form.voiceError
                        : emergencyStrings.form.voiceIdle}
                </span>
              </button>
              <div className="sos-pro-languages" role="group" aria-label={emergencyStrings.form.voiceLanguage}>
                {(["ar-DZ", "fr-FR", "en-US"] as const).map((locale) => {
                  const label =
                    locale === "ar-DZ"
                      ? emergencyStrings.form.locales.arabic
                      : locale === "fr-FR"
                        ? emergencyStrings.form.locales.french
                        : emergencyStrings.form.locales.english;
                  return (
                    <button
                      key={locale}
                      type="button"
                      aria-pressed={voiceLocale === locale}
                      className={`sos-pro-language${voiceLocale === locale ? " is-selected" : ""}`}
                      onClick={() => setVoiceLocale(locale)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="sos-pro-hint">{emergencyStrings.form.voiceTextFallback}</p>
            {recording || voiceInterim ? (
              <p className="sos-pro-live-transcript" dir="rtl" role="status" aria-live="polite">
                <span>{emergencyStrings.form.voiceInterim}: </span>
                {voiceInterim || voiceTranscript || emergencyStrings.form.voiceListening}
              </p>
            ) : null}
            <label htmlFor="sos-description" className="sos-pro-label">
              {emergencyStrings.form.voiceTranscriptLabel}
            </label>
            <textarea
              id="sos-description"
              name="description"
              rows={3}
              maxLength={SOS_DESCRIPTION_MAX_LENGTH}
              value={description}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "sos-description-err" : undefined}
              onChange={(event) => {
                setDescription(event.target.value);
                if (voiceTranscript) setVoiceTranscript(event.target.value);
                setErrors((previous) => ({ ...previous, description: "" }));
              }}
              onBlur={() => {
                if (!description.trim() && !imagePreview) {
                  setErrors((previous) => ({
                    ...previous,
                    description: emergencyStrings.form.descriptionOrPhotoRequired,
                  }));
                }
              }}
              className="sos-pro-input sos-pro-description"
              placeholder={emergencyStrings.form.descriptionPlaceholder}
            />
            {errors.description ? (
              <p id="sos-description-err" className="sos-pro-field-error">
                {errors.description}
              </p>
            ) : null}
            {voiceMessage ? (
              <p
                role={voiceStatus === "error" ? "alert" : "status"}
                aria-live={voiceStatus === "error" ? "assertive" : "polite"}
                className={`sos-pro-assist-message${voiceStatus === "error" ? " is-warning" : ""}`}
              >
                {voiceMessage}
              </p>
            ) : null}
            {voiceAnalysis ? (
              <div className={`sos-pro-analysis${directDanger ? " is-danger" : ""}`}>
                <p><strong>{emergencyStrings.form.analysisSummary}:</strong> {voiceAnalysis.summary}</p>
                <p><strong>{emergencyStrings.form.safetyAdvice}:</strong> {voiceAnalysis.safetyAdvice}</p>
                <p>
                  <strong>{emergencyStrings.form.urgency}:</strong>{" "}
                  {emergencyStrings.form.urgencyLevels[voiceAnalysis.urgency]}
                </p>
              </div>
            ) : null}
          </section>

          <section className="sos-pro-section" aria-label={emergencyStrings.form.photoTitle}>
            <div className="sos-pro-section-heading">
              <h3 className="sos-pro-label">{emergencyStrings.form.photoTitle}</h3>
              <span className="sos-pro-optional">{emergencyStrings.form.optional}</span>
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              aria-label={emergencyStrings.errors.photoInputLabel}
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
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="h-5 w-5" aria-hidden="true" />
              )}
              {imageBusy ? emergencyStrings.errors.imageInspection : emergencyStrings.form.photoButton}
            </button>
            <p className="sos-pro-hint">{emergencyStrings.form.imageLimitHint}</p>
            {imageMessage ? (
              <p role="alert" className="sos-pro-assist-message is-warning">{imageMessage}</p>
            ) : null}
            {imageBusy ? (
              <p role="status" aria-live="polite" className="sos-pro-assist-message">
                {emergencyStrings.errors.imageAnalysisLoading}
              </p>
            ) : null}
            {imagePreview ? (
              <div className="sos-pro-image-preview">
                <img src={imagePreview} alt={emergencyStrings.form.photoAlt} />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview("");
                    setImageUrl("");
                    setImageAnalysis(null);
                    setImageMode(null);
                    setImageNotice("");
                  }}
                  aria-label={emergencyStrings.form.removePhoto}
                  className="sos-pro-remove-photo"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {emergencyStrings.form.removePhoto}
                </button>
              </div>
            ) : null}
            {imageAnalysis ? (
              <div className="sos-pro-analysis">
                <h4>{imageMode === "manual-review" ? emergencyStrings.form.manualImageReviewTitle : emergencyStrings.form.imageAnalysisTitle}</h4>
                <p>{imageAnalysis.diagnosis}</p>
                <p><strong>{emergencyStrings.form.imageDangerLabel}:</strong> {imageAnalysis.riskLevel}</p>
                <p>{imageAnalysis.recommendation}</p>
                {imageNotice ? <p role="status">{imageNotice}</p> : null}
              </div>
            ) : null}
          </section>

          <section className="sos-pro-section">
            <div className="sos-pro-section-heading">
              <h3 className="sos-pro-label">{emergencyStrings.form.locationTitle}</h3>
              <span className={`sos-pro-location-chip is-${geo}`}>
                {geo === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}
                {locationStatus || emergencyStrings.form.locationNotSet}
              </span>
            </div>
            <button
              type="button"
              onClick={requestLocation}
              disabled={geo === "loading"}
              className="sos-pro-tool"
            >
              {geo === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <LocateFixed className="h-5 w-5" aria-hidden="true" />
              )}
              {geo === "loading" ? emergencyStrings.form.locationLoading : emergencyStrings.form.locationButton}
            </button>
            {coords ? (
              <p role="status" className="sos-pro-hint">
                {geo === "loading" ? emergencyStrings.form.locationRefining : emergencyStrings.form.locationSuccess} — {emergencyStrings.form.locationAccuracy} ±{coords.accuracy} {emergencyStrings.form.meters}
              </p>
            ) : null}
            {(geo === "failed" || geo === "unsupported") ? (
              <p role="status" className="sos-pro-hint is-warning">
                {geo === "failed" ? geoErrorMessage || emergencyStrings.form.locationFailed : emergencyStrings.form.locationUnsupported}
              </p>
            ) : null}
            <p className="sos-pro-hint">{emergencyStrings.form.locationAccuracyHint}</p>
            {errors.location ? <p role="alert" className="sos-pro-field-error">{errors.location}</p> : null}
            {mapHref ? (
              <a href={mapHref} target="_blank" rel="noopener noreferrer" className="sos-pro-map-link">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {emergencyStrings.form.openMap}
              </a>
            ) : null}
          </section>

          <section className="sos-pro-section">
            <h3 className="sos-pro-label">{emergencyStrings.form.nameLabel} و{emergencyStrings.form.phoneLabel}</h3>
            <label htmlFor="sos-name" className="sos-pro-label">
              {emergencyStrings.form.nameLabel} <span className="sos-pro-optional">{emergencyStrings.form.optional}</span>
            </label>
            <input
              id="sos-name"
              name="fullName"
              type="text"
              autoComplete="name"
              maxLength={80}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? "sos-name-err" : undefined}
              className="sos-pro-input"
              placeholder={emergencyStrings.form.namePlaceholder}
            />
            {errors.fullName ? <p id="sos-name-err" className="sos-pro-field-error">{errors.fullName}</p> : null}

            <label htmlFor="sos-phone" className="sos-pro-label">
              {emergencyStrings.form.phoneLabel} <span className="text-sos-red">*</span>
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
              onChange={(event) => {
                setPhone(event.target.value);
                setErrors((previous) => ({
                  ...previous,
                  phone:
                    event.target.value.trim() && !emergencyPhoneSchema.safeParse(event.target.value).success
                      ? emergencyStrings.errors.phoneInvalid
                      : "",
                }));
              }}
              onBlur={() => {
                if (!emergencyPhoneSchema.safeParse(phone).success) {
                  setErrors((previous) => ({
                    ...previous,
                    phone: emergencyStrings.errors.phoneInvalid,
                  }));
                }
              }}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "sos-phone-err" : "sos-phone-hint"}
              className="sos-pro-input sos-pro-phone"
              placeholder={emergencyStrings.form.phonePlaceholder}
            />
            <p id="sos-phone-hint" className="sos-pro-hint">{emergencyStrings.form.phoneHint}</p>
            {errors.phone ? <p id="sos-phone-err" className="sos-pro-field-error">{errors.phone}</p> : null}
          </section>

          <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="sos-website">{emergencyStrings.errors.honeypotLabel}</label>
            <input
              id="sos-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </div>
        </form>
      )}
    </ModalShell>
  );
}
