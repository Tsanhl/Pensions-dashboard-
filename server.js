import "./server/loadEnv.js";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAssistantInstructions } from "./server/prompts/assistantGuide.js";
import { getVerifiedDashboardContext, getDocumentScanContext, getPortfolioSeedForUser } from "./server/portfolioStore.js";
import { handleProductApiRoute } from "./server/routes/productApiRoutes.js";
import { escalateActionsForAssistantQuestion, questionDependencyWarning } from "./server/services/actionService.js";
import { runAgentForUser } from "./server/services/agentService.js";
import { findSessionByToken } from "./server/services/authService.js";
import { addDocumentConfidence, storeScannedDocument } from "./server/services/documentService.js";
import { complianceMetadata } from "./server/services/complianceService.js";
import { createNotification } from "./server/services/notificationService.js";
import { startAgentScheduler } from "./server/services/schedulerService.js";
import { appendAuditEvent, initialiseDataStore, readRiskProfile } from "./server/store/userDataStore.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

function loadDotEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").replace(/^["']|["']$/g, "");
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);

await initialiseDataStore();

function authenticatedUserId(req) {
  const envUser = process.env.AUTHENTICATED_USER_ID || "alex-morgan";
  const auth = String(req?.headers?.authorization || "");
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : String(req?.headers?.["x-session-token"] || "").trim();
  const sessionUser = bearer ? findSessionByToken(bearer)?.userId : "";
  const headerUser = req?.headers?.["x-demo-user-id"];
  let queryUser = "";
  try {
    queryUser = new URL(req?.url || "/", `http://${req?.headers?.host || "localhost"}`).searchParams.get("userId") || "";
  } catch {}
  return String(sessionUser || (Array.isArray(headerUser) ? headerUser[0] : headerUser) || queryUser || envUser || "alex-morgan").trim() || "alex-morgan";
}

function bearerToken(req) {
  const auth = String(req?.headers?.authorization || "");
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : String(req?.headers?.["x-session-token"] || "").trim();
}

function productionAuthRequired() {
  return String(process.env.REQUIRE_AUTH || "").toLowerCase() === "true";
}

function mfaRequired() {
  return String(process.env.REQUIRE_2FA || "true").toLowerCase() !== "false";
}

function publicApiPath(pathname = "") {
  return pathname === "/api/status" || pathname.startsWith("/api/auth/");
}

function requireSessionForApi(req, pathname = "") {
  if (!productionAuthRequired() || !pathname.startsWith("/api/") || publicApiPath(pathname)) return null;
  const session = bearerToken(req) ? findSessionByToken(bearerToken(req)) : null;
  if (!session?.session) {
    const error = new Error("Sign in is required for this API.");
    error.status = 401;
    throw error;
  }
  if (mfaRequired() && !session.session.mfaVerified) {
    const error = new Error("Two-factor verification is required for this API.");
    error.status = 403;
    throw error;
  }
  return session;
}

const PROVIDERS = {
  openai: {
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    envModel: "OPENAI_MODEL",
    defaultModel: "gpt-4.1-mini",
    searchMode: "openai_responses_web_search"
  },
  gemini: {
    label: "Gemini",
    envKey: "GEMINI_API_KEY",
    envModel: "GEMINI_MODEL",
    defaultModel: "gemini-2.5-flash",
    searchMode: "prompt_verified_only"
  },
  groq: {
    label: "Groq",
    envKey: "GROQ_API_KEY",
    envModel: "GROQ_MODEL",
    defaultModel: "groq/compound-mini",
    baseUrl: "https://api.groq.com/openai/v1",
    searchMode: "compound_model_builtin"
  },
  openrouter: {
    label: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    envModel: "OPENROUTER_MODEL",
    defaultModel: "openrouter/free",
    baseUrl: "https://openrouter.ai/api/v1",
    searchMode: "model_dependent"
  },
  ollama: {
    label: "Ollama local",
    envKey: "OLLAMA_API_KEY",
    envModel: "OLLAMA_MODEL",
    defaultModel: "llama3.1",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    searchMode: "none"
  },
  custom: {
    label: "Custom OpenAI-compatible",
    envKey: "CUSTOM_AI_API_KEY",
    envModel: "CUSTOM_AI_MODEL",
    defaultModel: "gpt-4o-mini",
    baseUrl: process.env.CUSTOM_AI_BASE_URL || "",
    searchMode: "none"
  }
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_500_000) {
        req.destroy();
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function normalizeProvider(value) {
  const raw = String(value || "").trim().toLowerCase();
  const aliases = {
    "": "openai",
    auto: "openai",
    openai: "openai",
    chatgpt: "openai",
    gpt: "openai",
    google: "gemini",
    "google ai": "gemini",
    gemini: "gemini",
    groq: "groq",
    openrouter: "openrouter",
    "open router": "openrouter",
    ollama: "ollama",
    "ollama local": "ollama",
    local: "ollama",
    custom: "custom",
    "custom openai": "custom",
    "openai compatible": "custom"
  };
  const normalized = aliases[raw] || raw;
  return PROVIDERS[normalized] ? normalized : "openai";
}

function isPlaceholderApiKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return false;
  return ["your_api_key", "api_key_here", "paste_api_key", "placeholder", "replace_me", "change_me"].some((marker) => key.includes(marker));
}

function detectProviderFromKey(value) {
  const key = String(value || "").trim();
  const low = key.toLowerCase();
  if (!key || isPlaceholderApiKey(key)) return "";
  if (key.startsWith("AIza")) return "gemini";
  if (low.startsWith("gsk_")) return "groq";
  if (low.startsWith("sk-or-") || low.startsWith("sk-router-")) return "openrouter";
  if (low.startsWith("sk-proj-") || low.startsWith("sk-")) return "openai";
  return "";
}

function envKey(provider) {
  const config = PROVIDERS[provider] || PROVIDERS.openai;
  const value = String(process.env[config.envKey] || "").trim();
  return isPlaceholderApiKey(value) ? "" : value;
}

function resolveProvider(body) {
  const requested = normalizeProvider(body.provider || body.settings?.provider || "");
  const keyProvider = detectProviderFromKey(body.apiKey);
  const providerWasDefaultOpenAI = (!body.provider && !body.settings?.provider) || requested === "openai";
  if (keyProvider && providerWasDefaultOpenAI) return keyProvider;
  return requested;
}

function resolveApiKey(provider, body) {
  const entered = String(body.apiKey || "").trim();
  if (entered && !isPlaceholderApiKey(entered)) return entered;
  return envKey(provider);
}

function safeModelName(provider, value) {
  const config = PROVIDERS[provider] || PROVIDERS.openai;
  const fallback = process.env[config.envModel] || config.defaultModel;
  const model = String(value || "").trim() || fallback;
  return /^[a-zA-Z0-9._:\/+-]{2,120}$/.test(model) ? model : fallback;
}

function extractOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  if (chunks.length) return chunks.join("\n").trim();
  const chatContent = data.choices?.[0]?.message?.content;
  if (typeof chatContent === "string") return chatContent.trim();
  if (Array.isArray(chatContent)) {
    return chatContent.map((part) => part?.text || part?.content || "").join("\n").trim();
  }
  const gemini = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
  if (gemini) return gemini;
  const ollama = data.message?.content || data.response;
  return String(ollama || "").trim();
}

function shouldUseCurrentSearch(question, settings, provider, model) {
  if (settings?.useSearch === false) return false;
  const text = String(question || "").toLowerCase();
  const asksCurrent = settings?.useSearch === true || /\b(current|latest|law|legal|rights|employer|scheme|trustee|transfer|tax|regulation|regulator|fca|tpr|ombudsman|state pension|can my employer|allowed)\b/.test(text);
  if (!asksCurrent) return false;
  if (provider === "openai") return true;
  if (provider === "groq" && String(model || "").toLowerCase().startsWith("groq/compound")) return true;
  return false;
}

function isLegalQuestionText(question = "") {
  return /\b(employer|workplace pension|change my pension|change my workplace|scheme|legal|law|rights|trustee|tax|hmrc|fca|tpr|regulator|regulation|transfer|contract|complaint|ombudsman|divorce|inheritance|beneficiary|defined benefit|guarantee|protected pension age|exit charge)\b/i.test(String(question || ""));
}

function providerSearchNote(provider, model, useSearch) {
  if (!useSearch) return "No external/current-source check was used. If current law, tax or provider rules matter, the answer must say what needs verification.";
  if (provider === "openai") return "Current-source checking may be used where the configured OpenAI model and tools support it.";
  if (provider === "groq") return `Current-source checking is only available when using a Groq Compound system such as groq/compound or groq/compound-mini. Configured model: ${model}.`;
  if (provider === "gemini") return "Gemini generation is configured. Current-law verification must be stated as unverified unless grounded in supplied or verified sources.";
  if (provider === "openrouter") return "OpenRouter model capabilities vary. Current-law verification must be stated as unverified unless the configured model provides reliable sourced support.";
  if (provider === "ollama") return "The local model has no built-in current-law web search. It must not claim current law has been verified.";
  return "Current-law verification depends on the configured provider and model.";
}

function plainValue(value) {
  return String(value ?? "").trim();
}

