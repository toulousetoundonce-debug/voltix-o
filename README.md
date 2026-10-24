# Voltix Dynamics

Voltix Dynamics is a Next.js + TypeScript marketing and service platform built for the Algerian market. The app includes a public-facing marketing site, quotation flow, emergency/SOS workflow, callback requests, audio support, and image-based checks.

## Local setup

Requirements:
- Node.js 20 LTS
- npm

PowerShell commands:

```powershell
npm ci
Copy-Item .env.example .env.local
# Fill in the required environment variable names shown in .env.example.
npm run dev
```

## Scripts

```powershell
npm run dev
npm run build
npm run start
npm run typecheck
npm test
npm run smoke
```

## Environment variables

Environment variable names are intentionally kept in `.env.example` and are the source of truth. Do not add secrets to `NEXT_PUBLIC_*` variables. Server-only values must remain on the runtime host and should never be logged or printed.

### Netlify

Connect the GitHub repository to Netlify. The root `netlify.toml` configures the Next.js build and adapter. Add server-only values through **Project configuration → Environment variables**; do not put secret values in `netlify.toml`, `.env.example`, or `NEXT_PUBLIC_*` variables.

| Variable | Required | Secret | Notes |
| --- | --- | --- | --- |
| `SOS_WEBHOOK_URL` | For SOS webhook delivery | Yes | Existing optional webhook endpoint |
| `QUOTE_WEBHOOK_URL` | For quote webhook delivery | Yes | Existing optional webhook endpoint |
| `GROQ_API_KEY` | For chat and optional voice transcription | Yes | Server-only credential |
| `GROQ_MODEL` | No | No | Existing chat model override |
| `GEMINI_API_KEY` | When DeepSeek is disabled | Yes | Keeps the existing image/audio path available |
| `TELEGRAM_BOT_TOKEN` | For Telegram delivery | Yes | Existing server-only bot credential |
| `TELEGRAM_CHAT_ID` | For Telegram delivery | Yes | Existing default recipient |
| `TELEGRAM_ALERT_CHAT_ID` | No | Yes | Optional recipient for AI triage reports |
| `DEEPSEEK_API_KEY` | For optional triage | Yes | Server-side model access |
| `DEEPSEEK_BASE_URL` | No | No | Defaults to `https://api.deepseek.com` |
| `DEEPSEEK_VISION_MODEL` | No | No | Defaults to `deepseek-flash`; the official model documentation confirms image input support |
| `FEATURE_DEEPSEEK_PIPELINE` | No | No | Keep `0` initially; set to `1` to enable the optional server pipeline |
| `GROQ_STT_MODEL` | No | No | Defaults to `whisper-large-v3-turbo` |
| `RATE_LIMIT_VISION_PER_MINUTE` | No | No | Defaults to 5 per IP |
| `RATE_LIMIT_VOICE_PER_MINUTE` | No | No | Defaults to 5 per IP |
| `RATE_LIMIT_SOS_PER_MINUTE` | No | No | Defaults to 8 per IP |
| `RATE_LIMIT_CHAT_PER_MINUTE` | No | No | Defaults to 20 per IP |
| `RATE_LIMIT_QUOTE_PER_MINUTE` | No | No | Defaults to 10 per IP |
| `RATE_LIMIT_CALLBACK_PER_MINUTE` | No | No | Defaults to 10 per IP |
| `NEXT_PUBLIC_SITE_URL` | No | No | Public website URL |
| `NEXT_PUBLIC_CONTACT_PHONE` | No | No | Public contact information |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | No | Public contact information |

For the first deployment, leave `FEATURE_DEEPSEEK_PIPELINE=0`. The existing analysis path remains active. Enable it only after setting the required server variables and verifying the configured model identifier. Disabling it (`0` or unset) returns the image and audio routes to their existing analysis path.

## Production and verification

- `npm test` runs the current Vitest suite.
- `npm run smoke` validates the public routes and basic invalid POST handling.
- `npm run build` confirms the app compiles for production.
- `npm run typecheck` validates TypeScript.

The optional pipeline keeps the existing `/api/vision-check` and `/api/voice-sos` response fields, but provider/model metadata is intentionally omitted from responses. Image payloads are capped at 4 MiB; voice uploads are capped at 5.5 MiB and rejected before multipart parsing when the declared request is oversized. Tests use mocked network calls; live provider and Telegram delivery must be verified separately in a controlled deployment.

Rate limiting is a temporary per-process, in-memory measure and is not shared across Netlify instances. For deployment-wide enforcement, replace it with shared storage such as Upstash Redis before scaling. The accepted audio upload limit is 5.5 MiB, while voice recording uses a low target bitrate and warns at 4.5 MiB.

The repository declares Node `>=20.0.0 <21.0.0`; `.nvmrc` selects Node 20.

### Security audit and local validation

The captured pre-fix report is in `docs/audit-before.json`: it contained 10 findings (2 critical, 2 high, 6 moderate). The critical findings were in the test toolchain, while the `zod` high finding affected a production dependency. `npm audit fix` could not remediate them without major upgrades, so `npm audit fix --force` was used after the existing tests and production build passed. Vitest, Tailwind CSS, and Zod were upgraded to their patched major versions; the Zod 4 validation-option changes were updated in `lib/schemas.ts`.

The final report in `docs/audit-after.json` contains 0 vulnerabilities. After the upgrades, all 28 tests passed, TypeScript passed, `npm run build` passed, and `netlify build --offline` passed. The project does not define an `npm run lint` script. Local checks used Node `v24.19.0` because only Node 24 was installed; Node 20 is specified by `.nvmrc` and `engines` but was not locally available for verification.

## Notes

- This repository is intended to remain additive-only and contract-stable during controlled modernization phases.
- Keep the current public behavior unchanged unless a later phase explicitly introduces a guarded enhancement.
