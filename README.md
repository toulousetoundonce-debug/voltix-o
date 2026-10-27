# Voltix Dynamics

Voltix Dynamics is a Next.js + TypeScript marketing and service platform built for the Algerian market. The app includes a public-facing marketing site, quotation flow, emergency/SOS workflow, callback requests, audio support, and image-based checks.

## Local setup

For local development, install Node dependencies, copy `.env.example` to `.env.local`, configure the server-side provider credentials you use, then run Next.js with `npm run dev`.

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
npm run pricing:check
npm run pricing:calibrate
```

### Indicative pricing catalog

The calculator's server-side estimate engine is in `lib/pricing/`. All 16 seeded catalog entries are explicit placeholders and have `needsReview: true`; replace their DZD/USD unit prices and source metadata with current supplier quotes before relying on customer estimates. Confirm VAT (currently 19%), labor/transport rates, regional coefficients, USD/DZD exchange rate, and copper index in `lib/pricing/config.ts`. The strict catalog gate intentionally exits non-zero while any prices still need review:

```powershell
npm run pricing:check
npm run pricing:check -- --strict
npm run pricing:calibrate
```

`data/calibration.csv` starts empty. Add completed estimate/final-price pairs to it to calculate average deviation by service line; calibration prints suggestions only and never changes production pricing automatically.

## Environment variables

Environment variable names are intentionally kept in `.env.example` and are the source of truth. Do not add secrets to `NEXT_PUBLIC_*` variables. Server-only values must remain on the runtime host and should never be logged or printed.

### Netlify

Connect the GitHub repository to Netlify. The root `netlify.toml` configures the Next.js build and adapter. Add server-only values through **Project configuration → Environment variables**; do not put secret values in `netlify.toml`, `.env.example`, or `NEXT_PUBLIC_*` variables.

| Variable | Required | Secret | Notes |
| --- | --- | --- | --- |
| `SOS_WEBHOOK_URL` | For SOS webhook delivery | Yes | Existing optional webhook endpoint |
| `QUOTE_WEBHOOK_URL` | For quote webhook delivery | Yes | Existing optional webhook endpoint |
| `GROQ_API_KEY` | For chat, image analysis, voice transcription and voice triage | Yes | Server-only credential |
| `GROQ_MODEL` | No | No | Existing chat model override |
| `GROQ_VISION_MODEL` | No | No | Defaults to `qwen/qwen3.8-27b`; used for image diagnostics |
| `GROQ_TRIAGE_MODEL` | No | No | Defaults to `qwen/qwen3.8-27b`; used to summarize voice transcripts |
| `GROQ_STT_MODEL` | No | No | Defaults to `whisper-large-v3-turbo`; transcribes supported audio |
| `NEXT_PUBLIC_SUPABASE_URL` | For direct browser image uploads | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For direct browser image uploads | No | Public anon/publishable key only; never use the service-role key here |
| `NEXT_PUBLIC_SUPABASE_BUCKET` | No | No | Public image bucket; defaults to `fault-images` |
| `TELEGRAM_BOT_TOKEN` | For Telegram delivery | Yes | Existing server-only bot credential |
| `TELEGRAM_CHAT_ID` | For Telegram delivery | Yes | Existing default recipient |
| `TELEGRAM_ALERT_CHAT_ID` | No | Yes | Optional recipient for emergency dispatch cards |
| `TELEGRAM_THREAD_ID` | No | No | Optional Telegram forum topic/thread ID |
| `DEEPSEEK_API_KEY` | For optional triage | Yes | Only used when the optional DeepSeek pipeline is enabled |
| `DEEPSEEK_BASE_URL` | No | No | Defaults to `https://api.deepseek.com` |
| `DEEPSEEK_CHAT_MODEL` | For `/api/agent/chat` and optional SOS triage | No | Defaults to `deepseek-chat`; uses the official DeepSeek API |
| `DEEPSEEK_VISION_MODEL` | No | No | Defaults to `deepseek-flash` |
| `FEATURE_DEEPSEEK_PIPELINE` | No | No | Keep `0` initially; set to `1` to enable the optional server pipeline |
| `RATE_LIMIT_VISION_PER_MINUTE` | No | No | Defaults to 5 per IP |
| `RATE_LIMIT_VOICE_PER_MINUTE` | No | No | Defaults to 5 per IP |
| `RATE_LIMIT_SOS_PER_MINUTE` | No | No | Defaults to 8 per IP |
| `RATE_LIMIT_CHAT_PER_MINUTE` | No | No | Defaults to 20 per IP |
| `RATE_LIMIT_AGENT_CHAT_PER_MINUTE` | No | No | Defaults to 10 per IP |
| `RATE_LIMIT_QUOTE_PER_MINUTE` | No | No | Defaults to 10 per IP |
| `RATE_LIMIT_CALLBACK_PER_MINUTE` | No | No | Defaults to 10 per IP |
| `NEXT_PUBLIC_SITE_URL` | No | No | Public website URL |
| `NEXT_PUBLIC_CONTACT_PHONE` | No | No | Public contact information |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | No | Public contact information |