function buildDashboardSummary(dashboard = {}) {
  const accounts = Array.isArray(dashboard.pensionAccounts) ? dashboard.pensionAccounts : [];
  const docs = Array.isArray(dashboard.documents) ? dashboard.documents : [];
  const largest = accounts
    .map((a) => ({ provider: plainValue(a.provider), name: plainValue(a.name), pot: plainValue(a.pot), charges: plainValue(a.charges), type: plainValue(a.type), source: plainValue(a.source) }))
    .filter((a) => a.provider || a.name)
    .slice(0, 8);
  const reviewDocs = docs.filter((d) => /review|needs|extract|pending/i.test(`${d.status || ""} ${JSON.stringify(d.extracted || {})}`)).length;
  const scenarios = Array.isArray(dashboard.contributionScenarios)
    ? dashboard.contributionScenarios.map((scenario) => `${scenario.extraMonthlyContribution}/month -> pot ${scenario.projectedFinalPot}, income ${scenario.projectedMonthlyIncome}, gap ${scenario.monthlyGap}`).join("; ")
    : "";
  return [
    `Target: ${plainValue(dashboard.monthlyTarget) || "not provided"}; projected income: ${plainValue(dashboard.projectedMonthlyIncome) || "not provided"}; gap: ${plainValue(dashboard.monthlyGap) || "not provided"}; coverage: ${plainValue(dashboard.coverage) || "not provided"}.`,
    `Pension pot value: ${plainValue(dashboard.pensionPotValue) || "not provided"}; State Pension: ${plainValue(dashboard.statePension?.monthlyIncome) || "not provided"}.`,
    `Contribution scenarios: ${scenarios || "not calculated"}.`,
    `Savings: ${plainValue(dashboard.savings?.currentSavings) || "not provided"}; months covered: ${plainValue(dashboard.savings?.monthsCovered) || "not provided"}.`,
    `Investment profile: ${plainValue(dashboard.investmentProfile?.currentStyle) || "not provided"}; equity ${plainValue(dashboard.investmentProfile?.equityExposure) || "not provided"}; bonds ${plainValue(dashboard.investmentProfile?.bondExposure) || "not provided"}; cash/other ${plainValue(dashboard.investmentProfile?.cashOther) || "not provided"}.`,
    `Accounts summary: ${JSON.stringify(largest)}.`,
    `Documents needing review: ${reviewDocs}; latest system update: ${plainValue(dashboard.systemUpdate?.label) || "not provided"} ${plainValue(dashboard.systemUpdate?.date) || ""}.`
  ].join("\n");
}

function buildUserMessage({ question, dashboard, settings }) {
  const legalQuestion = isLegalQuestionText(question);
  return [
    "Dashboard context JSON:",
    JSON.stringify(dashboard || {}, null, 2),
    "",
    "Assistant settings JSON:",
    JSON.stringify({
      ...(settings || {}),
      legalQuestion,
      legalCurrentSourceRequired: legalQuestion,
      legalSourceRule: legalQuestion
        ? "Do not state a final legal/tax/provider-rule conclusion unless current sources or uploaded documents verify it. If not verified, give the legal route and what to check."
        : ""
    }, null, 2),
    "",
    `User question: ${question}`
  ].join("\n");
}

async function postJson(url, { headers = {}, body, timeoutMs = 60_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    const contentType = response.headers.get("content-type") || "";
    if (text && contentType.includes("application/json")) {
      try { data = JSON.parse(text); } catch { data = {}; }
    } else if (text) {
      const plain = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      data = { error: plain ? `Provider returned non-JSON content: ${plain.slice(0, 180)}` : "Provider returned non-JSON content." };
    }
    if (!response.ok) {
      const error = new Error(data.error?.message || data.error?.error?.message || data.message || data.error || "Provider request failed");
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI({ apiKey, model, question, dashboard, settings, useSearch, retryWithoutTools = false }) {
  const tools = useSearch && !retryWithoutTools ? [{ type: "web_search" }] : undefined;
  const payload = {
    model,
    instructions: buildAssistantInstructions({ providerLabel: PROVIDERS.openai.label, model, currentSourceNote: providerSearchNote("openai", model, Boolean(tools)), riskProfile: settings?.riskProfile || "" }),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildUserMessage({ question, dashboard, settings })
          }
        ]
      }
    ],
    max_output_tokens: 950
  };
  if (tools) payload.tools = tools;

  try {
    const data = await postJson("https://api.openai.com/v1/responses", {
      headers: { Authorization: `Bearer ${apiKey}` },
      body: payload
    });
    return { answer: extractOutputText(data), usedSearch: Boolean(tools), model, provider: "openai" };
  } catch (error) {
    const toolIssue = /tool|web_search|unsupported|unknown|invalid/i.test(error.message || "");
    if (tools && toolIssue) return callOpenAI({ apiKey, model, question, dashboard, settings, useSearch: false, retryWithoutTools: true });
    throw error;
  }
}

function resolveCompatibleBaseUrl(provider, endpoint = "") {
  const configured = String(endpoint || "").trim() || String(PROVIDERS[provider]?.baseUrl || "").trim();
  const fallback = provider === "custom" ? "" : String(PROVIDERS[provider]?.baseUrl || "").trim();
  const base = (configured || fallback).replace(/\/$/, "");
  return base.replace(/\/chat\/completions$/i, "");
}

function compatibleChatPayload(provider, { model, messages, temperature = 0.2, maxTokens = 950 } = {}) {
  const payload = { model, messages, temperature };
  if (provider === "groq") payload.max_completion_tokens = maxTokens;
  else payload.max_tokens = maxTokens;
  return payload;
}

async function callOpenAICompatible({ provider, apiKey, model, question, dashboard, settings, useSearch, endpoint = "" }) {
  const baseUrl = resolveCompatibleBaseUrl(provider, endpoint);
  if (!baseUrl) throw new Error("An endpoint is required for a custom OpenAI-compatible provider.");
  const messages = [
    { role: "system", content: buildAssistantInstructions({ providerLabel: PROVIDERS[provider]?.label || provider, model, currentSourceNote: providerSearchNote(provider, model, useSearch), riskProfile: settings?.riskProfile || "" }) },
    { role: "user", content: buildUserMessage({ question, dashboard, settings }) }
  ];
  const headers = { Authorization: `Bearer ${apiKey}` };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
    headers["X-Title"] = process.env.OPENROUTER_APP_TITLE || "Pensions Dashboard";
  }
  const data = await postJson(`${baseUrl}/chat/completions`, {
    headers,
    body: compatibleChatPayload(provider, { model, messages, temperature: 0.2, maxTokens: 950 })
  });
  const actuallyUsedSearch = provider === "groq" && useSearch && String(model || "").toLowerCase().startsWith("groq/compound");
  return { answer: extractOutputText(data), usedSearch: actuallyUsedSearch, model, provider };
}

