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
  "usedFallback": false,
  "provider": "gemini",
  "model": "gemini-2.5-flash"
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
- 413: audio too large
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
  },
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

When `GEMINI_API_KEY` is absent, the route returns a safe manual-review fallback:

```json
{
  "ok": true,
  "mode": "manual-review",
  "result": {
    "diagnosis": "لم تتوفر حالياً نتيجة تحليل بصري آلي. ستُرفق الصورة للمراجعة الهندسية؛ هذه الإرشادات لا تصف ما يظهر في الصورة.",
    "riskLevel": "متوسط",
    "recommendation": "لا تفتح اللوحة..."
  },
  "message": "مفتاح تحليل الصور غير مضبوط؛ ستُرفق الصورة للمراجعة عند إرسال بلاغ SOS."
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
- 413: oversized image
- 415: unsupported image type
- 429: rate limit
- 502/503/504: provider or timeout failures

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