Image diagnostics and audio transcription/triage use the configured Groq key and model names. When `FEATURE_DEEPSEEK_PIPELINE=1`, DeepSeek replaces the default Groq text triage for voice and optional SOS reports; it is not required for either image or voice analysis. `/api/agent/chat` uses the official DeepSeek API and requires `DEEPSEEK_API_KEY`.

### Supabase fault-image storage

Create a **public** Storage bucket named `fault-images` (or set `NEXT_PUBLIC_SUPABASE_BUCKET` to the bucket name). Public buckets make uploaded images readable by anyone who has the URL. The browser compresses images to WebP at no more than 150 KiB, then uploads directly with the anon key; the service-role key must never be used in the browser. Add an anonymous insert-only policy scoped to the `faults/` prefix, and limit the bucket to WebP/153600 bytes:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fault-images', 'fault-images', true, 153600, array['image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 153600, allowed_mime_types = array['image/webp'];

create policy "Allow anonymous fault image uploads"
on storage.objects for insert to anon
with check (
  bucket_id = 'fault-images'
  and name like 'faults/%'
  and lower(name) like '%.webp'
);
```

Run the `create policy` statement once. Configure Supabase CORS for the website origin. Uploads are public and currently have no deletion lifecycle; apply a retention policy and abuse protection (for example, CAPTCHA and shared rate limiting) before production launch. Supabase is optional: with it configured, the browser uploads the compressed image and passes the validated public URL to Groq; without it, the browser sends the same compressed WebP as a data URL directly to the server for analysis. Telegram SOS delivery includes the public image when Supabase is enabled and a WhatsApp button for the supplied customer number. Set `FEATURE_DEEPSEEK_PIPELINE=1` with `DEEPSEEK_API_KEY` to enable DeepSeek text triage.

## VPS deployment with Docker

Docker Compose runs the Voltix Next.js application only. Chat, image, and audio requests use the server-side provider integrations configured in `.env`; no local model containers are included.

On the VPS, install Docker Engine and the Docker Compose plugin, then clone the repository and run:

```sh
cp .env.example .env
```

Keep `.env` private and out of version control. Add the provider credentials required for the AI features you intend to use. Then build and start the app:

```sh
docker compose up -d --build --remove-orphans
docker compose logs -f voltix
```

The app container port is published only on `127.0.0.1` (default host port `3000`), not on the public network. Configure the VPS's existing HTTPS reverse proxy to forward requests to `http://127.0.0.1:3000`, preserve the request host, and set the forwarded client IP headers. The streamed agent page is available at `/agent.html`. The `--remove-orphans` option removes containers for services removed from this Compose project; it does not delete Docker volumes.

To stop the service, run `docker compose down`. The existing Netlify deployment remains available; Docker is an additional deployment option.

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