async function callGemini({ apiKey, model, question, dashboard, settings, useSearch }) {
  const urlModel = encodeURIComponent(model).replaceAll("%2F", "/");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${urlModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const data = await postJson(url, {
    body: {
      systemInstruction: {
        parts: [{ text: buildAssistantInstructions({ providerLabel: PROVIDERS.gemini.label, model, currentSourceNote: providerSearchNote("gemini", model, useSearch), riskProfile: settings?.riskProfile || "" }) }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: buildUserMessage({ question, dashboard, settings }) }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 950
      }
    }
  });
  return { answer: extractOutputText(data), usedSearch: false, model, provider: "gemini" };
}

async function callOllama({ model, question, dashboard, settings, useSearch }) {
  const base = String(process.env.OLLAMA_BASE_URL || PROVIDERS.ollama.baseUrl || "http://localhost:11434").replace(/\/$/, "");
  const data = await postJson(`${base}/api/chat`, {
    body: {
      model,
      messages: [
        { role: "system", content: buildAssistantInstructions({ providerLabel: PROVIDERS.ollama.label, model, currentSourceNote: providerSearchNote("ollama", model, useSearch), riskProfile: settings?.riskProfile || "" }) },
        { role: "user", content: buildUserMessage({ question, dashboard, settings }) }
      ],
      stream: false,
      options: { temperature: 0.2 }
    },
    timeoutMs: 90_000
  });
  return { answer: extractOutputText(data), usedSearch: false, model, provider: "ollama" };
}
function stripDataUrl(dataUrl = "") {
  const m = String(dataUrl || "").match(/^data:([^;,]+)?(?:;[^,]*)?,(.*)$/s);
  return m ? { mimeType: m[1] || "application/octet-stream", base64: m[2] || "", url: String(dataUrl) } : { mimeType: "", base64: "", url: "" };
}
function isImageMime(mime = "", name = "") { return String(mime).startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(name); }
function isPdfMime(mime = "", name = "") { return String(mime).includes("pdf") || /\.pdf$/i.test(name); }
function toNumber(value) { const cleaned = String(value ?? "").replace(/[^0-9.-]/g, ""); if (!cleaned || cleaned === "." || cleaned === "-" || cleaned === "-.") return null; const n = Number(cleaned); return Number.isFinite(n) ? n : null; }
function firstMatch(text, patterns) { for (const p of patterns) { const m = text.match(p); if (m) return m[1]?.trim() || ""; } return ""; }
function localExtractDocument(file = {}) {
  const text = String(file.text || "");
  const lower = `${file.fileName || file.name || ""}\n${text}`.toLowerCase();
  const provider = ["Aviva", "Standard Life", "Nest", "OneLife", "Legal & General", "Scottish Widows"].find((n) => lower.includes(n.toLowerCase())) || "Needs review";
  const isPayslip = lower.includes("payslip") || lower.includes("gross monthly") || lower.includes("payroll");
  const category = isPayslip ? "payslip" : lower.includes("state pension") ? "state_pension_forecast" : "pension_statement";
  const employee = toNumber(firstMatch(text, [/employee (?:monthly )?(?:pension )?contribution:\s*£?([\d,]+(?:\.\d+)?)/i, /employee pension contribution:\s*£?([\d,]+(?:\.\d+)?)/i]));
  const employer = toNumber(firstMatch(text, [/employer (?:monthly )?(?:pension )?contribution:\s*£?([\d,]+(?:\.\d+)?)/i, /employer pension contribution:\s*£?([\d,]+(?:\.\d+)?)/i]));
  return {
    documentCategory: category,
    provider,
    scheme: category === "payslip" ? "Payslip" : (firstMatch(text, [/scheme:\s*([^\n]+)/i, /pension scheme:\s*([^\n]+)/i]) || "Workplace Pension"),
    policy: firstMatch(text, [/(?:policy number|policy|reference):\s*([A-Z0-9-]+)/i]),
    statementDate: firstMatch(text, [/(?:statement date|pay date|date):\s*([^\n]+)/i]),
    potValue: toNumber(firstMatch(text, [/current pension pot value:\s*£?([\d,]+(?:\.\d+)?)/i, /current pension value:\s*£?([\d,]+(?:\.\d+)?)/i, /pension value:\s*£?([\d,]+(?:\.\d+)?)/i, /pot value:\s*£?([\d,]+(?:\.\d+)?)/i])),
    salaryMonthly: toNumber(firstMatch(text, [/gross monthly pay:\s*£?([\d,]+(?:\.\d+)?)/i])),
    salaryAnnual: toNumber(firstMatch(text, [/estimated annual salary:\s*£?([\d,]+(?:\.\d+)?)/i, /annual salary:\s*£?([\d,]+(?:\.\d+)?)/i])),
    contributionEmployee: employee,
    contributionEmployer: employer,
    contribution: toNumber(firstMatch(text, [/total monthly contribution:\s*£?([\d,]+(?:\.\d+)?)/i])) || ((employee || employer) ? Number(employee || 0) + Number(employer || 0) : null),
    chargePct: toNumber(firstMatch(text, [/annual management charge:\s*([\d.]+)%/i, /annual charge:\s*([\d.]+)%/i, /charge:\s*([\d.]+)%/i])),
    statePensionMonthly: toNumber(firstMatch(text, [/state pension:\s*£?([\d,]+(?:\.\d+)?)/i])),
    notes: text ? "Extracted from readable document text. Check all values before relying on them." : "No readable text was available. Use a vision/file-capable model for image or scanned PDF extraction."
  };
}
function jsonObjectFromText(text = "") {
  const raw = String(text || "").trim();
  try { return JSON.parse(raw); } catch {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(raw.slice(a, b + 1)); } catch {} }
  return null;
}
function scanPrompt(file, dashboard) {
  return `Extract factual pension-dashboard fields from the document. Output JSON only with keys: documentCategory (payslip|pension_statement|state_pension_forecast|policy|other), provider, scheme, policy, statementDate, potValue, salaryMonthly, salaryAnnual, contributionEmployee, contributionEmployer, contribution, chargePct, statePensionMonthly, notes. Do not invent values. Use null for missing values. No legal, tax or investment advice. Match provider/policy against dashboard only if the document supports it.\n\nFile name: ${file.fileName || file.name || "uploaded"}\nReadable text:\n${String(file.text || "").slice(0, 12000)}\n\nBackend portfolio/provider matches: ${JSON.stringify((dashboard?.accounts || []).map((a) => ({provider:a.provider, policy:a.policy, name:a.name, source:a.source})))} `;
}
async function scanWithOpenAI({apiKey, model, file, dashboard}) {
  const data = stripDataUrl(file.dataUrl);
  const content = [{ type: "input_text", text: scanPrompt(file, dashboard) }];
  if (data.url && isImageMime(file.mimeType || data.mimeType, file.fileName)) content.push({ type: "input_image", image_url: data.url });
  const res = await postJson("https://api.openai.com/v1/responses", { headers: { Authorization: `Bearer ${apiKey}` }, body: { model, instructions: "You are a strict JSON document extraction engine. Return JSON only.", input: [{ role: "user", content }], max_output_tokens: 700 } });
  return jsonObjectFromText(extractOutputText(res));
}
async function scanWithGemini({apiKey, model, file, dashboard}) {
  const data = stripDataUrl(file.dataUrl);
  const parts = [{ text: scanPrompt(file, dashboard) }];
  if (data.base64) parts.push({ inlineData: { mimeType: file.mimeType || data.mimeType || "application/octet-stream", data: data.base64 } });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model).replaceAll("%2F","/")}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await postJson(url, { body: { contents: [{ role: "user", parts }], generationConfig: { temperature: 0.1, maxOutputTokens: 700 } } });
  return jsonObjectFromText(extractOutputText(res));
}
async function scanWithOpenAICompatible({provider, apiKey, model, file, dashboard, endpoint = ""}) {
  const cfg = PROVIDERS[provider] || PROVIDERS.custom;
  const baseUrl = resolveCompatibleBaseUrl(provider, endpoint);
  if (!baseUrl) throw new Error("An endpoint is required for a custom OpenAI-compatible provider.");
  const data = stripDataUrl(file.dataUrl);
  const content = [{ type: "text", text: scanPrompt(file, dashboard) }];
  if (data.url && isImageMime(file.mimeType || data.mimeType, file.fileName)) content.push({ type: "image_url", image_url: { url: data.url } });
  if (provider === "openrouter" && data.url && isPdfMime(file.mimeType || data.mimeType, file.fileName)) content.push({ type: "file", file: { filename: file.fileName || "document.pdf", file_data: data.url } });
  const headers = { Authorization: `Bearer ${apiKey}` };
  if (provider === "openrouter") { headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL || "http://localhost:3000"; headers["X-Title"] = process.env.OPENROUTER_APP_TITLE || "Pensions Dashboard"; }
  const messages = [{ role: "system", content: "Return JSON only. Extract facts; do not advise." }, { role: "user", content }];
  const res = await postJson(`${baseUrl}/chat/completions`, { headers, body: compatibleChatPayload(provider, { model, messages, temperature: 0.1, maxTokens: 700 }) });
  return jsonObjectFromText(extractOutputText(res));
}
async function scanWithOllama({model, file, dashboard}) {
  const data = stripDataUrl(file.dataUrl);
  const msg = { role: "user", content: scanPrompt(file, dashboard) };
  if (data.base64 && isImageMime(file.mimeType || data.mimeType, file.fileName)) msg.images = [data.base64];
  const res = await postJson(`${String(process.env.OLLAMA_BASE_URL || PROVIDERS.ollama.baseUrl).replace(/\/$/, "")}/api/chat`, { body: { model, messages: [{ role: "system", content: "Return JSON only. Extract facts; do not advise." }, msg], stream: false, options: { temperature: 0.1 } }, timeoutMs: 90000 });
  return jsonObjectFromText(extractOutputText(res));
}

function extractionPayload({ userId, file, extraction, provider, model, summary, persist = true }) {
  const enhancedExtraction = addDocumentConfidence(extraction, file);
  const document = persist ? storeScannedDocument(userId, getPortfolioSeedForUser(userId), file, enhancedExtraction, { provider, model, summary }) : null;
  if (persist) {
    createNotification(userId, {
      source: "dashboard_update",
      sourceKey: `document_scan_${document?.id || Date.now()}`,
      category: "documents",
      priority: "high",
      title: "Document scan completed",
      body: `${document?.name || "A document"} was scanned. Review the extracted facts before relying on the dashboard values.`,
      linkedView: "documents"
    });
    runAgentForUser({ userId, persist: true, reason: "document_scan" });
  }
  return {
    extraction: enhancedExtraction,
    documentId: document?.id || null,
    document,
    provider,
    model,
    summary,
    dryRun: !persist
  };
}

