const STORAGE_KEY = "pension-plan-refined-ui-v1";
const ACTIVE_USER_STORAGE_KEY = "pension-plan-active-user-v1";
const API_STORAGE_KEY = "pension-plan-api-settings-v1";
const SETTINGS_STORAGE_KEY = "pension-plan-user-settings-v2";
const INVESTMENT_REVIEW_STORAGE_KEY = "pension-plan-investment-review-v1";
const DEMO_ACCOUNTS = {
  "alex-morgan": {
    name: "Alex Morgan",
    email: "alex.morgan@example.com",
    description: "Demo profile with sample pension data"
  },
  "empty-demo": {
    name: "New user",
    email: "empty.profile@example.com",
    description: "Empty profile for entering your own data"
  }
};
const DEFAULT_PORTFOLIO = {
  profile: { name: "Alex Morgan", source: "Authenticated backend profile" },
  dataSource: "Backend verified portfolio snapshot",
  monthlyTarget: "£2,500",
  projectedMonthlyIncome: "£1,696",
  monthlyGap: "£804",
  annualGap: "£9,643",
  coverage: "68%",
  assumptions: {
    currentAge: 45,
    retirementAge: 67,
    salary: "£45,000",
    monthlyContribution: "£300",
    totalContributionPct: "8%",
    growthPct: "4.5%",
    inflationPct: "2.5%",
    chargePct: "0.65%",
    drawdownPct: "5.1%"
  },
  pensionPotValue: "£123,450",
  potBreakdown: { workplacePensions: "£115,800", personalPensions: "£7,650" },
  largestAccount: { name: "Aviva Workplace Pension", provider: "Aviva", pot: "£68,450", charges: "0.45%", source: "Provider-linked", lastUpdated: "12 May 2026" },
  pensionAccounts: [
    { name: "Aviva Workplace Pension", provider: "Aviva", type: "Workplace pension", policy: "AW12345678", pot: "£68,450", source: "Provider-linked", charges: "0.45%", lastUpdated: "12 May 2026", employee: "5%", employer: "7%", employeeYearly: "£3,245 /yr", employerYearly: "£4,531 /yr" },
    { name: "Standard Life Pension", provider: "Standard Life", type: "Workplace pension", policy: "SL87654321", pot: "£32,150", source: "Provider-linked", charges: "0.55%", lastUpdated: "12 May 2026", employee: "4%", employer: "6%", employeeYearly: "£1,852 /yr", employerYearly: "£2,778 /yr" },
    { name: "Nest Workplace Pension", provider: "Nest", type: "Workplace pension", policy: "NE11223344", pot: "£15,200", source: "Provider-linked", charges: "0.30%", lastUpdated: "08 May 2026", employee: "4%", employer: "5%", employeeYearly: "£1,440 /yr", employerYearly: "£1,800 /yr" },
    { name: "OneLife Personal Plan", provider: "OneLife", type: "Personal pension", policy: "OL99887766", pot: "£7,650", source: "Manual review", charges: "0.80%", lastUpdated: "18 Apr 2026", employee: "—", employer: "—", employeeYearly: "N/A", employerYearly: "N/A" }
  ],
  statePension: { monthlyIncome: "£550", source: "Official forecast", lastUpdated: "12 May 2026" },
  savings: { currentSavings: "£8,750", monthlyExpenses: "£1,700", target: "£5,100", monthsCovered: "5.1", status: "On track", lastUpdated: "12 May 2026" },
  documents: [
    { name: "Aviva annual statement.pdf", provider: "Aviva", type: "Pension statement", status: "Needs review", date: "12 Apr 2026", source: "Email", confidence: "Medium", extracted: { provider: "Aviva", policy: "AV-48291", potValue: 48230, employerContribution: "5%", employeeContribution: "4%", chargePct: 0.45, statementDate: "12 Apr 2026" } },
    { name: "Workplace pension update.pdf", provider: "Standard Life", type: "Pension statement", status: "Reviewed", date: "05 Mar 2026", source: "Email", confidence: "High", extracted: { provider: "Standard Life", policy: "SL87654321", potValue: 32150, chargePct: 0.55, statementDate: "05 Mar 2026" } },
    { name: "State Pension forecast.pdf", provider: "UK Government", type: "State Pension forecast", status: "Reviewed", date: "21 Jan 2026", source: "Portal", confidence: "High", extracted: { provider: "UK Government", statePensionMonthly: 550, statementDate: "21 Jan 2026" } }
  ],
  dataQuality: { connected: 3, totalAccounts: 4, reviewDocs: 1, highCharge: 1, status: "Needs review" },
  investmentProfile: {
    currentStyle: "Balanced",
    equityExposure: "62%",
    bondExposure: "28%",
    cashOther: "10%",
    allocation: [
      { label: "UK equity", value: "28%", color: "#0b63f6" },
      { label: "Global equity", value: "34%", color: "#4f8ff7" },
      { label: "Bonds", value: "28%", color: "#7c3aed" },
      { label: "Cash", value: "8%", color: "#16a765" },
      { label: "Alternatives", value: "2%", color: "#f59e0b" }
    ],
    accountsByStrategy: [
      ["Workplace Pension", "Balanced"],
      ["Personal Pension", "Balanced"],
      ["SIPP", "Balanced"],
      ["Junior SIPP", "Growth"],
      ["Stakeholder Pension", "Cautious"]
    ]
  },
  systemUpdate: { date: "12 May 2026", label: "Latest provider update", note: "Provider values received and projection recalculated." },
  dataUsedSummary: { source: "Backend read-only portfolio snapshot" }
};

const PROVIDER_DEFAULT_MODELS = {
  openai: "gpt-4.1-mini",
  gemini: "gemini-2.5-flash",
  groq: "groq/compound-mini",
  openrouter: "openai/gpt-4o-mini",
  ollama: "llama3.1",
  custom: "gpt-4o-mini"
};

const PROVIDER_LABELS = {
  openai: "OpenAI",
  gemini: "Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
  ollama: "Ollama / local",
  custom: "Custom OpenAI-compatible"
};

const PROVIDER_ENDPOINT_PLACEHOLDERS = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434",
  custom: "https://your-provider.example/v1"
};

const PROVIDER_HINTS = {
  openai: "Paste an OpenAI API key for testing.",
  gemini: "Paste a Gemini API key for testing.",
  groq: "Paste a Groq gsk_ key for testing.",
  openrouter: "Paste an OpenRouter key for testing.",
  ollama: "Use this when a local Ollama server is running.",
  custom: "Use any OpenAI-compatible provider by entering its /v1 endpoint."
};

const initialUserSettings = loadUserSettings();

const app = {
  view: localStorage.getItem(STORAGE_KEY) || "overview",
  currentUser: loadActiveUser(),
  portfolio: structuredClone(DEFAULT_PORTFOLIO),
  chartTab: "pot",
  chartSelections: {},
  selectedGapSegment: "complete",
  selectedAllocationIndex: 0,
  messages: [],
  api: loadApiSettings(),
  userSettings: initialUserSettings,
  investmentReview: loadInvestmentReview(loadActiveUser()),
  agent: null,
  actions: [],
  notifications: [],
  timeline: [],
  riskProfile: null,
  pendingInvestmentAdvice: null
};

function loadActiveUser() {
  const stored = localStorage.getItem(ACTIVE_USER_STORAGE_KEY) || "alex-morgan";
  return DEMO_ACCOUNTS[stored] ? stored : "alex-morgan";
}

function loadApiSettings() {
  const fallback = { provider: "openai", apiKey: "", model: PROVIDER_DEFAULT_MODELS.openai, endpoint: "" };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(API_STORAGE_KEY) || "{}") };
  } catch {
    return fallback;
  }
}

function loadUserSettings() {
  const fallback = {
    actionAlerts: true,
    documentAlerts: true,
    projectionUpdates: true,
    portfolioLinkedDefault: true,
    showDataUsedSummary: false
  };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}") };
  } catch {
    return fallback;
  }
}

function saveUserSettings() {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(app.userSettings));
}

function applyUserDisplaySettings() {
  document.documentElement.classList.remove("compact-mode");
  document.documentElement.classList.add("reduced-numbers");
}

function investmentReviewStorageKey(userId = loadActiveUser()) {
  return `${INVESTMENT_REVIEW_STORAGE_KEY}:${userId}`;
}

function loadInvestmentReview(userId = loadActiveUser()) {
  try {
    return JSON.parse(localStorage.getItem(investmentReviewStorageKey(userId)) || "null");
  } catch {
    return null;
  }
}

function saveInvestmentReview() {
  if (app.investmentReview) localStorage.setItem(investmentReviewStorageKey(app.currentUser), JSON.stringify(app.investmentReview));
}


function detectProviderFromApiKey(value = "") {
  const key = String(value || "").trim().toLowerCase();
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("sk-or-") || key.startsWith("sk-router-")) return "openrouter";
  if (key.startsWith("AIza".toLowerCase())) return "gemini";
  if (key.startsWith("sk-proj-") || key.startsWith("sk-")) return "openai";
  return "";
}

function saveApiSettings() {
  localStorage.setItem(API_STORAGE_KEY, JSON.stringify(app.api));
}


async function fetchJson(url, options = {}) {
  if (location.protocol === "file:") {
    throw new Error("This page is open as a local file. Open http://localhost:3000 instead so the backend API, agent, assistant and saved settings can work.");
  }
  const headers = {
    "X-Demo-User-Id": app.currentUser || "alex-morgan",
    ...(options.headers || {})
  };
  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let data = {};
  if (text && contentType.includes("application/json")) {
    try { data = JSON.parse(text); } catch { data = {}; }
  } else if (text) {
    const plain = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    data = { error: plain ? `Backend returned non-JSON content: ${plain.slice(0, 160)}` : "Backend did not return JSON. Start the app with npm start and use the Node server URL." };
  }
  if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
  return data;
}

