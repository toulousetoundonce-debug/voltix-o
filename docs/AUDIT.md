# Voltix Dynamics – Phase A audit

## Executive summary

This repository is a Next.js 15 + React 18 + TypeScript + Tailwind app for Voltix Dynamics. The app is a dark, Arabic RTL, cyber-industrial marketing and service site with six server routes for chat, quote requests, emergency SOS, callback requests, audio-based SOS triage, and image-based hazard checks. The current baseline is intentionally additive-only: no new behavior was introduced in this phase, only audit documents, tests, and zero-risk framework files.

## Severity-ranked findings

### Critical

- None found in the current route contract for the six POST handlers. All behavior is gated by origin checks, request-size validation, JSON parsing, schema validation, and explicit provider errors.
- The code relies on the same in-process in-memory rate limiter for all routes (`lib/security.ts`). This is not multi-instance-safe and will not survive serverless or multi-node deployments; in a horizontally scaled deployment, the limiter resets per instance.

### High

- `lib/security.ts` uses a permissive client IP heuristic (`x-forwarded-for` / `x-real-ip`) and warns that it is only trustworthy behind a real proxy. This is acceptable for a single-node deployment but unsafe in misconfigured reverse proxies.
- External provider calls are not wrapped with a side-effect timeout in a fail-open way beyond each provider’s own request timeout. This is acceptable for the baseline but any new side effect must be isolated behind a non-blocking fallback in future work.
- The app still contains several hardcoded provider model names such as `GROQ_MODEL` default and `MODEL = "gemini-2.5-flash"` in the voice/image routes. These are configuration values but the prompt specifically requires the default model-name literal to be replaced later with a config accessor without changing the default value.

### Medium

- `app/layout.tsx` loads Google Fonts via a `<link rel="stylesheet">` call. This is an existing design choice, not a security bug, but it is a network dependency outside the app’s own assets.
- `lib/telegram.ts` uses a discovered Telegram chat ID fallback (`getUpdates`) and has a partial fallback path for blocked users. This behavior is pragmatic, but it is not observable to a user at build time.
- `app/api/vision-check/route.ts` and `app/api/voice-sos/route.ts` accept provider errors and fall back to manual-review or retry behaviours. This is better than a hard failure but it means the request can return a success-ish response with a degraded path.

### Low

- The pricing engine in `lib/pricing.ts` is a placeholder and intentionally not tied to a live business price list. The comments call out that all monetary values are placeholders.
- `lib/site.ts` exposes a number of public values from server env vars in `NEXT_PUBLIC_*` only; this is correct for a marketing site, but it means public contact data is exposed as configured.

## Route-by-route audit

### POST /api/chat
- Method: POST
- Validation: `chatSchema` requires `messages` array between 1 and 12 entries; the last message must be from the user; total content must not exceed 6,000 characters.
- Success contract: `{ ok: true, message: string }`
- Status codes: 403 for cross-origin requests, 429 on rate limits, 400 for bad JSON or schema issues, 503 for Groq API key or provider configuration issues, 502 for upstream failures, 504 for timeout.
- External calls: Groq Responses API at `https://api.groq.com/openai/v1/responses`.
- Timeouts: 30s abort controller.
- Error handling: explicit provider-status branching for 400/401/402/403/404/429; falls back to `503`/`502`/`504` as appropriate.
- Rate limit: fixed window per client IP key in memory; safe for a single process, not shared across serverless instances.
- Hardcoded model literal: `MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b"`.
- Telegram integration: when the last user message requests human help, it sends a Telegram alert about panic/help and logs the result.

### POST /api/quote
- Method: POST
- Validation: `quoteSchema` validates project type, price tier, area, units, name, city, phone, honeypot field, and unit range constraints.
- Success contract: `{ ok: true, message: string, estimate: { base, min, max } }`
- Status codes: 403, 429, 400, 503, 502.
- External calls: Telegram alert, and a webhook via `deliver()` to `QUOTE_WEBHOOK_URL`.
- Timeouts: deliver() uses an 8s abort timeout; Telegram uses 8s too.
- Error handling: returns `503` when not configured, `502` when send fails; Telegram is treated as informative but not required for a success if the webhook succeeds.
- Rate limit: fixed window per client IP key in memory.
- Hardcoded model names: none.