async function handleExtractDocument(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const body = JSON.parse(await readBody(req) || "{}");
  const file = body.file || body.document || {};
  const persistScan = body.dryRun !== true;
  if (!file.fileName && !file.name) return json(res, 400, { error: "Document file payload is required" });
  const userId = authenticatedUserId(req);
  const provider = resolveProvider(body);
  const model = safeModelName(provider, body.model || body.settings?.model);
  const apiKey = resolveApiKey(provider, body);
  const endpoint = String(body.endpoint || body.settings?.endpoint || "").trim();
  const dashboard = getDocumentScanContext({ userId });
  if (!apiKey && provider !== "ollama") {
    if (file.text) return json(res, 200, extractionPayload({ userId, file, extraction: localExtractDocument(file), provider: "local", model: "local-text-scan", summary: "No API key was configured, so readable text was scanned locally.", persist: persistScan }));
    return json(res, 503, { error: `No server API key configured for ${PROVIDERS[provider].label}. Upload a readable text document or configure a server-held key for image/PDF scanning.` });
  }
  let extracted = null;
  try {
    if (provider === "openai") extracted = await scanWithOpenAI({apiKey, model, file, dashboard});
    else if (provider === "gemini") extracted = await scanWithGemini({apiKey, model, file, dashboard});
    else if (provider === "groq" || provider === "openrouter" || provider === "custom") extracted = await scanWithOpenAICompatible({provider, apiKey, model, file, dashboard, endpoint});
    else if (provider === "ollama") extracted = await scanWithOllama({model, file, dashboard});
    if (!extracted || typeof extracted !== "object") throw new Error("The model did not return valid extraction JSON");
    return json(res, 200, extractionPayload({ userId, file, extraction: extracted, provider, model, summary: `Document scanned with ${PROVIDERS[provider]?.label || provider}.`, persist: persistScan }));
  } catch (error) {
    if (file.text) return json(res, 200, extractionPayload({ userId, file, extraction: localExtractDocument(file), provider: "local", model: "local-text-scan", summary: `${error.message}. Local readable-text scan was used instead.`, persist: persistScan }));
    return json(res, error.status || 502, { error: error.message || "Document scan failed" });
  }
}


function configuredAssistantProvider() {
  const explicit = normalizeProvider(process.env.ASSISTANT_PROVIDER || process.env.DEFAULT_AI_PROVIDER || "");
  if (envKey(explicit) || explicit === "ollama") return explicit;
  const firstConfigured = Object.keys(PROVIDERS).find((provider) => provider !== "ollama" && envKey(provider));
  return firstConfigured || explicit || "openai";
}

function sanitizeAssistantSettings(raw = {}) {
  const riskProfile = String(raw.riskProfile || "").trim().toLowerCase();
  const defaultStyle = String(raw.investmentStyleDefault || "balanced").trim().toLowerCase();
  return {
    riskProfile: riskProfile === "aggressive" ? "growth" : (["conservative", "balanced", "growth"].includes(riskProfile) ? riskProfile : ""),
    answerMode: "read_only_portfolio_reference",
    strictAccuracy: true,
    portfolioFirst: raw.portfolioLinkedDefault !== false,
    showDataUsedSummary: false,
    investmentStyleDefault: ["conservative", "balanced", "growth"].includes(defaultStyle) ? defaultStyle : "balanced",
    investmentReview: raw.investmentReview && typeof raw.investmentReview === "object" ? raw.investmentReview : null,
    readOnly: true
  };
}

function detectRiskStyle(text = "") {
  const lower = String(text || "").toLowerCase();
  if (/\b(conservative|cautious|low[- ]?risk|safe)\b/.test(lower)) return "conservative";
  if (/\b(aggressive|growth|higher[- ]?risk|high[- ]?risk)\b/.test(lower)) return "growth";
  if (/\b(balanced|medium[- ]?risk|moderate)\b/.test(lower)) return "balanced";
  return "";
}


function hasRiskProfileAnswers(text = "") {
  const lower = String(text || "").toLowerCase();
  const hasStyle = Boolean(detectRiskStyle(lower));
  const hasLoss = /\b(lose|loss|fall|drop|down|volatil|temporary|10%|20%|30%|40%)\b/.test(lower);
  const hasTime = /\b(years?|retire|retirement|age|horizon|long[- ]term|short[- ]term)\b/.test(lower);
  const hasGoal = /\b(goal|gap|income|growth|protect|safety|stable|stability|cash|access|need)\b/.test(lower);
  return hasStyle && (hasLoss || hasTime || hasGoal);
}

function investmentRiskQuestionnaire(dashboard = {}) {
  const p = dashboard.investmentProfile || {};
  return `Answer
Before I give a deeper personalised investment suggestion, please answer these quick risk-profile questions in one message.

1. Preferred style: conservative, balanced or growth?
2. Time horizon: how many years until you expect to use this pension money?
3. Temporary loss tolerance: what fall could you tolerate without panic-selling — for example 10%, 20% or 30%?
4. Main goal: close the monthly gap, protect the pot, grow the pot, or balance growth and stability?
5. Any must-check items: guarantees, high charges, transfer concerns or money you may need soon?

Current dashboard context: ${p.currentStyle || "Balanced"} style, ${p.equityExposure || "62%"} equity, ${p.bondExposure || "28%"} bonds and ${p.cashOther || "10%"} cash / other.

You can reply, for example: “Balanced, 12 years, I can tolerate a 20% fall, goal is to reduce the monthly gap, no known guarantees.”`;
}

function isAmbiguousPensionChangeQuestion(text = "") {
  const lower = String(text || "").toLowerCase();
  const mentionsPension = /\bpensions?\b/.test(lower);
  const asksChange = /\b(change|switch|move|alter|amend|modify|update)\b/.test(lower);
  const hasSpecificChange = /\b(contribution|contribute|salary sacrifice|fund|investment|style|provider|transfer|consolidat|retirement age|target|beneficiar|address|name|document|charge|risk profile|employer|workplace|scheme)\b/.test(lower);
  return mentionsPension && asksChange && !hasSpecificChange;
}

function pensionChangeGuideAnswer(dashboard = {}) {
  const quality = dashboard.dataQuality || {};
  const accounts = Array.isArray(dashboard.pensionAccounts) ? dashboard.pensionAccounts : [];
  const highChargeAccounts = accounts
    .filter((account) => Number(String(account.charges || "").replace(/[^0-9.-]/g, "")) >= 0.75)
    .map((account) => `${account.provider} ${account.charges}`)
    .join(", ");
  const manualAccounts = accounts
    .filter((account) => /manual/i.test(String(account.source || "")))
    .map((account) => account.provider)
    .join(", ");
  const riskProfileText = /risk profile:\s*missing/i.test(String(dashboard.agentContext?.summary || "")) ? " Your risk profile is still missing, so complete that before changing investment style." : "";

  return `Answer
You can change different things about a pension, but the route depends on what you mean. I cannot make the change for you from chat, but I can guide the safest route and tell you what to check first.

What you can change
1. Contributions - change how much goes in, usually through payroll, employer benefits, salary sacrifice or provider contribution settings.
2. Investment style or funds - change the fund/default/lifestyle route through the provider portal after checking your risk profile and fund factsheets.
3. Provider or consolidation - check whether a transfer route exists, but first check guarantees, exit charges, protected pension age, defined-benefit rights, employer contributions and scheme-specific benefits.
4. Retirement age or target - update planning assumptions in the dashboard and check the selected retirement date with the provider.
5. Personal details or beneficiaries - update employer or provider records.
6. Dashboard data - correct document facts or manually entered account records before relying on projections.

Your personalised suggestion
For this dashboard, start with the checks before making any provider or investment change. You have ${dashboard.pensionPotValue || "pension pots recorded"}, projected income of ${dashboard.projectedMonthlyIncome || "not available"} against a ${dashboard.monthlyTarget || "not available"} target, and a ${dashboard.monthlyGap || "not available"} monthly gap.${riskProfileText}${quality.reviewDocs ? ` ${quality.reviewDocs} document item needs review.` : ""}${highChargeAccounts ? ` Higher-charge account to check: ${highChargeAccounts}.` : ""}${manualAccounts ? ` Manual account data to verify: ${manualAccounts}.` : ""}

Next step
Tell me which change you mean: contributions, investment style, provider transfer/consolidation, retirement age/target, personal details, or correcting dashboard data. If you are unsure, start by completing the risk profile and reviewing any document or charge flags, then ask me for the route for that specific change.`;
}

function asksForPortfolioBasedInvestment(text = "") {
  return /\b(my\s+portfolio|portfolio|my\s+pension|my\s+pots?|based\s+on|base\s+on|using\s+my|with\s+my\s+dashboard)\b/i.test(String(text || ""));
}

function dataUsedLines(dashboard, { usedSearch = false, provider = "local", currentSourceNote = "", investmentReview = null } = {}) {
  const quality = dashboard.dataQuality || {};
  const searchText = usedSearch ? "current-source check attempted by the configured model" : "no live external rule check used for this answer";
  return [
    `✓ Pension pots: ${dashboard.dataUsedSummary?.pensionAccounts || `${(dashboard.pensionAccounts || []).length} accounts`} from backend portfolio data.`,
    `✓ State Pension forecast: ${dashboard.dataUsedSummary?.statePension || dashboard.statePension?.monthlyIncome || "not available"}.`,
    `✓ Target gap: ${dashboard.dataUsedSummary?.targetGap || dashboard.monthlyGap || "not available"}.`,
    `✓ Projection assumptions: retirement age ${dashboard.assumptions?.retirementAge ?? "not available"}, growth ${dashboard.assumptions?.growthPct || "not available"}, inflation ${dashboard.assumptions?.inflationPct || "not available"}.`,
    dashboard.dataUsedSummary?.contributionScenarios ? `✓ Contribution scenarios: ${dashboard.dataUsedSummary.contributionScenarios}.` : null,
    `✓ Documents: ${dashboard.dataUsedSummary?.documents || `${(dashboard.documents || []).length} records`}.`,
    `✓ Investment style: ${dashboard.dataUsedSummary?.investmentProfile || dashboard.investmentProfile?.currentStyle || "not available"}.`,
    dashboard.agentContext?.summary ? `✓ Agent context: ${dashboard.agentContext.summary}.` : null,
    investmentReview ? `✓ AI investment review: ${investmentReview.style || "style reviewed"}; ${investmentReview.summary || "review available"}.` : null,
    `✓ Data quality: ${quality.status || "Needs review"}; ${quality.connected ?? 0}/${quality.totalAccounts ?? (dashboard.pensionAccounts || []).length} pensions provider-linked.`,
    `✓ Source: ${dashboard.dataSource || "backend portfolio snapshot"}; no browser portfolio JSON used.`,
    `• External law/tax/provider rules: ${searchText}. ${currentSourceNote}`.trim()
  ].filter(Boolean);
}