function $(selector, root = document) { return root.querySelector(selector); }
function $all(selector, root = document) { return [...root.querySelectorAll(selector)]; }
function parseMoney(value) { return Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0; }
function money(value) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0)); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }
function percentNumber(value) { return Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0; }
function inputNumber(value) { return Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || ""; }
function providerClass(provider = "") { return provider.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "provider"; }

function projectionModel() {
  const p = app.portfolio;
  const currentAge = Number(p.assumptions?.currentAge || 45);
  const retirementAge = Number(p.assumptions?.retirementAge || 67);
  const currentPot = parseMoney(p.pensionPotValue);
  const monthlyContribution = parseMoney(p.assumptions?.monthlyContribution || 300);
  const growthPct = percentNumber(p.assumptions?.growthPct || 4.5);
  const inflationPct = percentNumber(p.assumptions?.inflationPct || 2.5);
  const chargePct = percentNumber(p.assumptions?.chargePct || 0.65);
  const realAnnualGrowth = Math.max(-0.95, (growthPct - inflationPct - chargePct) / 100);
  const monthlyGrowth = Math.pow(1 + realAnnualGrowth, 1 / 12) - 1;
  const points = [];
  let pot = currentPot;
  points.push({ age: currentAge, pot });
  for (let age = currentAge + 1; age <= retirementAge; age += 1) {
    for (let m = 0; m < 12; m += 1) pot = (pot + monthlyContribution) * (1 + monthlyGrowth);
    points.push({ age, pot });
  }
  const finalPot = points.at(-1)?.pot || currentPot;
  return { currentAge, retirementAge, currentPot, monthlyContribution, points, finalPot };
}

function applyBindings() {
  const projection = projectionModel();
  const bindings = {
    monthlyGap: app.portfolio.monthlyGap,
    monthlyIncome: app.portfolio.projectedMonthlyIncome,
    monthlyTarget: app.portfolio.monthlyTarget,
    annualGap: app.portfolio.annualGap,
    coverage: app.portfolio.coverage,
    pensionPotValue: app.portfolio.pensionPotValue,
    monthlyContribution: money(projection.monthlyContribution),
    finalPot: money(projection.finalPot)
  };
  $all("[data-bind]").forEach((node) => {
    const key = node.getAttribute("data-bind");
    if (bindings[key]) node.textContent = bindings[key];
  });
}

function metricCard({ icon, iconClass = "", label, value, sub, warning = false }) {
  return `<article class="card metric-card ${warning ? "warning" : ""}">
    <div class="metric-top"><span class="metric-label">${escapeHtml(label)}</span><span class="metric-icon ${iconClass}" aria-hidden="true">${icon}</span></div>
    <div><strong>${escapeHtml(value)}</strong><small>${escapeHtml(sub)}</small></div>
  </article>`;
}

function actionVisibleToUser(action = {}) {
  const text = `${action.sourceKey || ""} ${action.category || ""} ${action.title || ""} ${action.detail || ""}`.toLowerCase();
  return !/risk_profile_missing|risk profile/.test(text);
}

function userVisibleActions() {
  return Array.isArray(app.actions) ? app.actions.filter(actionVisibleToUser) : [];
}

function hasUrgentUserAction() {
  return userVisibleActions().some((action) => action.priority === "high");
}

function renderUrgentActionPills() {
  const show = hasUrgentUserAction();
  $all("[data-urgent-action-pill]").forEach((pill) => {
    pill.classList.toggle("hidden", !show);
  });
}

function renderOverview() {
  const p = app.portfolio;
  $("#overview-metrics").innerHTML = [
    { icon: "▣", label: "Projected monthly income", value: p.projectedMonthlyIncome, sub: "from all sources" },
    { icon: "◎", iconClass: "green", label: "Target monthly income", value: p.monthlyTarget, sub: "your target" },
    { icon: "↗", iconClass: "amber", label: "Monthly gap", value: p.monthlyGap, sub: "left each month" }
  ].map(metricCard).join("");

  renderOverviewTargetGap();

  $("#income-source-list").innerHTML = splitRows(incomeSourceRows());

  $("#data-check-list").innerHTML = groupedActionsHtml(userVisibleActions());
}

function incomeSourceRows() {
  const p = app.portfolio;
  const accounts = Array.isArray(p.pensionAccounts) ? p.pensionAccounts : [];
  const projectedIncome = parseMoney(p.projectedMonthlyIncome);
  const state = parseMoney(p.statePension?.monthlyIncome);
  const privateIncome = Math.max(0, projectedIncome - state);
  const workplacePot = accounts.filter((account) => /workplace/i.test(account.type || "")).reduce((sum, account) => sum + parseMoney(account.pot), 0);
  const personalPot = accounts.filter((account) => !/workplace/i.test(account.type || "")).reduce((sum, account) => sum + parseMoney(account.pot), 0);
  const totalPot = Math.max(1, workplacePot + personalPot);
  const workplaceIncome = privateIncome * (workplacePot / totalPot);
  const personalIncome = privateIncome * (personalPot / totalPot);
  const rows = [];
  if (workplacePot > 0) rows.push(["▣", "Workplace pensions", money(workplaceIncome), "blue", "Projected private pension income"]);
  if (personalPot > 0) rows.push(["♙", "Personal pensions", money(personalIncome), "purple", "Projected private pension income"]);
  rows.push(["✓", "State Pension", money(state), "green", p.statePension?.source || "Forecast"]);
  rows.push(["=", "Total projected income", money(projectedIncome), "blue", "All shown income sources"]);
  return rows;
}

function renderOverviewTargetGap() {
  const donut = $("#overview-donut");
  if (!donut) return;
  const coverage = Math.max(0, Math.min(100, percentNumber(app.portfolio.coverage || 0)));
  const gap = app.portfolio.monthlyGap || "£0";
  const projectedIncome = app.portfolio.projectedMonthlyIncome || "£0";
  const remaining = Math.max(0, 100 - coverage);
  const selected = app.selectedGapSegment === "left"
    ? { label: "left", value: gap, caption: `${remaining.toFixed(0)}% gap` }
    : { label: "complete", value: projectedIncome, caption: `${coverage.toFixed(0)}% complete` };
  const drawCoverage = Math.min(99.99, Math.max(0.01, coverage));
  const completeEnd = (drawCoverage / 100) * 360;
  donut.innerHTML = `<svg class="target-gap-svg" viewBox="0 0 240 240" role="img" aria-label="Target gap, ${coverage.toFixed(0)} percent complete and ${escapeHtml(gap)} left each month">
    <path class="target-gap-segment complete ${app.selectedGapSegment === "complete" ? "selected" : ""}" d="${donutSegmentPath(0, completeEnd)}" data-gap-segment="complete" tabindex="0" role="button" aria-label="${escapeHtml(projectedIncome)}, ${coverage.toFixed(0)} percent complete"></path>
    <path class="target-gap-segment remaining ${app.selectedGapSegment === "left" ? "selected" : ""}" d="${donutSegmentPath(completeEnd, 360)}" data-gap-segment="left" tabindex="0" role="button" aria-label="${escapeHtml(gap)}, ${remaining.toFixed(0)} percent gap"></path>
    <circle cx="120" cy="120" r="62" fill="#fff" stroke="#e6edf8" stroke-width="2"></circle>
    <text class="target-gap-center-value" x="120" y="115" text-anchor="middle">${escapeHtml(selected.value)}</text>
    <text class="target-gap-center-label" x="120" y="143" text-anchor="middle">${escapeHtml(selected.caption)}</text>
  </svg>
  <button class="target-gap-click-zone complete-zone" type="button" data-gap-segment="complete" aria-label="${escapeHtml(projectedIncome)}, ${coverage.toFixed(0)} percent complete"></button>
  <button class="target-gap-click-zone remaining-zone" type="button" data-gap-segment="left" aria-label="${escapeHtml(gap)}, ${remaining.toFixed(0)} percent gap"></button>`;
}

function actionRow([icon, color, title, sub, view]) {
  return `<button class="action-row" type="button" data-view="${view}"><span class="status-icon ${color}" aria-hidden="true">${icon}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(sub)}</small></span><span class="chev" aria-hidden="true">›</span></button>`;
}

function statusRow(icon, color, title, sub, view = "") {
  const viewAttr = view ? ` data-view="${view}"` : "";
  return `<button class="status-row" type="button"${viewAttr}><span class="status-icon ${color}" aria-hidden="true">${icon}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(sub)}</small></span><span aria-hidden="true">›</span></button>`;
}

function itemIcon(category = "") {
  if (/document/i.test(category)) return "▤";
  if (/investment|risk/i.test(category)) return "↗";
  if (/charge/i.test(category)) return "!";
  if (/projection|target/i.test(category)) return "◎";
  if (/data|provider/i.test(category)) return "◷";
  return "i";
}

function priorityColor(priority = "") {
  if (priority === "high") return "red";
  if (priority === "low") return "blue";
  return "blue";
}

function actionToRow(action) {
  return [
    action.priority === "high" ? "!" : itemIcon(action.category),
    priorityColor(action.priority),
    action.title,
    action.detail || "",
    action.linkedView || "overview"
  ];
}

function actionToStatusRow(action) {
  const [icon, color, title, sub, view] = actionToRow(action);
  return statusRow(icon, color, title, sub, view);
}

function confidenceClass(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.includes("high")) return "green";
  if (text.includes("medium")) return "blue";
  return "amber";
}

function confidenceLabel(value = "") {
  const text = String(value || "").replace(/_/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "Needs review";
}

function initialsForName(name = "") {
  const words = String(name || "User").trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "U").toUpperCase();
}

function activeAccountMeta(userId = app.currentUser) {
  const fallback = DEMO_ACCOUNTS[userId] || DEMO_ACCOUNTS["alex-morgan"];
  const profileName = app.portfolio?.profile?.name;
  const profileEmail = app.portfolio?.profile?.email;
  return { ...fallback, name: profileName || fallback.name, email: profileEmail || fallback.email };
}

