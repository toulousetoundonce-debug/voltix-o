# Current runtime response contracts

This document captures the response shapes that are currently used by the six API routes in the checked-in project state. The original route implementations are treated as the source of truth; this file is a snapshot for testing and auditing.

## 1) POST /api/chat

### Valid request

Request body:

```json
{
  "messages": [
    { "role": "user", "content": "أحتاج إلى نصيحة حول لوحة كهربائية" },
    { "role": "assistant", "content": "ممكن" }
  ]
}
```

Success response:

```json
{
  "ok": true,
  "message": "نص الرد من المساعد"
}
```

Error response (validation, rate limit, upstream failure):

```json
{
  "ok": false,
  "error": "رسالة خطأ عربية",
  "fieldErrors": {
    "messages": ["..."],
    "messages[0].content": ["..."]
  }
}
```

Status codes:
- 200: success
- 400: invalid schema or malformed body
- 403: same-origin rejection
- 429: rate limit
- 502/503/504: upstream or provider failures

## 2) POST /api/quote

### Valid request

```json
{
  "projectType": "smart_home",
  "area": 120,
  "units": 12,
  "tier": "advanced",
  "fullName": "أحمد بن مرسل",
  "phone": "+213555123456",
  "aiDiagnosis": "تحتاج إلى 12 نقطة ذكية",
  "city": "الجزائر",
  "website": ""
}
```

Success response:

```json
{
  "ok": true,
  "message": "تم استلام طلبك. سنتواصل معك قريباً لترتيب المعاينة والدراسة الفنية.",
  "estimate": {
    "base": 123000,
    "min": 110000,
    "max": 147500
  }
}
```

Error response:

```json
{
  "ok": false,
  "error": "تحقق من البيانات المدخلة.",
  "fieldErrors": {
    "phone": ["..."],
    "area": ["..."]
  }
}
```

Status codes:
- 200: success
- 400: invalid schema
- 403: same-origin rejection
- 429: rate limit
- 502/503: webhook or Telegram delivery failure

## 3) POST /api/sos

### Valid request

```json
{
  "fullName": "عبد القادر",
  "phone": "0655123456",
  "description": "لوحة توزيع تسخنت وبدأت رائحة احتراق",
  "aiDiagnosis": "احتمال تلامس غير آمن",
  "voiceTranscript": "سماع صرير، ثم انفجار قصير",
  "imageBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAF",
  "emergencyType": "dangerous_short_circuit",
  "location": { "lat": 36.7372, "lng": 3.0860, "accuracy": 15 },
  "website": ""
}
```

Success response:

```json
{
  "ok": true,
  "message": "تم استلام بلاغ الطوارئ. سيتصل بك فريقنا في أقرب وقت ممكن.",
  "imageAttachmentError": "تعذّر إرسال الصورة للمراجعة."
}
```

The `imageAttachmentError` field is optional and appears only when the image upload fails while the main SOS request still succeeded.

Error response:

```json
{
  "ok": false,
  "error": "تحقق من البيانات المدخلة.",
  "fieldErrors": {
    "phone": ["..."],
    "emergencyType": ["..."],
    "imageBase64": ["..."]
  }
}
```

Status codes:
- 200: success
- 400: validation error or malformed body
- 403: same-origin rejection
- 413: oversized request
- 415: unsupported image type
- 429: rate limit
- 502/503: upstream delivery failure

## 4) POST /api/callback-request

### Valid request

```json
{
  "phone": "0555123456"
}
```

Success response:

```json
{
  "ok": true,
  "message": "وصل طلبك إلى فريق Voltix. سنتصل بك قريباً."
}
```

Error response:

```json
{
  "ok": false,
  "error": "أدخل رقم هاتف صالحاً.",
  "fieldErrors": {
    "phone": ["..."]
  }
}
```

Status codes:
- 200: success
- 400: invalid phone
- 403: same-origin rejection
- 429: rate limit
- 503: Telegram failure

## 5) POST /api/voice-sos

### Valid request

This route expects `multipart/form-data` with a field named `audio` and an audio file.

Success response:

```json
{
  "ok": true,
  "transcript": "النص المفرغ من التسجيل",
  "analysis": {
    "summary": "ملخص العطل",
    "urgency": "high",
    "category": "electrical-fault",
    "safetyAdvice": "نصيحة أمان فورية"
  },
  "usedFallback": false
}
```