### POST /api/sos
- Method: POST
- Validation: `sosSchema` requires full name, phone, emergency type, optional text fields, optional image base64 with MIME validation, optional location object, honeypot.
- Success contract: `{ ok: true, message: string, imageAttachmentError?: string }`
- Status codes: 403, 413, 415, 429, 400, 502, 503.
- External calls: Telegram alert, optional Telegram photo, and optional webhook via `SOS_WEBHOOK_URL`.
- Timeouts: Telegram 8s, photo send uses Telegram helper but not an extra explicit timeout beyond helper logic.
- Error handling: the route returns success if either the webhook or Telegram succeeded; attachment failures only add `imageAttachmentError` and do not fail the request.
- Rate limit: fixed window per client IP key in memory.
- Hardcoded model names: none.

### POST /api/callback-request
- Method: POST
- Validation: `callbackSchema` only accepts a valid phone number.
- Success contract: `{ ok: true, message: string }`
- Status codes: 403, 429, 400, 503.
- External calls: Telegram alert only.
- Timeouts: Telegram request helper uses 8s timeout.
- Error handling: failure to send Telegram returns a 503.
- Rate limit: fixed window per client IP key in memory.

### POST /api/voice-sos
- Method: POST
- Validation: `multipart/form-data` required; `audio` file must be present, non-empty, under 14MB, and one of the supported audio MIME types (`audio/aac`, `audio/mp3`, `audio/mpeg`, `audio/mp4`, `audio/ogg`, `audio/wav`, `audio/webm`, `audio/x-m4a`, `audio/x-wav`).
- Success contract: `{ ok: true, transcript: string, analysis: { summary, urgency, category, safetyAdvice }, usedFallback: boolean, provider: "gemini", model: string }`
- Status codes: 403, 413, 415, 429, 400, 500, 502, 503, 504.
- External calls: Google Gemini `generateContent` endpoint using `GEMINI_API_KEY`.
- Timeouts: 45s abort controller.
- Error handling: if the provider returns an unusable structured JSON, it falls back to deterministic guidance based on transcript content; `usedFallback` indicates that state.
- Rate limit: fixed window per client IP key in memory.
- Hardcoded model name: `MODEL = "gemini-2.5-flash"`.

### POST /api/vision-check
- Method: POST
- Validation: JSON body requires `imageBase64`; supported MIME types are `image/jpeg`, `image/png`, `image/webp`; maximum payload size is enforced at roughly 5MB.
- Success contract: `{ ok: true, result: { diagnosis, riskLevel, recommendation }, provider: "gemini", model: string }`
- Status codes: 403, 413, 415, 429, 400, 502, 503, 504.
- External calls: Google Gemini `generateContent` endpoint using `GEMINI_API_KEY`.
- Timeouts: 45s abort controller.
- Error handling: if the key is missing, it responds with a `manual-review` mode and still returns a safe default engineering guidance object rather than failing the request.
- Rate limit: fixed window per client IP key in memory.
- Hardcoded model name: `MODEL = "gemini-2.5-flash"`.

## Environment variables and client exposure

### Server-only secrets / provider settings
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GEMINI_API_KEY`
- `SOS_WEBHOOK_URL`
- `QUOTE_WEBHOOK_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

All of the above are server-only values; they are never prefixed with `NEXT_PUBLIC_` and are not intended to be exposed to the browser. `lib/site.ts` only reads `NEXT_PUBLIC_*` values and therefore keeps public contact links safe.

### Public values already exposed
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_CONTACT_PHONE`
- `NEXT_PUBLIC_CONTACT_EMAIL`

### Not present in the codebase
- No active database credential references in tracked files.
- No Upstash, Supabase, Vercel KV, or Redis client setup is present in the default code path.

## Dependency and framework versions

- Next.js: ^15.5.28
- React: 18.3.1
- TypeScript: 5.5.3
- Tailwind: 3.4.4
- Zod: 3.23.8

## Metadata and accessibility notes

- `app/layout.tsx` includes `metadataBase`, `openGraph`, and `twitter` metadata and already sets `lang="ar"` and `dir="rtl"`.
- The root layout includes an accessible skip link and keeps a dark cyber-industrial theme.
- The application is designed for Arabic RTL with normal contrast values. No new visual changes were introduced in this phase.

## Secrets scan

Tracked files scanned for secret exposure in the default project under this phase: `voltix_dynamics_master_prompt.md`, `setup.ps1`, `.env.example`.

Result: no secrets were found in the tracked file set inspected for this phase.