function renderAccountSwitcher() {
  const meta = activeAccountMeta();
  const initials = $("#profile-initials");
  const name = $("#profile-name");
  if (initials) initials.textContent = initialsForName(meta.name);
  if (name) name.textContent = meta.name;
  const list = $("#account-switch-list");
  if (!list) return;
  list.innerHTML = Object.entries(DEMO_ACCOUNTS).map(([userId, account]) => {
    const active = userId === app.currentUser;
    const displayAccount = active ? { ...account, name: meta.name } : account;
    return `<button class="account-switch-row ${active ? "active" : ""}" type="button" data-account-switch="${escapeHtml(userId)}" aria-current="${active ? "true" : "false"}">
      <span class="avatar">${escapeHtml(initialsForName(displayAccount.name))}</span>
      <span><strong>${escapeHtml(displayAccount.name)}</strong><small>${escapeHtml(account.description)}</small></span>
      ${active ? "<em>Active</em>" : "<span aria-hidden=\"true\">›</span>"}
    </button>`;
  }).join("");
}

async function switchDemoUser(userId) {
  if (!DEMO_ACCOUNTS[userId]) return;
  app.currentUser = userId;
  localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
  app.messages = [];
  app.pendingInvestmentAdvice = null;
  app.investmentReview = loadInvestmentReview(userId);
  $("#account-popover")?.classList.add("hidden");
  await loadPortfolio();
  renderAll();
  setView(app.view);
}

function checkToStatusRow(check) {
  return statusRow(
    itemIcon(check.category),
    check.severity === "high" ? "amber" : check.severity === "low" ? "green" : "blue",
    check.title,
    check.detail || "",
    check.linkedView || "overview"
  );
}

function splitRows(rows) {
  return rows.map(([icon, label, value, color = "blue", sub = ""]) => {
    const iconHtml = icon ? `<span class="status-icon ${color}" aria-hidden="true">${escapeHtml(icon)}</span>` : "";
    return `<div class="split-row ${icon ? "" : "no-icon"}"><span class="split-left">${iconHtml}<span><strong>${escapeHtml(label)}</strong>${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</span></span><span class="split-value">${escapeHtml(value)}</span></div>`;
  }).join("");
}

function accountNeedsReview(account = {}) {
  const text = `${account.provider || ""} ${account.name || ""} ${account.source || ""} ${account.connectionStatus || ""}`.toLowerCase();
  return /onelife|manual|review|stale/.test(text) || percentNumber(account.charges) >= 0.75;
}

function renderAccounts() {
  const accounts = app.portfolio.pensionAccounts || [];
  const total = accounts.reduce((sum, account) => sum + parseMoney(account.pot), 0);
  const avgCharge = accounts.length ? accounts.reduce((sum, account) => sum + percentNumber(account.charges), 0) / accounts.length : 0;
  $("#accounts-metrics").innerHTML = [
    { icon: "▣", label: "Total pension pot", value: money(total), sub: `Across ${accounts.length} accounts` },
    { icon: "▥", label: "Workplace pensions", value: String(accounts.filter((a) => /workplace/i.test(a.type)).length), sub: "With employer contributions" },
    { icon: "♙", label: "Personal pensions", value: String(accounts.filter((a) => /personal/i.test(a.type)).length), sub: "Self-invested" },
    { icon: "%", label: "Average annual charge", value: `${avgCharge.toFixed(2)}%`, sub: "Across all accounts" }
  ].map(metricCard).join("");

  const emptyRow = `<div class="account-empty-state">
    <strong>No pension accounts yet</strong>
    <span>Add a provider, pot value and charge below to start building this profile.</span>
  </div>`;
  $("#accounts-table").innerHTML = `<div class="account-header"><span>Account</span><span>Current pot value</span><span>Employee contribution</span><span>Employer contribution</span><span>Annual charge</span><span>Last updated</span><span>Status</span><span></span></div>` + (accounts.length ? accounts.map((account) => {
    const source = account.source || "Manual review";
    const statusClass = /provider/i.test(source) ? "green" : "amber";
    const manual = /manual/i.test(source);
    const employee = account.employee || (manual ? "Not added" : "4%");
    const employer = account.employer || (manual ? "Not added" : "5%");
    const employeeYearly = account.employeeYearly || "";
    const employerYearly = account.employerYearly || "";
    return `<div class="account-row">
      <div class="provider-cell"><span class="provider-logo ${providerClass(account.provider)}">${escapeHtml(account.provider?.slice(0, 2).toUpperCase() || "PP")}</span><span class="account-title"><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(account.policy || "Policy details stored")}</small><span class="account-pills"><span class="pill ${/personal/i.test(account.type) ? "purple" : ""}">${escapeHtml(account.type)}</span></span></span></div>
      <strong>${escapeHtml(account.pot)}</strong>
      <span class="contribution-cell"><strong>${escapeHtml(employee)}</strong><small>${escapeHtml(employeeYearly)}</small></span>
      <span class="contribution-cell"><strong>${escapeHtml(employer)}</strong><small>${escapeHtml(employerYearly)}</small></span>
      <strong>${escapeHtml(account.charges)}</strong>
      <span>${escapeHtml(account.lastUpdated)}</span>
      <span class="pill ${statusClass}">${escapeHtml(source)}</span>
      <span class="row-actions"><button class="secondary-action" type="button">View details</button><button class="secondary-action" type="button">Review charges</button></span>
    </div>`;
  }).join("") : emptyRow);
}

function renderContributions() {
  const projection = projectionModel();
  const accounts = app.portfolio.pensionAccounts || [];
  const workplace = accounts.find((account) => /workplace/i.test(account.type || "") && /provider/i.test(account.source || "")) || accounts.find((account) => /workplace/i.test(account.type || ""));
  const hasAccounts = accounts.length > 0;
  const employerPct = workplace?.employer || (hasAccounts ? "Needs review" : "Not added");
  const employeePct = workplace?.employee || (hasAccounts ? "Needs review" : "Not added");
  const annualTotal = money(projection.monthlyContribution * 12);
  $("#contribution-metrics").innerHTML = [
    { icon: "▣", label: "Monthly contribution", value: money(projection.monthlyContribution), sub: hasAccounts ? "Estimated total" : "Add salary or pot data" },
    { icon: "▥", iconClass: "green", label: "Employer contribution", value: employerPct, sub: hasAccounts ? "From workplace account" : "Not set" },
    { icon: "♙", label: "Employee contribution", value: employeePct, sub: hasAccounts ? "From workplace account" : "Not set" },
    { icon: "£", iconClass: "purple", label: "Estimated annual total", value: annualTotal, sub: "Including known inputs" }
  ].map(metricCard).join("");
  $("#contribution-breakdown").innerHTML = splitRows([
    ["", "Employer contribution", workplace?.employerYearly || (hasAccounts ? "Needs review" : "Not added"), "green", employerPct],
    ["", "Employee contribution", workplace?.employeeYearly || (hasAccounts ? "Needs review" : "Not added"), "blue", employeePct],
    ["", "Tax relief", hasAccounts ? "Check payslip or provider data" : "Not added", "purple", "Added by the government where eligible"]
  ]);
  const scenarios = Array.isArray(app.portfolio.contributionScenarios) ? app.portfolio.contributionScenarios : [];
  const scenarioFor = (amount) => scenarios.find((item) => Number(item.extraMonthlyContributionValue) === amount);
  $("#scenario-list").innerHTML = [
    scenario("▣", "Keep current plan", money(projection.finalPot), app.portfolio.monthlyGap, "", "", true),
    ...[50, 100].map((amount) => {
      const item = scenarioFor(amount);
      return scenario(
        "↗",
        `Increase by £${amount}/month`,
        item?.projectedFinalPot || "Calculate",
        item?.monthlyGap || "Review",
        item?.finalPotDelta || "",
        item?.monthlyGapReduction || "",
        false
      );
    })
  ].join("");
  const reminders = $("#contribution-reminders");
  if (reminders) reminders.innerHTML = "";
}

function scenario(icon, title, pot, gap, potDelta, gapDelta, selected = false) {
  return `<div class="scenario-card ${selected ? "selected" : ""}"><span class="status-icon blue" aria-hidden="true">${icon}</span><span><strong>${escapeHtml(title)}</strong></span><span class="scenario-metrics"><span>Projected pot (at 67)<strong>${pot}</strong>${potDelta ? `<span class="delta">↑ ${potDelta}</span>` : ""}</span><span>Monthly gap (at 67)<strong>${gap}</strong>${gapDelta ? `<span class="delta">↓ ${gapDelta}</span>` : ""}</span></span></div>`;
}

function reminder(icon, title, text) {
  return `<div class="reminder-item"><span class="status-icon blue" aria-hidden="true">${icon}</span><span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></span></div>`;
}

function allocationValueNumber(value) {
  return Math.max(0, Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0);
}

function donutPoint(cx, cy, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function donutSegmentPath(startAngle, endAngle, outerRadius = 104, innerRadius = 58) {
  const cx = 120;
  const cy = 120;
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const outerStart = donutPoint(cx, cy, outerRadius, startAngle);
  const outerEnd = donutPoint(cx, cy, outerRadius, endAngle);
  const innerStart = donutPoint(cx, cy, innerRadius, endAngle);
  const innerEnd = donutPoint(cx, cy, innerRadius, startAngle);
  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    "Z"
  ].join(" ");
}