function markdownTableToBullets(text = "") {
  const output = [];
  let inTable = false;
  for (const line of String(text || "").split("\n")) {
    const trimmed = line.trim();
    const isTableRow = /^\|.+\|$/.test(trimmed);
    const isSeparator = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed);
    if (isTableRow || isSeparator) {
      if (isSeparator) {
        inTable = true;
        continue;
      }
      const cells = trimmed.split("|").map((cell) => cell.trim()).filter(Boolean);
      if (!inTable) {
        inTable = true;
        continue;
      }
      if (cells.length) {
        const [first, ...rest] = cells;
        output.push(`- ${first}${rest.length ? `: ${rest.join(" - ")}` : ""}`);
      }
      continue;
    }
    inTable = false;
    output.push(line);
  }
  return output.join("\n");
}

function qualityGuardAnswer(answer, { question = "", dashboard = {} } = {}) {
  let text = String(answer || "");
  text = text
    .replace(/\bAdjust the equity mix:\s*/gi, "Review the equity mix: ")
    .replace(/\bIncrease monthly contributions:\s*/gi, "Model contribution changes: ")
    .replace(/\bConfirm the ([^:\n]+?) document:\s*/gi, "Verify the $1 document: ")
    .replace(/\bValidate the cash holding:\s*/gi, "Check the cash holding: ")
    .replace(/\bReview the OneLife personal plan:\s*/gi, "Check the OneLife personal plan: ");

  text = text.replace(/\b(consider|suggest|recommend|move|adjust)\b[^\n.]{0,110}\b(?:\d{1,2}\s*%[^\n.]{0,80}){2,}[^\n.]*/gi, (match) => {
    if (/\b(current|currently|dashboard|shows|with)\b/i.test(match)) return match;
    return "compare your current allocation with a slightly more growth-focused diversified route after checking fund factsheets, charges, guarantees and risk tolerance";
  });

  text = text
    .replace(/whether the ([^.\n]+?) could be transferred to ([^.\n]+?) with lower charges/gi, "whether a transfer or consolidation route exists for the $1, and whether charges, guarantees and scheme-specific benefits would be affected")
    .replace(/\byou will need to complete the provider[’']s transfer forms\b/gi, "ask the provider what process or forms apply")
    .replace(/\bwould cut the projected monthly gap by about\s+£?\d+\s*[-‑–]\s*£?\d+\b/gi, "could reduce the projected monthly gap; run the projection with the changed contribution first")
    .replace(/\beven a modest rise to\s+£?\d+\s*[-‑–]\s*£?\d+\s+per month\s+could reduce the projected monthly gap; run the projection with the changed contribution first/gi, "testing a modest contribution increase in the dashboard could show how much the projected monthly gap changes")
    .replace(/\btransfer or consolidate the ([^.\n]+?) pot \(ask the provider what process or forms apply\)/gi, "ask whether transferring or consolidating the $1 pot is allowed and what charges, guarantees or benefits could be affected");

  if (isAmbiguousPensionChangeQuestion(question) && !/What you can change/i.test(text)) {
    return pensionChangeGuideAnswer(dashboard);
  }
  return text;
}

function ensureLegalAccuracyGuard(answer, { question = "", usedSearch = false } = {}) {
  let text = String(answer || "")
    .replace(/\b100\s*%\s*(accurate|correct|verified)\b/gi, "checked against the available sources")
    .replace(/\bfully\s+(accurate|verified|definitive)\b/gi, "source-checked")
    .replace(/\bdefinitive legal advice\b/gi, "legal-route guidance");

  if (!isLegalQuestionText(question) || usedSearch) return text;
  if (/cannot verify the current law|current law[^.\n]{0,80}(needs|must) be checked|not externally checked/i.test(text)) return text;

  const verificationLine = "I can give the legal route, but I cannot verify the current law from this model. Check current legislation, regulator guidance, scheme rules and provider documents before acting.";
  if (/^Answer\s*\n/i.test(text)) return text.replace(/^Answer\s*\n/i, `Answer\n${verificationLine}\n\n`);
  return `${verificationLine}\n\n${text}`;
}

function cleanAssistantAnswer(answer, context = {}) {
  let base = String(answer || "").trim() || "I could not generate an answer. Please try again.";
  const dataSectionIndex = base.search(/\n\s*Data used in this answer\b/i);
  if (dataSectionIndex >= 0) base = base.slice(0, dataSectionIndex).trim();
  const cleaned = qualityGuardAnswer(markdownTableToBullets(base), context)
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\bPortfolio[- ]linked suggestion\b/gi, "Your personalised suggestion")
    .replace(/\bportfolio[- ]linked investment suggestion\b/gi, "personalised investment suggestion")
    .replace(/\bportfolio[- ]linked suggestion\b/gi, "personalised suggestion")
    .replace(/\bSuggested next step\b/g, "Next step")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return ensureLegalAccuracyGuard(cleaned, context).trim();
}

function appendDataUsedSection(answer, dashboard, meta = {}) {
  const cleaned = cleanAssistantAnswer(answer, { question: meta.question || "", dashboard, usedSearch: Boolean(meta.usedSearch), currentSourceNote: meta.currentSourceNote || "" });
  const warning = String(meta.dependencyWarning || "").trim();
  if (!warning || cleaned.toLowerCase().startsWith(warning.toLowerCase())) return cleaned;
  return `${warning}\n\n${cleaned}`;
}

function portfolioInvestmentSuggestion({ style = "balanced", dashboard, question = "", settings = {} }) {
  const normalizedStyle = style === "aggressive" ? "growth" : style;
  const gap = dashboard.monthlyGap || "not available";
  const years = Number(dashboard.assumptions?.retirementAge || 0) - Number(dashboard.assumptions?.currentAge || 0);
  const largest = dashboard.largestAccount;
  const quality = dashboard.dataQuality || {};
  const investmentProfile = dashboard.investmentProfile || {};
  const accounts = Array.isArray(dashboard.pensionAccounts) ? dashboard.pensionAccounts : [];
  const currentStyle = investmentProfile.currentStyle || "not available";
  const allocationSummary = [investmentProfile.equityExposure && `${investmentProfile.equityExposure} equity`, investmentProfile.bondExposure && `${investmentProfile.bondExposure} bonds`, investmentProfile.cashOther && `${investmentProfile.cashOther} cash/other`].filter(Boolean).join(", ") || "allocation not available";
  const accountSummary = accounts.slice(0, 4).map((account) => `${account.provider}: ${account.pot}, charge ${account.charges}, ${account.source}`).join("; ") || "No account list available";
  const base = {
    conservative: {
      title: "Conservative review direction",
      range: "Rough review range: around 20–40% growth assets/equities, with the rest in bonds, cash or lower-volatility multi-asset funds",
      route: "protect the pot from large swings first, then check whether lower expected growth makes the target gap harder to close.",
      tilt: "Tilt this way if a 15–20% temporary fall would make you change retirement plans, if you need access soon, or if guarantees are valuable."
    },
    balanced: {
      title: "Balanced review direction",
      range: "Rough review range: around 40–70% growth assets/equities inside diversified pension or multi-asset funds",
      route: "keep enough growth potential to work on the target gap while avoiding a fully equity-heavy approach until loss tolerance is known.",
      tilt: "Tilt more conservative if large falls would worry you; tilt more growth if your time horizon is long and you can tolerate temporary losses."
    },
    growth: {
      title: "Growth review direction",
      range: "Rough review range: around 70–90% growth assets/equities, normally through diversified pension funds rather than individual stock picking",
      route: "seek higher long-term growth potential, accepting larger temporary falls and reviewing the risk as retirement gets closer.",
      tilt: "Tilt this way only if you have a long time horizon, strong loss tolerance and no valuable guarantees that would be lost."
    }
  }[normalizedStyle] || null;
  const stockQuestion = /\b(stocks?|shares?|equity|equities)\b/i.test(question);
  const stockParagraph = stockQuestion
    ? `\n\nStocks/equities\nFor your pension pots, I would review diversified equity funds or multi-asset pension funds before considering concentrated individual stocks. With roughly ${Number.isFinite(years) && years > 0 ? `${years} years` : "a long period"} to retirement, some equity exposure may help growth, but putting the whole pot into individual stocks would add concentration risk.`
    : "";

  const aiReview = settings?.investmentReview;
  const aiReviewLine = aiReview?.summary ? ` The saved AI style analysis says: ${String(aiReview.summary).slice(0, 220)}` : "";
  const hasRiskAnswers = hasRiskProfileAnswers(question) || settings?.riskProfileDetails?.completed;
  const reviewRoute = normalizedStyle === "growth" && /balanced/i.test(currentStyle)
    ? "a growth review route to compare against your current balanced style"
    : `a ${normalizedStyle} pension-investment review`;
  const candidateRanges = {
    conservative: "around 20–40% equities/growth assets, with the rest in bonds, cash or lower-volatility multi-asset holdings",
    balanced: "around 40–70% equities/growth assets, with the rest in bonds, cash or lower-volatility multi-asset holdings",
    growth: "around 70–90% equities/growth assets, normally through diversified pension funds rather than individual stock picking"
  };
  const candidateAllocationLine = hasRiskAnswers
    ? `\n\nCandidate allocation review\nReview whether your current mix of ${allocationSummary} still fits, or whether a ${normalizedStyle} range such as ${candidateRanges[normalizedStyle] || candidateRanges.balanced} better matches your horizon and loss tolerance. Treat this as a comparison range, not an instruction to change funds.`
    : "";
  const nextStep = hasRiskAnswers
    ? `Open the fund factsheet for each pot and compare it with ${normalizedStyle === "growth" ? "a more growth-focused diversified route" : `this ${normalizedStyle} route`}. Use the dashboard projection to test the effect before changing funds or contributions.`
    : `Open the fund factsheet for each pot and compare it with this ${normalizedStyle} route. Then tell me your loss tolerance, for example: “I could accept a temporary 20% fall” or “I would be uncomfortable losing more than 10%”.`;

  return `Answer
Based on your verified dashboard snapshot, your current investment style is ${currentStyle} with ${allocationSummary}. The review route is ${reviewRoute}, not a final fund choice. Your current projection is ${dashboard.projectedMonthlyIncome} per month against a ${dashboard.monthlyTarget} target, leaving ${gap} per month. Pension pots total ${dashboard.pensionPotValue}; State Pension is shown separately at ${dashboard.statePension?.monthlyIncome}.${aiReviewLine}

Your personalised suggestion
${base.title}: ${base.route}
${base.range}.
${base.tilt}${candidateAllocationLine}${stockParagraph}

Why this fits the dashboard
The target gap is the main reason not to look only at “safety”; the ${quality.highCharge || 0} charge flag(s), ${quality.reviewDocs || 0} document item(s) needing review and ${quality.connected || 0}/${quality.totalAccounts || accounts.length} provider-linked pots are the main reason not to change funds blindly. Largest pot: ${largest ? `${largest.provider} at ${largest.pot}` : "not available"}. Accounts checked: ${accountSummary}.

What I would check in your pots
Check each pot's current fund name, equity/bond/cash mix, default or lifestyle strategy, annual charge, transaction costs, guarantees, transfer restrictions, retirement-date setting and whether any valuable benefits would be lost.

Next step
${nextStep}`;
}

function genericInvestmentSuggestion() {
  return `Answer\nFor a general investment plan, I would start with a simple review route rather than a product pick: define the goal, time horizon, emergency buffer, risk tolerance, capacity for loss and whether the money belongs in pension, ISA/cash savings or another account.\n\nSuggested direction\nA sensible general starting point is usually diversified funds rather than individual stock picking. Keep short-term money in safer cash-like places, and use diversified investment funds only for money that can stay invested long enough to ride out market falls.\n\nWhat I would check\n1. Goal: retirement income, house deposit, emergency reserve or long-term growth.\n2. Time horizon: short-term money should not be exposed to heavy market risk.\n3. Risk: how much temporary fall you could tolerate without selling at the wrong time.\n4. Diversification: avoid relying on one stock, sector, country or provider.\n5. Costs and tax wrapper: charges, pension/ISA rules and any employer contribution benefits.\n\nNext step\nIf you want a personalised answer, ask: “Use my portfolio and give me a balanced/growth/conservative review.”`;
}

function wantsSpecificInvestmentAdvice(question = "") {
  const lower = String(question || "").toLowerCase();
  return /\b(which|what|where|how much|should i move|should i switch|should i invest|put more|put my pot|buy|sell|funds?|stocks?|shares?|equity|equities|bonds?|allocation|allocate|reallocat|growth|conservative|aggressive|cautious|portfolio mix|investment style|strategy)\b/.test(lower);
}

function isDashboardOrContributionQuestion(question = "") {
  const lower = String(question || "").toLowerCase();
  return /\b(attention|first|flagged|onelife|verify|relying on the projection|data|dashboard|action|review|projection|contribution|add\s*£?\d+|£50|£100|monthly gap|reduce the gap|increase contributions|change investment style first)\b/.test(lower);
}

function dashboardPlanningAnswer(dashboard = {}) {
  const checks = Array.isArray(dashboard.agentChecks) ? dashboard.agentChecks : [];
  const scenarios = Array.isArray(dashboard.contributionScenarios) ? dashboard.contributionScenarios : [];
  const firstCheck = checks[0];
  const oneLife = (dashboard.pensionAccounts || []).find((account) => /onelife/i.test(`${account.provider || ""} ${account.name || ""}`));
  const scenario50 = scenarios.find((scenario) => /50/.test(String(scenario.extraMonthlyContribution || "")));
  const checkLines = checks.length
    ? checks.slice(0, 4).map((item) => `- ${item.title}: ${item.detail}`).join("\n")
    : "- No open agent checks were returned.";
  const scenarioLine = scenario50
    ? `Adding ${scenario50.extraMonthlyContribution} per month is modelled as final pot ${scenario50.projectedFinalPot}, projected monthly income ${scenario50.projectedMonthlyIncome}, and monthly gap ${scenario50.monthlyGap}.`
    : "No contribution scenario is available for £50 per month yet; use the projection tool to model it first.";
  const oneLifeLine = oneLife
    ? `OneLife is flagged because it is ${oneLife.source || "not fully provider-linked"} and has an annual charge of ${oneLife.charges || "not available"}. Check the latest statement, charge, policy details and whether any guarantees or transfer restrictions exist.`
    : "OneLife is not currently present in the account list returned by the backend.";

  return `Answer
${firstCheck ? `The first thing to review is ${firstCheck.title.toLowerCase()}. ${firstCheck.detail}` : "There are no open agent actions right now."}

What needs attention
${checkLines}

OneLife
${oneLifeLine}

Contribution and projection
${scenarioLine}

What to do first
1. Confirm document facts and manually entered account data before relying on the projection.
2. Check OneLife charges and any guarantees or restrictions.
3. Use the contribution scenario first, because the dashboard can quantify it.
4. Review investment style after confirming risk tolerance, fund factsheets, charges and guarantees.`;
}

function localReadOnlyAssistant(question, dashboard, settings = {}) {
  const lower = String(question || "").toLowerCase();
  const style = settings.riskProfile || detectRiskStyle(question);
  const largest = dashboard.largestAccount;
  const reviewDocs = dashboard.dataQuality?.reviewDocs || 0;
  const gap = dashboard.monthlyGap || "not available";
  const investmentQuestion = /\b(invest\w*|inves?tment|invem\w*|financial|advi[cs]e|funds?|stocks?|shares?|equity|equities|allocation|aggressive|conservative|balanced|risk|portfolio)\b/.test(lower);
  const legalQuestion = /\b(employer|change my workplace|change my pension|scheme|legal|law|rights|trustee|tax|transfer|contract|complaint|ombudsman|divorce|inheritance|beneficiary)\b/.test(lower);
  const explicitlyGeneral = /\b(general only|generic only|not my portfolio|do not use my portfolio|without my portfolio)\b/.test(lower);

  if (isAmbiguousPensionChangeQuestion(question)) return pensionChangeGuideAnswer(dashboard);

  if (isDashboardOrContributionQuestion(question) && (!investmentQuestion || !wantsSpecificInvestmentAdvice(question) || /\b(contribution|projection|gap|attention|flagged|verify|first)\b/.test(lower))) {
    return dashboardPlanningAnswer(dashboard);
  }

  if (investmentQuestion && !legalQuestion) {
    if (explicitlyGeneral) return genericInvestmentSuggestion();
    if (wantsSpecificInvestmentAdvice(question) && !hasRiskProfileAnswers(question)) return investmentRiskQuestionnaire(dashboard);
    const chosenStyle = style || settings.investmentStyleDefault || "balanced";
    return portfolioInvestmentSuggestion({ style: chosenStyle, dashboard, question, settings });
  }

  if (legalQuestion) {
    const employerChange = /\b(employer|workplace|job)\b/.test(lower) && /\b(change|switch|move|replace|new provider|new scheme)\b/.test(lower);
    if (employerChange) {
      return `Answer\nYes, an employer can often change the workplace pension scheme or provider for future contributions, but that does not automatically mean existing pots, accrued rights, guarantees or transfer terms can be changed without checking the scheme documents and process.\n\nYour personalised suggestion\nTreat this as two separate questions: what happens to future contributions, and what happens to existing pension rights or pots. Your dashboard has ${dashboard.dataQuality?.connected || 0}/${dashboard.dataQuality?.totalAccounts || 0} provider-linked accounts, projected monthly income of ${dashboard.projectedMonthlyIncome}, and a target gap of ${gap}, so provider changes could affect charges, contribution records, investment defaults and projection assumptions.\n\nLegal route\nUse this order: scheme type, governing deed/rules or provider contract, dates and member status, employer or trustee power, consultation/notice process, statutory overlay, then remedies. Do not assume a transfer is safe until guarantees, exit charges, protected ages, defined-benefit rights and scheme-specific benefits have been checked.\n\nWhat must be checked\n- The employer notice and proposed change date.\n- Whether future contributions only are moving, or existing pots are also being transferred.\n- Scheme rules, provider contract, member booklet and any amendment or transfer power.\n- Consultation or consent requirements, especially if benefits or contractual terms change.\n- Charges, investment default, guarantees, protected pension age, exit penalties and complaint route.\n\nNext step\nAsk HR, payroll or the scheme administrator for the change notice, new provider details, current scheme rules or member booklet, and whether any existing pot will transfer automatically. Upload those documents before relying on any legal or transfer conclusion.`;
    }
    return `Answer\nI can give a legal-route view linked to your dashboard. The likely route is to identify the pension scheme type, the document that gives the decision-maker power, and whether the issue affects entitlement, contributions, charges, provider choice, transfer rights or member communications.\n\nWhat this means for your dashboard\nYour backend snapshot shows ${dashboard.dataQuality?.connected || 0}/${dashboard.dataQuality?.totalAccounts || 0} pension accounts provider-linked, projected monthly income of ${dashboard.projectedMonthlyIncome}, and a target gap of ${gap}. A legal or scheme change could affect provider records, contributions, charges, guarantees or future projection values.\n\nLegal route\nStart with scheme type, governing deed/rules or provider contract, statutory overlay and decision-maker. Separate entitlement, amendment power, employer/trustee/provider duties, member communications and remedies.\n\nWhat must be checked\nScheme wording, employer notice, provider contract, trustee/provider decision-maker, dates, consultation, consent, automatic enrolment duties, tax position, guarantees and any transfer restrictions. Current law, tax and provider rules must be checked from current sources before acting.\n\nNext step\nAsk the employer, provider or scheme administrator for the latest scheme rules, amendment power, member notice and any consultation documents. Upload them to Documents, then ask me to review the legal route against the extracted facts.`;
  }

  if (/\b(document|upload|statement|extract|scan)\b/.test(lower)) {
    return `Answer\nYour dashboard has ${dashboard.documents?.length || 0} document records, with ${reviewDocs} needing review.\n\nWhat this means for your dashboard\nDocument facts can affect pot values, contributions, policy numbers and assumptions. A document marked for review should be checked before the figures are used for an investment or legal decision.\n\nNext step\nOpen Documents, check the extracted fields, then confirm any corrected values before relying on the dashboard.`;
  }

  if (/\b(saving|emergency|buffer)\b/.test(lower)) {
    return `Answer\nYour emergency savings are ${dashboard.savings?.currentSavings}, covering about ${dashboard.savings?.monthsCovered} months of expenses.\n\nWhat this means for your dashboard\nThe savings buffer is separate from long-term pension investments. A stronger buffer can reduce the chance of needing to disturb pension planning during a short-term shock.\n\nNext step\nReview whether the buffer should be rebuilt before taking extra investment risk or increasing pension contributions.`;
  }

  return `Answer\nYour backend portfolio snapshot shows projected monthly income of ${dashboard.projectedMonthlyIncome} against a target of ${dashboard.monthlyTarget}, leaving ${gap} per month. Pension pots total ${dashboard.pensionPotValue}; the largest pot is ${largest ? `${largest.provider} at ${largest.pot}` : "not available"}.\n\nWhat this means for your dashboard\nThe main review signals are target gap, document facts needing review, high-charge pots and whether manually entered records have been checked against recent provider statements.\n\nSuggested next step\nReview the target gap, confirm document facts and check any charge or guarantee details with the provider before making changes.`;
}


function localInvestmentStyleReview(dashboard) {
  const profile = dashboard.investmentProfile || {};
  const equity = plainValue(profile.equityExposure) || "62%";
  const bonds = plainValue(profile.bondExposure) || "28%";
  const cash = plainValue(profile.cashOther) || "10%";
  const style = plainValue(profile.currentStyle) || "Balanced";
  return {
    style,
    summary: `Your current dashboard style looks ${style.toLowerCase()}: ${equity} equity, ${bonds} bonds and ${cash} cash/other. Because the dashboard still shows a ${dashboard.monthlyGap} monthly gap, the first review route is to check whether this balanced mix still fits your time horizon, loss tolerance, charges and any guarantees before changing funds.`,
    checks: ["Risk tolerance", "Years to retirement", "Charges", "Guarantees", "Current fund factsheets"],
    source: "backend portfolio review"
  };
}

async function handleInvestmentReview(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const body = JSON.parse(await readBody(req) || "{}");
  const provider = body.provider || body.apiKey || body.model || body.endpoint ? resolveProvider(body) : configuredAssistantProvider();
  const settings = sanitizeAssistantSettings(body.settings || {});
  const model = safeModelName(provider, body.model || body.settings?.model || process.env[PROVIDERS[provider]?.envModel] || "");
  const apiKey = resolveApiKey(provider, body);
  const endpoint = String(body.endpoint || body.settings?.endpoint || "").trim();
  const dashboard = getVerifiedDashboardContext({ userId: authenticatedUserId(req) });
  const fallback = localInvestmentStyleReview(dashboard);

  if (provider !== "ollama" && !apiKey) return json(res, 200, { ok: true, provider: "local", model: "portfolio-style-review", review: fallback, generatedAt: new Date().toISOString() });

  const prompt = `Analyse the user's current pension investment style using only the backend dashboard context. Return compact JSON only with keys: style, summary, checks. Style must be Conservative, Balanced or Growth. Do not invent funds, provider terms or legal/tax facts. Dashboard context: ${JSON.stringify({ investmentProfile: dashboard.investmentProfile, targetGap: dashboard.monthlyGap, monthlyTarget: dashboard.monthlyTarget, projectedMonthlyIncome: dashboard.projectedMonthlyIncome, pensionPotValue: dashboard.pensionPotValue, dataQuality: dashboard.dataQuality, accounts: dashboard.pensionAccounts }, null, 2)}`;
  try {
    let result;
    const reviewSettings = { ...settings, riskProfile: "", answerMode: "investment_style_json" };
    if (provider === "openai") result = await callOpenAI({ apiKey, model, question: prompt, dashboard, settings: reviewSettings, useSearch: false });
    else if (provider === "gemini") result = await callGemini({ apiKey, model, question: prompt, dashboard, settings: reviewSettings, useSearch: false });
    else if (provider === "groq" || provider === "openrouter" || provider === "custom") result = await callOpenAICompatible({ provider, apiKey, model, question: prompt, dashboard, settings: reviewSettings, useSearch: false, endpoint });
    else if (provider === "ollama") result = await callOllama({ model, question: prompt, dashboard, settings: reviewSettings, useSearch: false });
    else throw new Error("Unsupported provider");
    const parsed = jsonObjectFromText(result.answer) || {};
    const review = {
      ...fallback,
      ...parsed,
      style: parsed.style || fallback.style,
      summary: parsed.summary || String(result.answer || fallback.summary).replace(/\s+/g, " ").slice(0, 500),
      checks: Array.isArray(parsed.checks) ? parsed.checks.slice(0, 6) : fallback.checks,
      source: `${PROVIDERS[provider]?.label || provider} analysis`
    };
    return json(res, 200, { ok: true, provider, model: result.model || model, review, generatedAt: new Date().toISOString() });
  } catch (error) {
    return json(res, 200, { ok: true, provider: "local", model: "portfolio-style-review", review: { ...fallback, summary: `${fallback.summary} Provider analysis was not available: ${error.message}` }, generatedAt: new Date().toISOString() });
  }
}

async function handleAssistant(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const body = JSON.parse(await readBody(req) || "{}");
  const question = String(body.question || "").trim();
  if (!question) return json(res, 400, { error: "Question is required" });

  const userId = authenticatedUserId(req);
  const provider = body.provider || body.apiKey || body.model || body.endpoint ? resolveProvider(body) : configuredAssistantProvider();
  const settings = sanitizeAssistantSettings(body.settings || {});
  const model = safeModelName(provider, body.model || body.settings?.model || process.env[PROVIDERS[provider]?.envModel] || "");
  const agentSummary = runAgentForUser({ userId, persist: true, reason: "assistant_context" });
  const escalatedActions = escalateActionsForAssistantQuestion(userId, question);
  const dependencyWarning = questionDependencyWarning(userId, question);
  if (escalatedActions.length) {
    appendAuditEvent(userId, {
      type: "action_priority_escalated",
      reason: "assistant_question_depends_on_open_item",
      actionIds: escalatedActions.map((action) => action.id),
      questionPreview: question.slice(0, 160)
    });
  }
  const storedRiskProfile = readRiskProfile(userId);
  settings.riskProfile = settings.riskProfile || detectRiskStyle(question) || storedRiskProfile.preferredStyle || "";
  settings.riskProfileDetails = storedRiskProfile;
  settings.agentContext = agentSummary.assistantContext;
  const dashboard = {
    ...agentSummary.dashboard,
    agentContext: agentSummary.assistantContext,
    nextBestAction: agentSummary.nextBestAction,
    agentChecks: agentSummary.dashboardChecks
  };
  const useSearch = shouldUseCurrentSearch(question, { ...settings, useSearch: undefined }, provider, model);
  const apiKey = resolveApiKey(provider, body);
  const endpoint = String(body.endpoint || body.settings?.endpoint || "").trim();
  const currentSourceNote = providerSearchNote(provider, model, useSearch);

  if (provider !== "ollama" && !apiKey) {
    const fallback = localReadOnlyAssistant(question, dashboard, settings);
    const fallbackSourceNote = `No external/current-source check was used because no API key was available for ${PROVIDERS[provider]?.label || provider}. If current law, tax or provider rules matter, the answer must say what needs verification.`;
    const compliance = complianceMetadata({ provider: "local", model: "server-portfolio-linked", usedSearch: false, currentSourceNote: fallbackSourceNote, agentSummary, riskProfile: storedRiskProfile });
    appendAuditEvent(userId, {
      type: "assistant_answer",
      provider: "local",
      model: "server-portfolio-linked",
      usedSearch: false,
      adviceBoundary: compliance.adviceBoundary,
      questionPreview: question.slice(0, 160)
    });
    return json(res, 200, {
      answer: appendDataUsedSection(fallback, dashboard, { provider: "local", usedSearch: false, currentSourceNote: fallbackSourceNote, investmentReview: settings.investmentReview, question, dependencyWarning }),
      model: "server-portfolio-linked",
      provider: "local",
      usedSearch: false,
      providerLabel: "Portfolio assistant",
      dataSource: dashboard.dataSource,
      dataUsed: dataUsedLines(dashboard, { usedSearch: false, currentSourceNote: fallbackSourceNote, investmentReview: settings.investmentReview }),
      currentSourceNote: fallbackSourceNote,
      agentContext: agentSummary.assistantContext,
      compliance
    });
  }

  try {
    let result;
    if (provider === "openai") result = await callOpenAI({ apiKey, model, question, dashboard, settings, useSearch });
    else if (provider === "gemini") result = await callGemini({ apiKey, model, question, dashboard, settings, useSearch });
    else if (provider === "groq" || provider === "openrouter" || provider === "custom") result = await callOpenAICompatible({ provider, apiKey, model, question, dashboard, settings, useSearch, endpoint });
    else if (provider === "ollama") result = await callOllama({ model, question, dashboard, settings, useSearch });
    else throw new Error("Unsupported provider");

    const compliance = complianceMetadata({ provider: result.provider, model: result.model, usedSearch: result.usedSearch, currentSourceNote, agentSummary, riskProfile: storedRiskProfile });
    appendAuditEvent(userId, {
      type: "assistant_answer",
      provider: result.provider,
      model: result.model,
      usedSearch: result.usedSearch,
      adviceBoundary: compliance.adviceBoundary,
      questionPreview: question.slice(0, 160)
    });
    return json(res, 200, {
      answer: appendDataUsedSection(result.answer, dashboard, { provider: result.provider, usedSearch: result.usedSearch, currentSourceNote, investmentReview: settings.investmentReview, question, dependencyWarning }),
      model: result.model,
      provider: result.provider,
      usedSearch: result.usedSearch,
      providerLabel: "Assistant ready",
      dataSource: dashboard.dataSource,
      dataUsed: dataUsedLines(dashboard, { provider: result.provider, usedSearch: result.usedSearch, currentSourceNote, investmentReview: settings.investmentReview }),
      currentSourceNote,
      agentContext: agentSummary.assistantContext,
      compliance
    });
  } catch (error) {
    const fallback = localReadOnlyAssistant(question, dashboard, settings);
    const note = `${currentSourceNote} Provider connection was not available: ${error.message || "unknown error"}`;
    const compliance = complianceMetadata({ provider: "local", model: "server-portfolio-linked", usedSearch: false, currentSourceNote: note, agentSummary, riskProfile: storedRiskProfile });
    appendAuditEvent(userId, {
      type: "assistant_answer",
      provider: "local",
      model: "server-portfolio-linked",
      usedSearch: false,
      providerError: error.message || "Provider request failed",
      adviceBoundary: compliance.adviceBoundary,
      questionPreview: question.slice(0, 160)
    });
    return json(res, 200, {
      answer: appendDataUsedSection(fallback, dashboard, { provider: "local", usedSearch: false, currentSourceNote: note, investmentReview: settings.investmentReview, question, dependencyWarning }),
      model: "server-portfolio-linked",
      provider: "local",
      usedSearch: false,
      providerLabel: "Portfolio assistant fallback",
      providerError: error.message || "Provider request failed",
      dataSource: dashboard.dataSource,
      dataUsed: dataUsedLines(dashboard, { provider: "local", usedSearch: false, currentSourceNote: note, investmentReview: settings.investmentReview }),
      currentSourceNote: note,
      agentContext: agentSummary.assistantContext,
      compliance
    });
  }
}

async function handleTestConnection(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const body = JSON.parse(await readBody(req) || "{}");
  const provider = resolveProvider(body);
  const model = safeModelName(provider, body.model || body.settings?.model);
  const apiKey = resolveApiKey(provider, body);
  const endpoint = String(body.endpoint || body.settings?.endpoint || "").trim();
  if (provider !== "ollama" && !apiKey) return json(res, 400, { error: `Enter an API key for ${PROVIDERS[provider]?.label || provider} before testing.` });
  const dashboard = getVerifiedDashboardContext({ userId: authenticatedUserId(req) });
  try {
    let result;
    const question = "Connection test. Reply with: OK.";
    const settings = { riskProfile: "", answerMode: "connection_test", strictAccuracy: true, portfolioFirst: true, readOnly: true };
    if (provider === "openai") result = await callOpenAI({ apiKey, model, question, dashboard, settings, useSearch: false });
    else if (provider === "gemini") result = await callGemini({ apiKey, model, question, dashboard, settings, useSearch: false });
    else if (provider === "groq" || provider === "openrouter" || provider === "custom") result = await callOpenAICompatible({ provider, apiKey, model, question, dashboard, settings, useSearch: false, endpoint });
    else if (provider === "ollama") result = await callOllama({ model, question, dashboard, settings, useSearch: false });
    else throw new Error("Unsupported provider");
    return json(res, 200, { ok: true, provider, model: result?.model || model, message: `${PROVIDERS[provider]?.label || provider} connection works.` });
  } catch (error) {
    return json(res, error.status || 502, { error: error.message || "Connection test failed" });
  }
}

function statusForProvider(provider = configuredAssistantProvider()) {
  const configured = normalizeProvider(provider || configuredAssistantProvider());
  const config = PROVIDERS[configured] || PROVIDERS.openai;
  return {
    provider: configured,
    providerLabel: config.label,
    enabled: configured === "ollama" ? true : Boolean(envKey(configured)),
    mode: configured === "ollama" || envKey(configured) ? "model" : "portfolio-linked",
    acceptsTestKey: true,
    acceptsModelOverride: true,
    model: process.env[config.envModel] || config.defaultModel,
    dataSource: "Backend verified portfolio snapshot",
    readOnly: true,
    authRequired: productionAuthRequired(),
    twoFactorRequired: mfaRequired(),
    userControlsHidden: false,
    supportsCurrentSearch: configured === "openai" || configured === "groq",
    searchMode: config.searchMode
  };
}

const PUBLIC_FILES = new Set(["/index.html", "/app.js", "/styles.css"]);

async function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (pathname === "/") pathname = "/index.html";
  const cleanPath = normalize(pathname).replace(/^\.\.(\/|\\|$)/, "");
  const extension = extname(cleanPath).toLowerCase();

  if (
    cleanPath.includes("..") ||
    cleanPath.startsWith("/server") ||
    cleanPath.startsWith("/." ) ||
    extension === ".md" ||
    extension === ".env" ||
    !PUBLIC_FILES.has(cleanPath)
  ) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const filePath = join(ROOT, cleanPath);
  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[extension] || "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    requireSessionForApi(req, url.pathname);
    const userId = authenticatedUserId(req);
    if (url.pathname === "/api/status") {
      const provider = normalizeProvider(url.searchParams.get("provider") || "openai");
      return json(res, 200, statusForProvider(provider));
    }
    if (url.pathname === "/api/portfolio") {
      const agent = runAgentForUser({ userId, persist: true, reason: "portfolio_load" });
      return json(res, 200, {
        ...agent.dashboard,
        agent: {
          status: agent.status,
          nextBestAction: agent.nextBestAction,
          assistantContext: agent.assistantContext,
          checks: agent.dashboardChecks
        },
        actions: agent.actions.slice(0, 6),
        notifications: agent.notifications.slice(0, 6)
      });
    }
    if (url.pathname === "/api/assistant") return handleAssistant(req, res);
    if (url.pathname === "/api/test-connection") return handleTestConnection(req, res);
    if (url.pathname === "/api/extract-document") return handleExtractDocument(req, res);
    if (url.pathname === "/api/investment-review") return handleInvestmentReview(req, res);
    const productRouteResult = await handleProductApiRoute({ req, res, url, json, readBody, userId, seedPortfolio: getPortfolioSeedForUser(userId) });
    if (productRouteResult !== false) return productRouteResult;
    return serveStatic(req, res);
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || "Server error" });
  }
}).listen(PORT, () => {
  startAgentScheduler();
  console.log(`Pensions dashboard running on http://localhost:${PORT}`);
});