When the provider cannot return a reliable structured response, the route falls back to a deterministic local analysis and sets `usedFallback` to `true`.

Error response:

```json
{
  "ok": false,
  "error": "رسالة خطأ عربية"
}
```

Status codes:
- 200: success
- 400: bad multipart or missing audio
- 413: audio exceeds 4 MiB
- 415: unsupported audio type
- 429: rate limit
- 502/503/504: provider or timeout failures

## 6) POST /api/vision-check

### Valid request

```json
{
  "imageBase64": "data:image/png;base64,..."
}
```

Success response:

```json
{
  "ok": true,
  "result": {
    "diagnosis": "تشخيص فني مختصر",
    "riskLevel": "خطر مرتفع",
    "recommendation": "توصية أمنية أولية"
  }
}
```

When the image analysis service is unavailable, the route returns a safe manual-review fallback:

```json
{
  "ok": true,
  "mode": "manual-review",
  "result": {
    "diagnosis": "لم تتوفر حالياً نتيجة تحليل بصري آلي. ستُرفق الصورة للمراجعة الهندسية؛ هذه الإرشادات لا تصف ما يظهر في الصورة.",
    "riskLevel": "متوسط",
    "recommendation": "لا تفتح اللوحة..."
  },
  "message": "تعذّر إكمال الفحص الآلي الآن؛ ستبقى الصورة مرفقة للمراجعة الهندسية عند إرسال البلاغ."
}
```

Error response:

```json
{
  "ok": false,
  "error": "رسالة خطأ عربية"
}
```

Status codes:
- 200: success or manual-review fallback
- 400: missing or malformed image
- 413: image exceeds 4 MiB or the Netlify-safe request limit
- 415: unsupported image type
- 429: rate limit
- 502/503/504: provider or timeout failures

Provider and model metadata are intentionally omitted from both analysis responses so implementation details never reach the client.

## DeepSeek Model IDs

Verified against the official DeepSeek documentation on 2026-10-24:

- The current documented vision-capable model ID is `deepseek-flash`. The Vision guide explicitly states it accepts images with text, including Base64 data URLs and public HTTPS URLs; supported formats are JPEG, PNG, GIF, and WebP.
- The official pricing/quick-start page maps `deepseek-flash` to DeepSeek-V4.1-Flash-1017. The Change Log dated 2026-10-17 confirms this model update and that the API model name remains `deepseek-flash`.
- The Change Log states that `deepseek-chat` and `deepseek-reasoner` were legacy API model names scheduled for discontinuation on 2026-07-24. They are not selected here.
- The retired `deepseek-v4-flash-vision-exp` name may still route to the current Flash model for compatibility, but it is not used.

References:
- [DeepSeek Vision guide](https://api-docs.deepseek.com/guides/vision)
- [DeepSeek models and pricing / quick start](https://api-docs.deepseek.com/quick_start/pricing)
- [DeepSeek Change Log](https://api-docs.deepseek.com/updates/)

The default optional vision model remains `deepseek-flash`; the feature flag is still off by default and no `.env*` file tracked by Git enables it.

## Rate limits

All six POST routes use a 60-second per-IP, per-route limit. Defaults are 5/minute for image and voice checks, 8/minute for SOS, 20/minute for chat, and 10/minute for quote and callback requests. A rejected request returns HTTP 429 with `Retry-After` and `X-RateLimit-Remaining`. The in-memory limiter is per instance and is not globally consistent on Netlify; use shared storage such as Upstash Redis before scaling.

Voice uploads accept at most 5.5 MiB. The multipart request is rejected from `Content-Length` before reading if it exceeds 5,900,000 bytes. Images remain capped at 4 MiB.

The client recorder requests Opus/WebM at 32 kbps, shows a warning after 4.5 MiB, and stops recording when it passes the 5.5 MiB limit.

## Invalid-payload error shape used in tests

The route validation pattern used across the app is:

```json
{
  "ok": false,
  "error": "تحقق من البيانات المدخلة.",
  "fieldErrors": {
    "fieldName": ["قيمة غير صالحة"]
  }
}
```

The callback route uses a slightly simpler message but still follows the same `ok: false` convention:

```json
{
  "ok": false,
  "error": "أدخل رقم هاتف صالحاً."
}
```