function renderAllocationDonut(allocation) {
  const donut = $("#allocation-donut");
  if (!donut) return;
  const values = allocation.map((item) => allocationValueNumber(item.value));
  const total = values.reduce((sum, value) => sum + value, 0) || 100;
  let angle = 0;
  const segments = allocation.map((item, index) => {
    const value = values[index];
    const start = angle;
    const end = angle + (value / total) * 360;
    angle = end;
    return {
      ...item,
      index,
      value,
      start,
      end,
      path: donutSegmentPath(start, end)
    };
  });
  const selected = segments[app.selectedAllocationIndex] || segments[0] || { label: "Total", value: 100, color: "#0b63f6" };
  donut.innerHTML = `<svg class="allocation-svg" viewBox="0 0 240 240" role="img" aria-label="Portfolio allocation, selected ${escapeHtml(selected.label)} ${escapeHtml(selected.value)}%">
    ${segments.map((segment) => `<path class="allocation-segment ${segment.index === app.selectedAllocationIndex ? "selected" : ""}" data-allocation-index="${segment.index}" d="${segment.path}" fill="${escapeHtml(segment.color)}"><title>${escapeHtml(segment.label)}: ${escapeHtml(segment.value)}%</title></path>`).join("")}
    <circle cx="120" cy="120" r="54" fill="#fff" stroke="#edf2fb"></circle>
    <text class="allocation-center-value" x="120" y="111" text-anchor="middle" dominant-baseline="middle">${escapeHtml(`${selected.value}%`)}</text>
    <text class="allocation-center-label" x="120" y="141" text-anchor="middle" dominant-baseline="middle">${escapeHtml(selected.label)}</text>
  </svg>`;
}

function renderInvestments() {
  const profile = app.portfolio.investmentProfile || DEFAULT_PORTFOLIO.investmentProfile;
  $("#investment-metrics").innerHTML = [
    { icon: "◔", label: "Current style", value: profile.currentStyle || "Balanced", sub: "Current data" },
    { icon: "↗", label: "Equity exposure", value: profile.equityExposure || "62%", sub: "Across all pots" },
    { icon: "✓", iconClass: "purple", label: "Bond exposure", value: profile.bondExposure || "28%", sub: "Across all pots" },
    { icon: "£", iconClass: "green", label: "Cash / other", value: profile.cashOther || "10%", sub: "Across all pots" }
  ].map(metricCard).join("");
  const defaultAllocation = DEFAULT_PORTFOLIO.investmentProfile.allocation;
  const allocation = (profile.allocation || defaultAllocation).map((item, index) => ({ ...defaultAllocation[index % defaultAllocation.length], ...item }));
  if (app.selectedAllocationIndex >= allocation.length) app.selectedAllocationIndex = 0;
  renderAllocationDonut(allocation);
  $("#allocation-legend").innerHTML = allocation.map(({ label, value, color }, index) => `<button class="legend-row ${index === app.selectedAllocationIndex ? "active" : ""}" type="button" data-allocation-index="${index}"><span class="legend-label"><span class="legend-dot" style="background:${color}"></span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></button>`).join("");
  const strategies = profile.accountsByStrategy || DEFAULT_PORTFOLIO.investmentProfile.accountsByStrategy;
  $("#strategy-table").innerHTML = strategies.length ? strategies.map((item) => {
    const account = Array.isArray(item) ? item[0] : (item.account || item.name || item.provider || "Account");
    const style = Array.isArray(item) ? item[1] : (item.style || item.currentFundStyle || "Needs review");
    return `<div class="simple-table-row"><strong>${escapeHtml(account)}</strong><span>${escapeHtml(style)}</span></div>`;
  }).join("") : `<p class="subtle">No account strategy data yet.</p>`;
  const currentStyleSummary = $("#current-style-summary");
  if (currentStyleSummary) {
    currentStyleSummary.innerHTML = `<strong>${escapeHtml(profile.currentStyle || "Balanced")}</strong><p>${escapeHtml(profile.equityExposure || "62%")} equity, ${escapeHtml(profile.bondExposure || "28%")} bonds and ${escapeHtml(profile.cashOther || "10%")} cash / other.</p>`;
  }
  renderInvestmentAnalysisResult();
}

