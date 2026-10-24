import { z } from "zod";
import { AREA_MAX, AREA_MIN, PROJECTS, PROJECT_TYPE_VALUES, TIER_VALUES } from "./pricing";
import { sanitize } from "./security";
import {
  AI_DIAGNOSIS_MAX_LENGTH,
  EMERGENCY_VALUES,
  SOS_DESCRIPTION_MAX_LENGTH,
  VOICE_TRANSCRIPT_MAX_LENGTH,
  normalizeDigits,
  normalizePhoneNumber,
} from "./validation";

/** Required text field: capped, sanitised (XSS characters removed), then length-checked. */
const cleanText = (min: number, max: number, message: string) =>
  z
    .string({ error: message })
    .max(500, message)
    .transform((value) => sanitize(value, max))
    .pipe(z.string().min(min, message));

const phoneField = z
  .string({ error: "رقم الهاتف مطلوب" })
  .max(40, "رقم الهاتف غير صالح")
  .transform((value) => sanitize(normalizePhoneNumber(value), 25))
  .pipe(z.string().refine((value) => /^\+?[1-9]\d{7,14}$/.test(value), "أدخل رقم هاتف صالحاً"));

const optionalText = (max: number, message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .max(max, message)
      .transform((value) => sanitize(value, max))
      .optional(),
  );

/** Honeypot: real users never see or fill this field. */
const honeypot = z.string().max(200).optional();

export const sosSchema = z.object({
  fullName: cleanText(2, 80, "الاسم الكامل مطلوب"),
  phone: phoneField,
  description: optionalText(SOS_DESCRIPTION_MAX_LENGTH, "وصف العطل طويل جداً"),
  aiDiagnosis: optionalText(AI_DIAGNOSIS_MAX_LENGTH, "التشخيص طويل جداً"),
  voiceTranscript: optionalText(VOICE_TRANSCRIPT_MAX_LENGTH, "النص الصوتي طويل جداً"),
  imageBase64: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .max(7 * 1024 * 1024, "حجم صورة البلاغ كبير جداً")
      .regex(
        /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
        "صيغة صورة البلاغ غير صالحة",
      )
      .optional(),
  ),
  emergencyType: z.enum(EMERGENCY_VALUES, { error: "اختر نوع الطوارئ" }),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accuracy: z.number().min(0).max(1_000_000).optional(),
    })
    .nullish(),
  website: honeypot,
});

export const quoteSchema = z
  .object({
    projectType: z.enum(PROJECT_TYPE_VALUES, { error: "اختر نوع المشروع" }),
    area: z
      .number({ error: "المساحة غير صالحة" })
      .int()
      .min(AREA_MIN, "المساحة غير صالحة")
      .max(AREA_MAX, "المساحة غير صالحة"),
    units: z
      .number({ error: "القيمة غير صالحة" })
      .int()
      .min(1, "القيمة غير صالحة")
      .max(500, "القيمة غير صالحة"),
    tier: z.enum(TIER_VALUES, { error: "اختر مستوى التجهيز" }),
    fullName: cleanText(2, 80, "الاسم الكامل مطلوب"),
    phone: phoneField,
    aiDiagnosis: optionalText(AI_DIAGNOSIS_MAX_LENGTH, "التشخيص طويل جداً"),
    city: cleanText(2, 60, "المدينة مطلوبة"),
    website: honeypot,
  })
  .superRefine((data, ctx) => {
    const project = PROJECTS[data.projectType];
    if (data.units < project.unitMin || data.units > project.unitMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["units"],
        message: "القيمة خارج النطاق المسموح لهذا النوع من المشاريع",
      });
    }
  });

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "اكتب رسالة").max(1_500, "الرسالة طويلة جداً."),
});

export const chatSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(12),
  })
  .superRefine(({ messages }, ctx) => {
    const totalCharacters = messages.reduce((total, message) => total + message.content.length, 0);
    if (totalCharacters > 6_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messages"],
        message: "المحادثة طويلة جداً. ابدأ محادثة جديدة.",
      });
    }

    if (messages[messages.length - 1]?.role !== "user") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messages"],
        message: "يجب أن تنتهي المحادثة برسالة من المستخدم.",
      });
    }

    for (let index = 1; index < messages.length; index += 1) {
      if (messages[index].role === messages[index - 1].role) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["messages", index, "role"],
          message: "ترتيب رسائل المحادثة غير صالح.",
        });
      }
    }
  });

export const callbackSchema = z.object({
  phone: phoneField,
});

export type SosInput = z.infer<typeof sosSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;
export type ChatInput = z.infer<typeof chatSchema>;
export type CallbackInput = z.infer<typeof callbackSchema>;
