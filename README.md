# Pension Plan Dashboard

Refined user-facing pensions dashboard with a read-only, portfolio-aware assistant, document upload scanning, projection views, investment review pages and user-testable AI provider settings.

## What changed in this version

- Full UI restyled to the clean **Pension Plan** design shown in the preview mockups.
- Sidebar, cards, metrics, charts, tables, form controls and chat composer now share one consistent layout system. Number styling has been softened so currency and percentage values are cleaner and less visually heavy.
- The Target & Projection page is pot-value first, with clear readable Income / Pot value / Gap tabs.
- Old helper copy such as drag/scroll chart instructions and automatic document-update wording has been removed.
- The Assistant page now includes a slim chat input, user-facing **Connection settings (API testing)**, and an in-chat risk-profile questionnaire before deeper investment suggestions.
- Settings keeps planning, notification and security controls while API testing stays on the Assistant page to avoid repeated forms.
- The legal/investment answering guide remains server-side under `server/prompts/`.
- The assistant keeps audit/source metadata in the API response but does not paste a data-used section into chat answers.
- Production backend hardening now includes password auth APIs, 2FA recovery codes, password reset flow, rate limiting, lockout, answer audit logs, compliance cases, background document-scan jobs and admin monitoring endpoints.

## Run locally

```bash
npm install
cp .env.example .env
npm start
```

Open:

```text
http://localhost:3000
```

## Render deployment

The repository includes `render.yaml` for a Render Blueprint with:

- a Node web service,
- a Render Postgres database,
- a daily cron job that runs the pension agent and dispatch queue.

The app reads `DATABASE_URL` when `PENSIONS_STORAGE=postgres`. Render injects the internal Postgres connection string through `fromDatabase`, and the EmailJS values are declared with `sync: false` so Render asks for them instead of storing secrets in Git.

For local testing, keep real values only in `.env`. For Render, add them in the Render Dashboard or during Blueprint creation. Do not commit `.env` or `data/`.

To clear local ignored demo state before presenting:

```bash
npm run reset:demo-data
```

## User-side API testing

The Assistant page allows a tester to choose:

```text
OpenAI
Gemini
Groq
OpenRouter
Ollama / local
Custom OpenAI-compatible
```

The tester can enter an API key, model and optional endpoint, then use **Save connection** or **Test connection**. These browser-entered settings are used for local testing requests and do not expose the backend answer guide. OpenAI, Gemini, Groq, OpenRouter and Custom OpenAI-compatible providers are all routed by the backend. Ollama is supported when a local server is running. Live success still requires the tester to supply a valid key for the selected provider.

## API routes

```text
GET  /api/status
GET  /api/portfolio
POST /api/assistant
POST /api/test-connection
POST /api/extract-document
POST /api/extract-document      with { "async": true } to queue a scan job
POST /api/investment-review

GET  /api/auth/status
GET  /api/auth/session
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/2fa/start
POST /api/auth/2fa/verify
POST /api/auth/2fa/recovery
POST /api/auth/password-reset/start
POST /api/auth/password-reset/complete

GET  /api/agent/summary
GET  /api/actions
POST /api/actions
PATCH /api/actions/:id
POST /api/accounts
GET  /api/notifications
PATCH /api/notifications/:id/read
PATCH /api/notifications/:id/dismiss
GET  /api/notification-preferences
PUT  /api/notification-preferences
GET  /api/risk-profile
PUT  /api/risk-profile
GET  /api/documents
PATCH /api/documents/:id/facts
POST /api/documents/:id/confirm
GET  /api/integrations/status
GET  /api/compliance/status
GET  /api/compliance/audit-log
GET  /api/compliance/answer-audits
GET  /api/jobs
GET  /api/jobs/:id
GET  /api/jobs/status
GET  /api/scheduler/status
POST /api/scheduler/run
GET  /api/admin/monitoring
GET  /api/admin/deletion-requests
PATCH /api/admin/deletion-requests/:id
GET  /api/admin/compliance-cases
PATCH /api/admin/compliance-cases/:id
GET  /api/explain-number?metric=monthlyGap
```

`POST /api/assistant` remains portfolio-aware. The backend loads the verified portfolio snapshot, applies the hidden answer guide, and returns structured data-used metadata separately from the chat answer.

`POST /api/extract-document` extracts factual document fields for the dashboard. Readable text falls back to local extraction when no API key is configured.

The backend now includes a persisted agent layer. It writes local user data under `data/users/alex-morgan/` for portfolio data, risk profile, actions, notifications, notification preferences and audit logs. The agent checks documents, provider status, charges, target gap, stale data and risk-profile completeness, then returns next-best-action and assistant-context data through `/api/agent/summary`.

Email alerts use the notification email saved in Settings as the destination. Real sending stays off until a provider is configured in environment variables. Supported providers are Resend, SendGrid, Postmark, AWS SES, EmailJS and a generic webhook. For EmailJS, create a service and template with `to_email`, `alert_title`, `alert_body` and `linked_view` template fields, then set `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID` and `EMAILJS_PUBLIC_KEY` in `.env` or your hosting provider. Optional `EMAILJS_PRIVATE_KEY`, `RESEND_API_KEY`, `SENDGRID_API_KEY`, `POSTMARK_SERVER_TOKEN`, AWS SES variables and `EMAIL_WEBHOOK_URL` are also supported. Never commit real provider keys.

For production auth, set `REQUIRE_AUTH=true` and keep `REQUIRE_2FA=true`. The backend supports password registration/login, secure HTTP-only session cookies, session expiry, account lockout, password reset records and one-time recovery codes. The demo UI can still run with `REQUIRE_AUTH=false`.

For production storage, Render should use `PENSIONS_STORAGE=postgres` and `DATABASE_URL`. The backend creates both the compatibility JSONB store and relational tables for users, pension accounts, documents, actions, notifications and audit events.

## Backend-only guidance

The legal/investment guide is retained here:

```text
server/prompts/ANSWER_QUALITY_GUIDE.md
server/prompts/assistantGuide.js
```

Static serving is allowlisted to `index.html`, `app.js` and `styles.css`, so prompt files, Markdown files and environment files are not served from the browser.

## Checks

```bash
npm run check
npm test
npm run visual:check
```

## Investment advice flow

When a user asks for investment advice or investment suggestions without enough risk information, the chat first asks a short risk-profile questionnaire: preferred style, time horizon, temporary loss tolerance, main goal and must-check items. Once the user answers, the assistant links the suggestion to the verified portfolio, current investment style and saved investment review context.