function renderInvestmentAnalysisResult() {
  const panel = $("#investment-analysis-result");
  if (!panel) return;
  const review = app.investmentReview;
  if (!review) {
    panel.innerHTML = "";
    return;
  }
  const style = review.style || review.currentStyle || "Balanced";
  const summary = review.summary || review.answer || "Current style reviewed against your dashboard.";
  const generated = review.generatedAt ? new Date(review.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "just now";
  const provider = review.providerLabel || PROVIDER_LABELS[review.provider] || review.provider || "selected provider";
  const model = review.model ? ` · ${review.model}` : "";
  panel.innerHTML = `<strong>AI style analysis: ${escapeHtml(style)}</strong><p>${escapeHtml(summary).slice(0, 220)}</p><small>Updated ${escapeHtml(generated)} · ${escapeHtml(provider)}${escapeHtml(model)}</small>`;
}

async function analyseInvestmentStyle() {
  const button = $("#analyse-investment-style");
  const panel = $("#investment-analysis-result");
  if (!button || !panel) return;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = "Analysing…";
  panel.innerHTML = `<strong>AI style analysis</strong><p>Reviewing your current allocation, target gap and time horizon…</p>`;
  try {
    const data = await fetchJson("/api/investment-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiPayload())
    });
    app.investmentReview = { ...(data.review || {}), provider: data.provider, providerLabel: PROVIDER_LABELS[data.provider] || data.provider, model: data.model, generatedAt: data.generatedAt || new Date().toISOString() };
    saveInvestmentReview();
    renderInvestmentAnalysisResult();
  } catch (error) {
    app.investmentReview = { style: "Balanced", summary: `Could not run the provider analysis: ${error.message}. The assistant will still use your current dashboard style and allocation.`, generatedAt: new Date().toISOString() };
    saveInvestmentReview();
    renderInvestmentAnalysisResult();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function renderTarget() {
  renderChart(app.chartTab);
  const p = app.portfolio;
  const projection = projectionModel();
  $("#plan-summary-list").innerHTML = splitRows([
    ["", "Monthly contribution", money(projection.monthlyContribution), "blue"],
    ["", "Retirement age", `${projection.retirementAge} years`, "blue"],
    ["", "State Pension", p.statePension?.monthlyIncome || "£550", "blue"],
    ["", "Target coverage", p.coverage || "68%", "blue"]
  ]);
  const timeline = $("#update-timeline");
  if (timeline) {
    const updates = targetTimelineItems(projection);
    timeline.innerHTML = `<div class="timeline-line"></div><div class="timeline-items">
      ${updates.map((item, index, arr) => timelineItem(item.label, item.date, item.value, index === arr.length - 1)).join("")}
    </div>`;
  }
  applyBindings();
}

function targetTimelineItems(projection) {
  if (Array.isArray(app.timeline) && app.timeline.length) {
    return app.timeline.slice(0, 3).reverse().map((item) => ({
      label: item.title || "Dashboard update",
      date: item.date || "",
      value: item.detail || item.type || "Updated"
    }));
  }
  return projectionTimeline(projection);
}

function projectionTimeline(projection) {
  const finalPot = projection.finalPot || parseMoney(app.portfolio.finalPot || app.portfolio.pensionPotValue);
  const now = new Date();
  return [2, 1, 0].map((monthsBack) => {
    const date = new Date(now.getFullYear(), now.getMonth() - monthsBack, Math.min(12, now.getDate()));
    const label = monthsBack === 0 ? "Current update" : `${date.toLocaleString("en-GB", { month: "long" })} update`;
    const value = money(finalPot * (1 - monthsBack * 0.018));
    return { label, date: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), value };
  });
}

function timelineItem(label, date, value, active = false) {
  return `<div class="timeline-item ${active ? "active" : ""}"><span class="timeline-dot"></span><strong>${escapeHtml(label)}</strong><span>${escapeHtml(date)}</span><b>${escapeHtml(value)}</b></div>`;
}

function renderChart(tab = "pot") {
  const chart = $("#projection-chart");
  const title = $("#projection-chart-title");
  if (!chart || !title) return;
  const projection = projectionModel();
  const p = app.portfolio;
  const points = projection.points.map((point) => {
    let value = point.pot;
    if (tab === "income") value = (point.pot * 0.051) / 12 + parseMoney(p.statePension?.monthlyIncome) + 50;
    if (tab === "gap") value = Math.max(0, parseMoney(p.monthlyTarget) - ((point.pot * 0.051) / 12 + parseMoney(p.statePension?.monthlyIncome) + 50));
    return { age: point.age, value };
  });
  title.textContent = tab === "income" ? "Estimated retirement income over time" : tab === "gap" ? "Monthly gap over time" : "Projected pension pot over time";
  const width = Math.max(1160, points.length * 64);
  const height = 282;
  const pad = { l: 62, r: 48, t: 34, b: 48 };
  const values = points.map((point) => point.value);
  const max = tab === "pot" ? Math.max(300000, ...values) : Math.max(tab === "gap" ? 1200 : 2600, ...values);
  const min = 0;
  const ageSpan = Math.max(1, projection.retirementAge - projection.currentAge);
  const x = (age) => pad.l + ((age - projection.currentAge) / ageSpan) * (width - pad.l - pad.r);
  const y = (value) => height - pad.b - ((value - min) / (max - min)) * (height - pad.t - pad.b);
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(point.age).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(projection.retirementAge)},${height - pad.b} L${x(projection.currentAge)},${height - pad.b} Z`;
  const final = points.at(-1);
  const selectedAge = app.chartSelections[tab] || final.age;
  const selected = points.find((point) => point.age === selectedAge) || final;
  const selectedLabel = tab === "pot" ? money(selected.value) : `${money(selected.value)}/mo`;
  const selectedCaption = tab === "income" ? "estimated monthly income" : tab === "gap" ? "estimated monthly gap" : "projected pot value";
  const yLabels = tab === "pot" ? [[300000, "£300k"], [200000, "£200k"], [100000, "£100k"], [0, "£0"]] : [[max, money(max)], [max / 2, money(max / 2)], [0, "£0"]];
  const ageLabels = points.filter((point, index) => index === 0 || point.age === projection.retirementAge || point.age % 2 === 0);
  const calloutX = Math.max(pad.l, Math.min(width - pad.r - 88, x(selected.age) - 44));
  const calloutY = Math.max(8, y(selected.value) - 48);
  chart.innerHTML = `<div class="chart-selected-value" aria-live="polite"><span>Selected age ${selected.age}</span><strong>${escapeHtml(selectedLabel)}</strong><small>${escapeHtml(selectedCaption)}</small></div>
  <div class="chart-scroll" tabindex="0" aria-label="Scrollable projection chart">
    <svg class="chart-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title.textContent)}">
      <defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b63f6" stop-opacity="0.20"/><stop offset="1" stop-color="#0b63f6" stop-opacity="0.02"/></linearGradient></defs>
      ${yLabels.map(([value, labelText]) => `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(value)}" y2="${y(value)}" stroke="#dbe6f6" stroke-dasharray="4 4"/><text class="chart-label" x="12" y="${y(value) + 4}">${labelText}</text>`).join("")}
      <path d="${area}" fill="url(#chart-fill)"></path>
      <path d="${path}" fill="none" stroke="#0b63f6" stroke-width="4" stroke-linecap="round"></path>
      ${points.map((point) => `<g class="chart-point-target ${point.age === selected.age ? "selected" : ""}" data-chart-point data-chart-tab="${escapeHtml(tab)}" data-chart-age="${point.age}" tabindex="0" role="button" aria-label="Age ${point.age}, ${tab === "pot" ? money(point.value) : `${money(point.value)} per month`}"><circle class="chart-hit" cx="${x(point.age)}" cy="${y(point.value)}" r="14"></circle><circle class="chart-point" cx="${x(point.age)}" cy="${y(point.value)}" r="${point.age === selected.age ? 8 : 5}" fill="#0b63f6" stroke="#fff" stroke-width="${point.age === selected.age ? 3 : 2}"><title>Age ${point.age}: ${tab === "pot" ? money(point.value) : `${money(point.value)} per month`}</title></circle></g>`).join("")}
      <line x1="${x(selected.age)}" x2="${x(selected.age)}" y1="${y(selected.value)}" y2="${height - pad.b}" stroke="#9bbcf5" stroke-dasharray="4 4"></line>
      <rect x="${calloutX}" y="${calloutY}" rx="7" width="88" height="28" fill="#0b63f6"></rect>
      <text class="chart-title-callout" x="${calloutX + 44}" y="${calloutY + 18}" text-anchor="middle">${escapeHtml(selectedLabel)}</text>
      <text class="chart-label" x="${pad.l - 42}" y="${height - 12}">Age</text>
      ${ageLabels.map((point) => `<text class="chart-label" x="${x(point.age)}" y="${height - 12}" text-anchor="middle" ${point.age === projection.retirementAge ? "fill='#0b63f6' font-weight='600'" : ""}>${point.age}</text>`).join("")}
    </svg>
  </div>
  <div class="chart-value-strip" aria-label="Selected projection values">
    ${points.filter((point, index) => index === 0 || point.age === projection.retirementAge || point.age % 5 === 0 || point.age === selected.age).map((point) => `<button type="button" class="${point.age === selected.age ? "active" : ""}" data-chart-point data-chart-tab="${escapeHtml(tab)}" data-chart-age="${point.age}"><strong>Age ${point.age}</strong>${tab === "pot" ? money(point.value) : `${money(point.value)}/mo`}</button>`).join("")}
  </div>`;
}


function renderInsights() {
  const s = app.portfolio.savings || DEFAULT_PORTFOLIO.savings;
  $("#insight-metrics").innerHTML = [
    { icon: "£", iconClass: "green", label: "Emergency savings", value: s.currentSavings, sub: "current buffer" },
    { icon: "▤", label: "Monthly expenses", value: s.monthlyExpenses, sub: "used for buffer check" },
    { icon: "◎", iconClass: "green", label: "Target buffer", value: s.target, sub: "3 months of expenses" },
    { icon: "✓", iconClass: "green", label: "Status", value: s.status, sub: "short-term buffer" }
  ].map(metricCard).join("");
  $("#savings-months").textContent = s.monthsCovered;
  $("#savings-list").innerHTML = splitRows([
    ["", "Current savings", s.currentSavings, "green"],
    ["", "Monthly expenses", s.monthlyExpenses, "blue"],
    ["", "Target buffer", s.target, "blue"],
    ["", "Last updated", s.lastUpdated, "blue"]
  ]);
  $("#insight-actions").innerHTML = [
    ["✓", "green", "Keep savings separate", "Emergency savings should not be treated as pension investment capital.", "insights"],
    ["↗", "blue", "Review contribution increase", "Your buffer is above target, so extra pension contributions can be reviewed.", "contributions"],
    ["!", "amber", "Check one document fact", "Confirmed document facts make projections more reliable.", "documents"]
  ].map(actionRow).join("");
}

function renderDocuments() {
  const docs = app.portfolio.documents || [];
  const reviewed = docs.filter((d) => /checked|reviewed/i.test(d.status)).length;
  const needs = docs.filter((d) => /needs review|^review$/i.test(String(d.status || ""))).length;
  $("#document-status-list").innerHTML = [
    statusRow("✓", "green", `${reviewed} reviewed`, "Confirmed document facts."),
    statusRow("◷", "amber", `${needs} needs review`, "Check extracted facts."),
    statusRow("▤", "blue", "1 new upload", "Ready for review.")
  ].join("");
  $("#document-list").innerHTML = docs.slice(0, 3).map((doc) => `<div class="document-row"><span class="pdf-icon">PDF</span><span><strong>${escapeHtml(doc.name)}</strong><small>Uploaded ${escapeHtml(doc.date)} · Source: ${escapeHtml(doc.source || "Portal")}</small></span><span class="pill">${escapeHtml(doc.provider)}</span><span class="pill ${/review|needs/i.test(doc.status) ? "amber" : "green"}">${escapeHtml(doc.status)}</span><button class="inline-link" type="button">View ›</button></div>`).join("");
  const selected = app.lastExtraction || docs[0]?.extracted || {};
  renderFacts(selected);
  $("#review-steps").innerHTML = [
    ["1", "Upload a document", "Upload a pension letter or statement in PDF, JPG or PNG format."],
    ["2", "Check extracted facts", "We extract key details for you to review and confirm."],
    ["3", "Save confirmed values", "Save the facts to keep your records accurate."]
  ].map(([num, title, text]) => `<div class="review-step"><span class="step-num">${num}</span><span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></span></div>`).join("");
}

function renderFacts(extracted = {}) {
  const rows = [
    ["provider", "Provider", extracted.provider || "Aviva"],
    ["policy", "Policy number", extracted.policy || extracted.policyNumber || "AV-48291"],
    ["potValue", "Current pot value", extracted.potValue != null ? money(extracted.potValue) : "£48,230"],
    ["contributionEmployer", "Employer contribution", extracted.contributionEmployer != null ? money(extracted.contributionEmployer) : (extracted.employerContribution || "5%")],
    ["contributionEmployee", "Employee contribution", extracted.contributionEmployee != null ? money(extracted.contributionEmployee) : (extracted.employeeContribution || "4%")],
    ["chargePct", "Annual charge", extracted.chargePct != null ? `${extracted.chargePct}%` : "0.45%"],
    ["statementDate", "Statement date", extracted.statementDate || "12 Apr 2026"]
  ];
  $("#facts-table").innerHTML = rows.map(([, label, value]) => `<div class="fact-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}

function renderAssistant() {
  renderConnectionForms();
  renderChatLog();
}

function initialAssistantText() {
  return "Ask about your pension and investments.";
}

function renderChatLog() {
  const log = $("#chat-log");
  if (!log) return;
  const messages = [{ role: "assistant", text: initialAssistantText() }, ...app.messages];
  log.innerHTML = messages.map((message) => {
    const content = message.role === "assistant" ? formatAssistantAnswer(message.text) : escapeHtml(message.text);
    return `<div class="chat-bubble ${message.role === "user" ? "user" : "assistant"}">${message.role === "assistant" ? `<span class="bubble-icon">✦</span>` : ""}<div class="bubble-content">${content}</div></div>`;
  }).join("");
  log.scrollTop = log.scrollHeight;
}

function formatAssistantAnswer(text = "") {
  const escaped = escapeHtml(String(text || "").replace(/\*\*/g, ""));
  const headings = ["Answer", "Your personalised suggestion", "General suggestion", "Suggested direction", "Why this fits the dashboard", "What this means for your dashboard", "What to check", "What must be checked", "What I would check", "What I would check in your pots", "Legal route", "Likely legal route", "Suggested next step", "Next step", "How to refine this suggestion"];
  let html = escaped;
  for (const heading of headings) {
    const pattern = new RegExp(`(^|\\n)${heading}(\\n)`, "g");
    html = html.replace(pattern, `$1<h4>${heading}</h4>`);
  }
  html = html.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br />");
  return `<p>${html}</p>`.replace(/<p><h4>/g, "<h4>").replace(/<\/h4><\/p>/g, "</h4>");
}

function renderSettings() {
  const settings = app.userSettings;
  const meta = activeAccountMeta();
  $("#profile-list").innerHTML = splitRows([
    ["", "Full name", meta.name, "blue"],
    ["", "Notification email", meta.email || "Not added", "blue"],
    ["", "Retirement age", String(app.portfolio.assumptions?.retirementAge || "Not added"), "blue"],
    ["", "Country", "United Kingdom", "blue"]
  ]);
  $("#notification-settings").innerHTML = toggleRows([
    ["actionAlerts", "Action-needed alerts", "Get notified when something needs your attention.", settings.actionAlerts],
    ["documentAlerts", "Document review alerts", "Get notified when documents are uploaded or reviewed.", settings.documentAlerts],
    ["projectionUpdates", "Projection updates", "Get notified when new forecasts or projections are available.", settings.projectionUpdates]
  ]);
  applyUserDisplaySettings();
  renderPlanningDataForm();
  renderRiskProfileForm();
}

function renderPlanningDataForm() {
  const form = $("#planning-data-form");
  if (!form) return;
  const assumptions = app.portfolio.assumptions || {};
  const savings = app.portfolio.savings || {};
  form.profileName.value = app.portfolio.profile?.name || activeAccountMeta().name || "";
  form.profileEmail.value = app.portfolio.profile?.email || activeAccountMeta().email || "";
  form.currentAge.value = assumptions.currentAge ?? "";
  form.retirementAge.value = assumptions.retirementAge ?? "";
  form.salary.value = inputNumber(assumptions.salary);
  form.monthlyTarget.value = inputNumber(app.portfolio.monthlyTarget);
  form.statePensionMonthly.value = inputNumber(app.portfolio.statePension?.monthlyIncome);
  form.currentSavings.value = inputNumber(savings.currentSavings);
  form.monthlyExpenses.value = inputNumber(savings.monthlyExpenses);
  const status = $("#planning-data-status");
  if (status && !status.textContent) status.textContent = "These figures feed the projection, savings checks and assistant context.";
}

function renderRiskProfileForm() {
  const form = $("#risk-profile-form");
  if (!form) return;
  const profile = app.riskProfile || {};
  form.preferredStyle.value = profile.preferredStyle || "";
  form.timeHorizonYears.value = profile.timeHorizonYears ?? "";
  form.lossTolerancePct.value = profile.lossTolerancePct ?? "";
  form.mainGoal.value = profile.mainGoal || "";
  form.mustCheckItems.value = Array.isArray(profile.mustCheckItems) ? profile.mustCheckItems.join(", ") : "";
  const status = $("#risk-profile-status");
  if (status) {
    status.textContent = profile.completed ? "Risk profile complete. The assistant can use this for investment review routes." : "Risk profile incomplete. Complete it before deeper investment suggestions.";
    status.className = `connection-status risk-profile-wide ${profile.completed ? "ok" : ""}`;
  }
}

function renderActionCentre() {
  const list = $("#action-centre-list");
  if (!list) return;
  list.innerHTML = groupedActionsHtml(userVisibleActions());
}

function groupedActionsHtml(openActions = []) {
  if (!openActions.length) {
    return `<p class="subtle">No open actions.</p>`;
  }
  return numberedActionList(openActions);
}

function actionGroup(title, actions = [], emptyText = "No items.") {
  return `<section class="action-priority-group"><h4>${escapeHtml(title)}</h4>${actions.length ? numberedActionList(actions) : `<p class="subtle">${escapeHtml(emptyText)}</p>`}</section>`;
}

function numberedActionList(actions = []) {
  return `<ol class="action-numbered-list">
    ${actions.map((action) => `<li data-priority="${escapeHtml(action.priority || "medium")}">
      <span class="action-step-marker">${action.priority === "high" ? `<span class="urgent-task-marker" aria-label="Action needed">!</span>` : ""}<span class="action-step-number" aria-hidden="true"></span></span>
      <span><strong>${escapeHtml(action.title)}</strong><small>${escapeHtml(action.detail || "")}</small></span>
      <span class="action-centre-controls"><button class="secondary-action slim" type="button" data-view="${escapeHtml(action.linkedView || "overview")}">${escapeHtml(actionDirectLabel(action))}</button><button class="inline-link small" type="button" data-action-done="${escapeHtml(action.id)}">Dismiss</button></span>
    </li>`).join("")}
  </ol>`;
}

function actionDirectLabel(action = {}) {
  const text = `${action.sourceKey || ""} ${action.category || ""} ${action.title || ""} ${action.detail || ""}`.toLowerCase();
  if (/manual|provider|data_quality|data/.test(text)) return "Check data";
  if (/document|statement|policy/.test(text)) return "Review document";
  if (/risk/.test(text)) return "Complete risk profile";
  if (/charge|fee/.test(text)) return "Check charge";
  if (/projection|target|gap/.test(text)) return "Review projection";
  if (/manual|provider|data/.test(text)) return "Check data";
  return "Review";
}

function toggleRows(rows) {
  return rows.map(([key, title, sub, on]) => `<button class="toggle-row" type="button" role="switch" aria-checked="${on ? "true" : "false"}" data-toggle-setting="${escapeHtml(key)}"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(sub)}</small></span><span class="switch ${on ? "on" : ""}" aria-hidden="true"></span></button>`).join("");
}


function renderConnectionForms() {
  $all("[data-api-form]").forEach((container) => {
    const context = container.getAttribute("data-api-form");
    container.innerHTML = connectionFormHtml(context);
  });
  $all("[data-api-form]").forEach(wireConnectionForm);
}

function connectionFormHtml(context) {
  const api = app.api;
  const provider = api.provider || "openai";
  const providers = Object.entries(PROVIDER_LABELS).map(([value, label]) => `<option value="${value}" ${provider === value ? "selected" : ""}>${label}</option>`).join("");
  const endpointPlaceholder = PROVIDER_ENDPOINT_PLACEHOLDERS[provider] || PROVIDER_ENDPOINT_PLACEHOLDERS.custom;
  const modelPlaceholder = PROVIDER_DEFAULT_MODELS[provider] || "gpt-4o-mini";
  const hint = PROVIDER_HINTS[provider] || PROVIDER_HINTS.custom;
  return `<div class="form-field"><label for="provider-${context}">Provider</label><select id="provider-${context}" data-api-provider><option value="">Choose provider</option>${providers}</select><small class="provider-hint">${escapeHtml(hint)}</small></div>
    <div class="form-field"><label for="key-${context}">API key</label><input id="key-${context}" data-api-key type="password" value="${escapeHtml(api.apiKey || "")}" placeholder="Paste API key for testing" /></div>
    <div class="form-field"><label for="model-${context}">Model</label><input id="model-${context}" data-api-model type="text" value="${escapeHtml(api.model || "")}" placeholder="${escapeHtml(modelPlaceholder)}" /></div>
    <div class="form-field"><label for="endpoint-${context}">Endpoint (optional)</label><input id="endpoint-${context}" data-api-endpoint type="text" value="${escapeHtml(api.endpoint || "")}" placeholder="${escapeHtml(endpointPlaceholder)}" /></div>
    <div class="connection-buttons"><button class="primary-action" type="button" data-save-connection>Save connection</button><button class="secondary-action" type="button" data-test-connection>Test connection</button></div>
    <p class="connection-status" data-connection-status></p>`;
}

function wireConnectionForm(container) {
  const providerInput = $("[data-api-provider]", container);
  const keyInput = $("[data-api-key]", container);
  const modelInput = $("[data-api-model]", container);
  const endpointInput = $("[data-api-endpoint]", container);
  const status = $("[data-connection-status]", container);
  const sync = () => {
    const enteredKey = keyInput.value.trim();
    const keyProvider = detectProviderFromApiKey(enteredKey);
    if (keyProvider && (!providerInput.value || providerInput.value === "openai") && keyProvider !== providerInput.value) {
      providerInput.value = keyProvider;
      if (!modelInput.value.trim() || Object.values(PROVIDER_DEFAULT_MODELS).includes(modelInput.value.trim())) {
        modelInput.value = PROVIDER_DEFAULT_MODELS[keyProvider] || modelInput.value;
      }
    }
    app.api.provider = providerInput.value || "openai";
    app.api.apiKey = enteredKey;
    app.api.model = modelInput.value.trim() || PROVIDER_DEFAULT_MODELS[app.api.provider] || "gpt-4o-mini";
    app.api.endpoint = endpointInput.value.trim();
  };
  providerInput.addEventListener("change", () => {
    const newProvider = providerInput.value || "openai";
    app.api.provider = newProvider;
    if (!modelInput.value.trim() || Object.values(PROVIDER_DEFAULT_MODELS).includes(modelInput.value.trim())) {
      modelInput.value = PROVIDER_DEFAULT_MODELS[newProvider] || "gpt-4o-mini";
    }
    sync(); saveApiSettings(); renderConnectionForms();
  });
  [keyInput, modelInput, endpointInput].forEach((input) => input.addEventListener("input", sync));
  $("[data-save-connection]", container).addEventListener("click", () => {
    sync(); saveApiSettings();
    status.textContent = "Connection saved for testing.";
    status.className = "connection-status ok";
  });
  $("[data-test-connection]", container).addEventListener("click", async () => {
    sync(); saveApiSettings();
    status.textContent = "Testing connection…";
    status.className = "connection-status";
    try {
      const data = await fetchJson("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload())
      });
      status.textContent = data.message || "Connection test passed.";
      status.className = "connection-status ok";
    } catch (error) {
      status.textContent = error.message;
      status.className = "connection-status error";
    }
  });
}

function apiPayload() {
  return {
    provider: app.api.provider,
    apiKey: app.api.apiKey,
    model: app.api.model || PROVIDER_DEFAULT_MODELS[app.api.provider],
    endpoint: app.api.endpoint,
    settings: {
      riskProfile: app.riskProfile?.preferredStyle || "",
      riskProfileDetails: app.riskProfile,
      model: app.api.model,
      endpoint: app.api.endpoint,
      portfolioLinkedDefault: app.userSettings.portfolioLinkedDefault,
      showDataUsedSummary: false,
      detectedInvestmentStyle: app.investmentReview?.style || app.portfolio.investmentProfile?.currentStyle || "",
      investmentReview: app.investmentReview
    }
  };
}

function isInvestmentAdviceQuestion(text = "") {
  const lower = text.toLowerCase();
  return /\b(invest\w*|advi[cs]e|funds?|stocks?|shares?|equity|equities|allocation|risk|growth|balanced|conservative|portfolio)\b/.test(lower)
    && /\b(advi[cs]e|suggest|review|change|switch|should|what|how|route|plan|invest)\b/.test(lower);
}

function hasRiskProfileAnswers(text = "") {
  const lower = text.toLowerCase();
  const hasStyle = Boolean(detectRiskStyle(lower));
  const hasLoss = /\b(lose|loss|fall|drop|down|volatil|temporary|10%|20%|30%|40%)\b/.test(lower);
  const hasTime = /\b(years?|retire|retirement|age|horizon|long[- ]term|short[- ]term)\b/.test(lower);
  const hasGoal = /\b(goal|gap|income|growth|protect|safety|stable|stability|cash|access|need)\b/.test(lower);
  return hasStyle && (hasLoss || hasTime || hasGoal);
}

function riskQuestionnaireText(question = "") {
  const current = app.portfolio.investmentProfile || {};
  return [
    "Answer",
    "Before I give a deeper personalised investment suggestion, please answer these quick risk-profile questions in one message.",
    "",
    "1. Preferred style: conservative, balanced or growth?",
    "2. Time horizon: how many years until you expect to use this pension money?",
    "3. Temporary loss tolerance: what fall could you tolerate without panic-selling — for example 10%, 20% or 30%?",
    "4. Main goal: close the monthly gap, protect the pot, grow the pot, or balance growth and stability?",
    "5. Any must-check items: guarantees, high charges, transfer concerns or money you may need soon?",
    "",
    `Current dashboard context: ${current.currentStyle || "Balanced"} style, ${current.equityExposure || "62%"} equity, ${current.bondExposure || "28%"} bonds and ${current.cashOther || "10%"} cash / other.`,
    "",
    "You can reply, for example: Balanced, 12 years, I can tolerate a 20% fall, goal is to reduce the monthly gap, no known guarantees."
  ].join("\n");
}

async function submitQuestionToAssistant(question, riskSourceText = question) {
  const payload = apiPayload();
  const riskProfile = detectRiskStyle(riskSourceText) || detectRiskStyle(question);
  return fetchJson("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, question, settings: { ...payload.settings, riskProfile: riskProfile || payload.settings.riskProfile || "" } })
  });
}

async function handleAssistantSubmit(event) {
  event.preventDefault();
  const input = $("#assistant-input");
  const rawQuestion = input.value.trim();
  if (!rawQuestion) return;
  input.value = "";
  app.messages.push({ role: "user", text: rawQuestion });

  let question = rawQuestion;
  let riskSourceText = rawQuestion;
  const isRiskReply = app.pendingInvestmentAdvice && hasRiskProfileAnswers(rawQuestion);
  if (isRiskReply) {
    question = `${app.pendingInvestmentAdvice}\n\nUser risk-profile answers: ${rawQuestion}`;
    riskSourceText = rawQuestion;
    app.pendingInvestmentAdvice = null;
  } else if (app.pendingInvestmentAdvice && !hasRiskProfileAnswers(rawQuestion)) {
    app.messages.push({ role: "assistant", text: "Answer\nThanks — please add a little more detail so I can link the suggestion to your portfolio properly. Include your preferred style, time horizon, temporary loss tolerance and main goal. Example: Balanced, 12 years, I can tolerate a 20% fall, goal is to reduce the monthly gap." });
    renderChatLog();
    return;
  } else if (isInvestmentAdviceQuestion(rawQuestion) && !hasRiskProfileAnswers(rawQuestion)) {
    app.pendingInvestmentAdvice = rawQuestion;
    app.messages.push({ role: "assistant", text: riskQuestionnaireText(rawQuestion) });
    renderChatLog();
    return;
  }

  app.messages.push({ role: "assistant", text: "Thinking…" });
  renderChatLog();
  try {
    const data = await submitQuestionToAssistant(question, riskSourceText);
    app.messages[app.messages.length - 1] = { role: "assistant", text: data.answer || "No answer returned." };
  } catch (error) {
    app.messages[app.messages.length - 1] = { role: "assistant", text: `Answer\nI could not connect to the assistant provider, so I could not complete this request.\n\nNext step\nOpen Connection settings, check the selected provider, API key, model and endpoint, then try again.\n\nError\n${error.message}` };
  }
  renderChatLog();
}

function detectRiskStyle(text = "") {
  const lower = text.toLowerCase();
  if (/conservative|cautious|low[- ]?risk|safe/.test(lower)) return "conservative";
  if (/growth|aggressive|high[- ]?risk|equity/.test(lower)) return "growth";
  if (/balanced|moderate|medium/.test(lower)) return "balanced";
  return "";
}

async function handleDocumentFile(file) {
  const status = $("#scan-status");
  status.textContent = `Scanning ${file.name}…`;
  try {
    const payloadFile = await fileToPayload(file);
    const data = await fetchJson("/api/extract-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...apiPayload(), file: payloadFile })
    });
    app.lastExtraction = data.extraction || {};
    await loadPortfolio();
    renderFacts(app.lastExtraction);
    renderDocuments();
    renderOverview();
    renderAlerts();
    status.textContent = data.summary || "Document scan complete. Review the extracted facts.";
  } catch (error) {
    status.textContent = error.message;
  }
}

async function refreshProductState() {
  await loadPortfolio();
  renderOverview();
  renderAccounts();
  renderContributions();
  renderDocuments();
  renderSettings();
  renderActionCentre();
  renderAlerts();
  renderInvestments();
  renderTarget();
  renderInsights();
  renderAssistant();
}

async function updateActionStatus(actionId, status) {
  await fetchJson(`/api/actions/${encodeURIComponent(actionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  await refreshProductState();
}

async function updateNotification(notificationId, action) {
  await fetchJson(`/api/notifications/${encodeURIComponent(notificationId)}/${action}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" }
  });
  await refreshProductState();
}

async function handleSecurityAction(action, button) {
  const status = $("#security-status");
  const endpoint = action === "data-deletion" ? "/api/security/data-deletion" : "/api/security/sign-out-all";
  const working = action === "data-deletion" ? "Submitting deletion request…" : "Signing out other sessions…";
  if (button) button.disabled = true;
  if (status) {
    status.textContent = working;
    status.className = "connection-status";
  }
  try {
    const data = await fetchJson(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    await refreshProductState();
    if (status) {
      status.textContent = data.message || "Security action completed.";
      status.className = "connection-status ok";
    }
  } catch (error) {
    if (status) {
      status.textContent = error.message;
      status.className = "connection-status error";
    }
  } finally {
    if (button) button.disabled = false;
  }
}

async function saveRiskProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    preferredStyle: form.preferredStyle.value,
    timeHorizonYears: form.timeHorizonYears.value ? Number(form.timeHorizonYears.value) : null,
    lossTolerancePct: form.lossTolerancePct.value ? Number(form.lossTolerancePct.value) : null,
    mainGoal: form.mainGoal.value,
    mustCheckItems: form.mustCheckItems.value
  };
  const status = $("#risk-profile-status");
  if (status) {
    status.textContent = "Saving risk profile…";
    status.className = "connection-status risk-profile-wide";
  }
  try {
    const data = await fetchJson("/api/risk-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    app.riskProfile = data.riskProfile;
    await refreshProductState();
    if (status) {
      status.textContent = "Risk profile saved.";
      status.className = "connection-status risk-profile-wide ok";
    }
  } catch (error) {
    if (status) {
      status.textContent = error.message;
      status.className = "connection-status risk-profile-wide error";
    }
  }
}

async function savePlanningData(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("#planning-data-status");
  const payload = {
    profileName: form.profileName.value,
    profileEmail: form.profileEmail.value,
    currentAge: form.currentAge.value,
    retirementAge: form.retirementAge.value,
    salary: form.salary.value,
    monthlyTarget: form.monthlyTarget.value,
    statePensionMonthly: form.statePensionMonthly.value,
    currentSavings: form.currentSavings.value,
    monthlyExpenses: form.monthlyExpenses.value
  };
  if (status) {
    status.textContent = "Saving planning data…";
    status.className = "connection-status planning-data-wide";
  }
  try {
    const data = await fetchJson("/api/profile-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (data.portfolio) app.portfolio = { ...app.portfolio, ...data.portfolio };
    await refreshProductState();
    renderAll();
    if (status) {
      status.textContent = "Planning data saved.";
      status.className = "connection-status planning-data-wide ok";
    }
  } catch (error) {
    if (status) {
      status.textContent = error.message;
      status.className = "connection-status planning-data-wide error";
    }
  }
}

function dateInputToLabel(value = "") {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

async function saveManualAccount(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("#manual-account-status");
  const payload = {
    provider: form.provider.value,
    name: form.name.value,
    type: form.type.value,
    pot: form.pot.value,
    charges: form.charges.value,
    policy: form.policy.value,
    lastUpdated: dateInputToLabel(form.lastUpdated.value)
  };
  if (status) {
    status.textContent = "Adding account…";
    status.className = "connection-status";
  }
  try {
    await fetchJson("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    form.reset();
    await refreshProductState();
    renderAll();
    if (status) {
      status.textContent = "Account added.";
      status.className = "connection-status ok";
    }
  } catch (error) {
    if (status) {
      status.textContent = error.message;
      status.className = "connection-status error";
    }
  }
}

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      let text = "";
      if (/text|json|csv|plain/i.test(file.type) || /\.(txt|text|csv)$/i.test(file.name)) {
        text = String(reader.result || "");
        resolve({ fileName: file.name, mimeType: file.type || "text/plain", text });
        return;
      }
      const dataReader = new FileReader();
      dataReader.onload = () => resolve({ fileName: file.name, mimeType: file.type || "application/octet-stream", dataUrl: String(dataReader.result || "") });
      dataReader.onerror = () => reject(new Error("Could not read file data."));
      dataReader.readAsDataURL(file);
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    if (/text|json|csv|plain/i.test(file.type) || /\.(txt|text|csv)$/i.test(file.name)) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });
}

function setView(view) {
  const target = $(`#${view}`) ? view : "overview";
  app.view = target;
  localStorage.setItem(STORAGE_KEY, target);
  $all(".view").forEach((section) => section.classList.toggle("active", section.id === target));
  $all(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === target));
  $("#app-shell").classList.remove("nav-open");
  $("#alerts-popover")?.classList.add("hidden");
  $("#account-popover")?.classList.add("hidden");
  window.location.hash = target;
}

function wireEvents() {
  document.addEventListener("click", (event) => {
    const accountSwitch = event.target.closest("[data-account-switch]");
    if (accountSwitch) {
      event.preventDefault();
      switchDemoUser(accountSwitch.getAttribute("data-account-switch")).catch(console.error);
      return;
    }
    const accountToggle = event.target.closest("[data-toggle-account]");
    if (accountToggle) {
      event.preventDefault();
      $("#alerts-popover")?.classList.add("hidden");
      $("#account-popover")?.classList.toggle("hidden");
      return;
    }
    const closeAccount = event.target.closest("[data-close-account]");
    if (closeAccount) {
      event.preventDefault();
      $("#account-popover")?.classList.add("hidden");
      return;
    }
    const chartPoint = event.target.closest("[data-chart-point]");
    if (chartPoint) {
      event.preventDefault();
      const tab = chartPoint.getAttribute("data-chart-tab") || app.chartTab;
      const age = Number(chartPoint.getAttribute("data-chart-age"));
      if (Number.isFinite(age)) {
        app.chartSelections[tab] = age;
        renderChart(tab);
      }
      return;
    }
    const allocationSegment = event.target.closest("[data-allocation-index]");
    if (allocationSegment) {
      event.preventDefault();
      const index = Number(allocationSegment.getAttribute("data-allocation-index"));
      if (Number.isFinite(index)) {
        app.selectedAllocationIndex = index;
        renderInvestments();
      }
      return;
    }
    const gapSegment = event.target.closest("[data-gap-segment]");
    if (gapSegment) {
      event.preventDefault();
      app.selectedGapSegment = gapSegment.getAttribute("data-gap-segment") === "left" ? "left" : "complete";
      renderOverviewTargetGap();
      return;
    }
    const actionDone = event.target.closest("[data-action-done]");
    if (actionDone) {
      event.preventDefault();
      updateActionStatus(actionDone.getAttribute("data-action-done"), "dismissed").catch(console.error);
      return;
    }
    const dismissButton = event.target.closest("[data-notification-dismiss]");
    if (dismissButton) {
      event.preventDefault();
      updateNotification(dismissButton.getAttribute("data-notification-dismiss"), "dismiss").catch(console.error);
      return;
    }
    const toggleButton = event.target.closest("[data-toggle-setting]");
    if (toggleButton) {
      const key = toggleButton.getAttribute("data-toggle-setting");
      if (key && Object.prototype.hasOwnProperty.call(app.userSettings, key)) {
        app.userSettings[key] = !app.userSettings[key];
        saveUserSettings();
        applyUserDisplaySettings();
        renderSettings();
      }
      return;
    }
    const securityAction = event.target.closest("[data-security-action]");
    if (securityAction) {
      event.preventDefault();
      handleSecurityAction(securityAction.getAttribute("data-security-action"), securityAction).catch(console.error);
      return;
    }
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      event.preventDefault();
      const prompt = viewButton.getAttribute("data-prompt");
      const scrollTarget = viewButton.getAttribute("data-scroll-target");
      setView(viewButton.dataset.view);
      if (scrollTarget) {
        requestAnimationFrame(() => document.getElementById(scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      }
      if (prompt) {
        const input = $("#assistant-input");
        input.value = prompt;
        input.focus();
      }
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const chartPoint = event.target.closest?.("[data-chart-point]");
    if (chartPoint) {
      event.preventDefault();
      chartPoint.click();
    }
    const gapSegment = event.target.closest?.("[data-gap-segment]");
    if (gapSegment) {
      event.preventDefault();
      gapSegment.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });
  $("[data-sidebar-toggle]").addEventListener("click", () => {
    const shell = $("#app-shell");
    const collapsed = shell.classList.toggle("sidebar-collapsed");
    $("[data-sidebar-toggle]").setAttribute("aria-expanded", String(!collapsed));
  });
  $("[data-mobile-menu]").addEventListener("click", () => $("#app-shell").classList.toggle("nav-open"));
  $("[data-toggle-alerts]").addEventListener("click", () => {
    $("#account-popover")?.classList.add("hidden");
    $("#alerts-popover").classList.toggle("hidden");
  });
  $("[data-close-alerts]").addEventListener("click", () => $("#alerts-popover").classList.add("hidden"));
  $all("[data-chart-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      app.chartTab = button.dataset.chartTab;
      $all("[data-chart-tab]").forEach((btn) => btn.classList.toggle("active", btn === button));
      renderChart(app.chartTab);
    });
  });
  const analyseButton = $("#analyse-investment-style");
  if (analyseButton) analyseButton.addEventListener("click", analyseInvestmentStyle);
  const riskProfileForm = $("#risk-profile-form");
  if (riskProfileForm) riskProfileForm.addEventListener("submit", saveRiskProfile);
  const manualAccountForm = $("#manual-account-form");
  if (manualAccountForm) manualAccountForm.addEventListener("submit", saveManualAccount);
  const planningDataForm = $("#planning-data-form");
  if (planningDataForm) planningDataForm.addEventListener("submit", savePlanningData);
  const riskProfileReset = $("#risk-profile-reset");
  if (riskProfileReset) riskProfileReset.addEventListener("click", () => {
    const form = $("#risk-profile-form");
    if (form) form.reset();
  });
  const refreshAgentButton = $("#refresh-agent-button");
  if (refreshAgentButton) refreshAgentButton.addEventListener("click", async () => {
    refreshAgentButton.disabled = true;
    const original = refreshAgentButton.textContent;
    refreshAgentButton.textContent = "Refreshing…";
    try {
      await fetchJson("/api/agent/summary", { method: "POST" });
      await refreshProductState();
    } finally {
      refreshAgentButton.disabled = false;
      refreshAgentButton.textContent = original;
    }
  });
  $("#assistant-form").addEventListener("submit", handleAssistantSubmit);
  $("#upload-button").addEventListener("click", () => $("#document-file").click());
  $("#document-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) handleDocumentFile(file);
    event.target.value = "";
  });
  const dropZone = $("#drop-zone");
  ["dragenter", "dragover"].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove("dragging"); }));
  dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) handleDocumentFile(file);
  });
}

function renderAlerts() {
  const activeNotifications = app.notifications || [];
  const badge = $(".notification-badge");
  if (badge) badge.textContent = String(Math.min(99, activeNotifications.length || 0));
  $("#alert-list").innerHTML = activeNotifications.length ? activeNotifications.slice(0, 5).map((notification) => `<div class="notification-row ${escapeHtml(notification.status)}">
    <button class="status-row" type="button" data-view="${escapeHtml(notification.linkedView || "overview")}"><span class="status-icon ${notification.priority === "high" ? "red" : "blue"}" aria-hidden="true">${escapeHtml(notification.priority === "high" ? "!" : itemIcon(notification.category))}</span><span><strong>${escapeHtml(notification.title)}</strong><small>${escapeHtml(notification.body || "")}</small></span><span aria-hidden="true">›</span></button>
    <div class="notification-actions"><button class="inline-link small danger-link" type="button" data-notification-dismiss="${escapeHtml(notification.id)}">Dismiss</button></div>
  </div>`).join("") : [
    statusRow("!", "amber", "1 document needs review", "Confirm extracted fields before saving.", "documents"),
    statusRow("!", "amber", "1 account charge to check", "One account has a higher annual charge.", "pensions"),
    statusRow("i", "blue", "State Pension kept separate", "Shown as income, not pot value.", "target")
  ].join("");
  const preview = $("#phone-preview");
  if (preview) {
    const top = activeNotifications[0];
    preview.innerHTML = top ? `<div class="phone-preview-title">Phone push preview</div>
      <div class="phone-card">
        <span class="phone-app-icon">P</span>
        <span><strong>Pension Plan</strong><small>now</small></span>
        <p>${escapeHtml(top.title)} — ${escapeHtml(top.body || "Open the dashboard to review this item.")}</p>
      </div>` : `<div class="phone-preview-title">Phone push preview</div><div class="phone-card muted"><span class="phone-app-icon">P</span><p>No active alerts to send.</p></div>`;
  }
}

function renderAll() {
  applyUserDisplaySettings();
  renderAccountSwitcher();
  renderOverview();
  renderAccounts();
  renderContributions();
  renderInvestments();
  renderTarget();
  renderInsights();
  renderDocuments();
  renderAssistant();
  renderSettings();
  renderActionCentre();
  renderAlerts();
  renderUrgentActionPills();
  applyBindings();
}

async function loadPortfolio() {
  try {
    const [data, riskData, timelineData] = await Promise.all([
      fetchJson("/api/portfolio"),
      fetchJson("/api/risk-profile"),
      fetchJson("/api/timeline?limit=8")
    ]);
    const defaults = structuredClone(DEFAULT_PORTFOLIO);
    app.portfolio = {
      ...defaults,
      ...data,
      investmentProfile: { ...defaults.investmentProfile, ...(data.investmentProfile || {}) },
      documents: data.documents || DEFAULT_PORTFOLIO.documents,
      pensionAccounts: mergeAccounts(data.pensionAccounts || DEFAULT_PORTFOLIO.pensionAccounts)
    };
    app.agent = data.agent || null;
    app.actions = Array.isArray(data.actions) ? data.actions : [];
    app.notifications = Array.isArray(data.notifications) ? data.notifications : [];
    app.timeline = Array.isArray(timelineData.timeline) ? timelineData.timeline : [];
    app.riskProfile = riskData.riskProfile || null;
  } catch {
    app.portfolio = structuredClone(DEFAULT_PORTFOLIO);
    app.agent = null;
    app.actions = [];
    app.notifications = [];
    app.timeline = [];
    app.riskProfile = null;
  }
}

function mergeAccounts(accounts) {
  const defaults = DEFAULT_PORTFOLIO.pensionAccounts;
  return accounts.map((account, index) => {
    const provider = String(account.provider || "").toLowerCase();
    const providerDefault = defaults.find((item) => String(item.provider || "").toLowerCase() === provider) || {};
    return { ...providerDefault, ...account, policy: account.policy || providerDefault.policy || "" };
  });
}

async function init() {
  wireEvents();
  await loadPortfolio();
  renderAll();
  const hash = location.hash.replace("#", "");
  setView(hash || app.view || "overview");
}

init();
