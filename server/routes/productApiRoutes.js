import { appendAuditEvent, readAuditLog, readPortfolio, readRiskProfile, storageStatus, writePortfolio, writeRiskProfile } from "../store/userDataStore.js";
import { getContributionScenarios } from "../portfolioStore.js";
import { runAgentForUser } from "../services/agentService.js";
import { createSession, getSession, listSessions, revokeOtherSessions, revokeSession, startMfaChallenge, verifyMfaChallenge } from "../services/authService.js";
import { listDeletionRequests, requestDataDeletion, updateDeletionRequest } from "../services/adminWorkflowService.js";
import { createManualAction, listActions, updateAction } from "../services/actionService.js";
import {
  createNotification,
  dismissNotification,
  getNotificationPreferences,
  listNotifications,
  markNotificationRead,
  updateNotificationPreferences
} from "../services/notificationService.js";
import { confirmDocumentFacts, listDocuments, updateDocumentFacts } from "../services/documentService.js";
import { getIntegrationStatus } from "../services/integrationService.js";
import { getComplianceStatus } from "../services/complianceService.js";
import { explainNumber } from "../services/explainNumberService.js";
import { queueStatus } from "../services/jobQueueService.js";
import { listNotificationDeliveries, flushNotificationDeliveries } from "../services/notificationDeliveryService.js";
import { runScheduledAgent, schedulerStatus } from "../services/schedulerService.js";
import { validateActionInput, validateNotificationPreferences, validateRiskProfileInput } from "../utils/validation.js";

async function parseBody(readBody, req) {
  const raw = await readBody(req);
  return raw ? JSON.parse(raw) : {};
}

function routeMatch(pathname, pattern) {
  const match = pathname.match(pattern);
  return match ? match.slice(1).map(decodeURIComponent) : null;
}

function numberFromInput(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function bearerToken(req) {
  const auth = String(req.headers.authorization || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return String(req.headers["x-session-token"] || "").trim();
}

function timelineDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return todayLabel();
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAuditEventForTimeline(event = {}) {
  const type = String(event.type || "dashboard_update");
  const defaults = {
    action_created: ["Action added", `New action created from ${event.source || "dashboard"}.`, "actions"],
    action_updated: [`Action ${event.status || "updated"}`, "Action Centre item status changed.", "actions"],
    notification_read: ["Notification read", "Notification was marked as read.", "actions"],
    notification_dismissed: ["Notification dismissed", "Notification was removed from active alerts.", "actions"],
    notification_preferences_updated: ["Notification preferences updated", "Alert cadence or channels were changed.", "settings"],
    planning_data_updated: ["Planning data updated", `Retirement age ${event.retirementAge || "updated"}; monthly target ${event.monthlyTarget || "updated"}.`, "target"],
    manual_account_added: ["Pension account added", `${event.provider || "A provider"} was added as a manual account.`, "pensions"],
    session_created: ["Signed in", "A dashboard session was created.", "settings"],
    session_revoked: ["Session signed out", `${event.revoked || 1} session was revoked.`, "settings"],
    mfa_challenge_created: ["2FA check started", "A two-factor authentication challenge was created.", "settings"],
    mfa_challenge_verified: ["2FA verified", "Two-factor authentication was completed.", "settings"],
    risk_profile_updated: ["Risk profile updated", `${event.preferredStyle || "Investment style"} profile saved.`, "settings"],
    document_scanned: ["Document scanned", `${event.provider || "Document"} scan saved with ${event.confidence || "review"} confidence.`, "documents"],
    document_facts_updated: ["Document facts edited", "Extracted document facts were changed.", "documents"],
    document_confirmed: ["Document confirmed", "Document facts were confirmed for dashboard use.", "documents"],
    agent_run: ["Agent refreshed", `${event.openActions ?? 0} open action${event.openActions === 1 ? "" : "s"} after review.`, "actions"],
    security_sessions_revoked: ["Other sessions signed out", "All other active dashboard sessions were revoked.", "settings"],
    data_deletion_requested: ["Data deletion requested", `Request ${event.requestId || "created"} was submitted.`, "settings"],
    data_deletion_reviewed: ["Deletion request reviewed", `Request ${event.requestId || ""} moved to ${event.status || "updated"}.`, "settings"]
  };
  const [title, detail, linkedView] = defaults[type] || ["Dashboard updated", "A dashboard record changed.", "overview"];
  return {
    id: event.id,
    type,
    title,
    detail,
    linkedView,
    date: timelineDateLabel(event.occurredAt),
    occurredAt: event.occurredAt
  };
}

function boundedNumberFromInput(value, field, { fallback = null, min = 0, max = Infinity } = {}) {
  if (value == null || value === "") return fallback;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed)) {
    const error = new Error(`${field} must be a number`);
    error.status = 400;
    throw error;
  }
  if (parsed < min || parsed > max) {
    const error = new Error(`${field} is outside the allowed range`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function manualAccountFromInput(input = {}) {
  const provider = String(input.provider || "").trim();
  const name = String(input.name || "").trim();
  if (!provider) throw new Error("Provider is required");
  return {
    id: newId("acct"),
    name: name || `${provider} pension`,
    provider,
    policy: String(input.policy || "").trim() || "Manual entry",
    type: String(input.type || "Personal pension").trim(),
    pot: Math.max(0, numberFromInput(input.pot)),
    source: "Manual entry",
    lastUpdated: String(input.lastUpdated || "").trim() || todayLabel(),
    charges: Math.max(0, numberFromInput(input.charges))
  };
}

function portfolioWithPlanningData(portfolio = {}, input = {}) {
  const today = todayLabel();
  const currentAssumptions = portfolio.assumptions || {};
  const nextCurrentAge = boundedNumberFromInput(input.currentAge, "currentAge", { fallback: currentAssumptions.currentAge ?? 45, min: 18, max: 90 });
  const nextRetirementAge = boundedNumberFromInput(input.retirementAge, "retirementAge", { fallback: currentAssumptions.retirementAge ?? 67, min: 50, max: 90 });
  const assumptions = {
    ...currentAssumptions,
    currentAge: nextCurrentAge,
    retirementAge: Math.max(nextCurrentAge, nextRetirementAge),
    salary: boundedNumberFromInput(input.salary, "salary", { fallback: currentAssumptions.salary ?? 0, min: 0, max: 2_000_000 }),
    monthlyTarget: boundedNumberFromInput(input.monthlyTarget, "monthlyTarget", { fallback: currentAssumptions.monthlyTarget ?? 0, min: 0, max: 100_000 })
  };
  const profileName = String(input.profileName || "").trim();
  const profileEmail = String(input.profileEmail || input.email || "").trim();
  return {
    ...portfolio,
    profile: {
      ...(portfolio.profile || {}),
      name: profileName || portfolio.profile?.name || "New user",
      email: profileEmail || portfolio.profile?.email || "",
      source: portfolio.profile?.source || "User-entered profile"
    },
    assumptions,
    statePension: {
      ...(portfolio.statePension || {}),
      name: portfolio.statePension?.name || "State Pension Forecast",
      monthlyIncome: boundedNumberFromInput(input.statePensionMonthly, "statePensionMonthly", { fallback: portfolio.statePension?.monthlyIncome ?? 0, min: 0, max: 20_000 }),
      source: "User-entered forecast",
      lastUpdated: today
    },
    savings: {
      ...(portfolio.savings || {}),
      currentSavings: boundedNumberFromInput(input.currentSavings, "currentSavings", { fallback: portfolio.savings?.currentSavings ?? 0, min: 0, max: 10_000_000 }),
      monthlyExpenses: boundedNumberFromInput(input.monthlyExpenses, "monthlyExpenses", { fallback: portfolio.savings?.monthlyExpenses ?? 0, min: 0, max: 100_000 }),
      targetMonths: portfolio.savings?.targetMonths ?? 3,
      lastUpdated: today
    },
    systemUpdate: {
      date: today,
      label: "Planning data updated",
      note: "User-entered planning data saved and projection recalculated."
    }
  };
}

export async function handleProductApiRoute({ req, res, url, json, readBody, userId, seedPortfolio }) {
  const { pathname, searchParams } = url;

  if (pathname === "/api/storage/status") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, storageStatus());
  }

  if (pathname === "/api/auth/session") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    const session = bearerToken(req) ? getSession(userId, bearerToken(req)) : null;
    return json(res, 200, { userId, authenticated: Boolean(session), session, activeSessions: listSessions(userId) });
  }

  if (pathname === "/api/auth/login") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    const body = await parseBody(readBody, req);
    const auth = createSession(userId, {
      email: body.email || "",
      userAgent: req.headers["user-agent"] || "",
      ip: req.socket?.remoteAddress || "",
      mfaVerified: false
    });
    const challenge = startMfaChallenge(userId, { channel: body.channel || "app", purpose: "login" });
    return json(res, 200, { userId, ...auth, requires2fa: true, challenge });
  }

  if (pathname === "/api/auth/2fa/start") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    const body = await parseBody(readBody, req);
    return json(res, 200, { challenge: startMfaChallenge(userId, { channel: body.channel || "app", purpose: body.purpose || "login" }) });
  }

  if (pathname === "/api/auth/2fa/verify") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    const body = await parseBody(readBody, req);
    return json(res, 200, verifyMfaChallenge(userId, {
      challengeId: body.challengeId,
      code: body.code,
      sessionToken: body.sessionToken || bearerToken(req)
    }));
  }

  if (pathname === "/api/auth/logout") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, revokeSession(userId, bearerToken(req)));
  }

  if (pathname === "/api/agent/summary") {
    if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    const summary = runAgentForUser({ userId, persist: true, reason: req.method === "POST" ? "manual_agent_refresh" : "api_summary" });
    return json(res, 200, summary);
  }

  if (pathname === "/api/actions") {
    if (req.method === "GET") return json(res, 200, { actions: listActions(userId, { status: searchParams.get("status") || "open" }) });
    if (req.method === "POST") {
      const action = createManualAction(userId, validateActionInput(await parseBody(readBody, req)));
      appendAuditEvent(userId, { type: "action_created", actionId: action.id, source: action.source });
      return json(res, 201, { action });
    }
    return json(res, 405, { error: "Method not allowed" });
  }

  if (pathname === "/api/accounts") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    const portfolio = readPortfolio(userId, seedPortfolio);
    const account = manualAccountFromInput(await parseBody(readBody, req));
    const accounts = Array.isArray(portfolio.accounts) ? portfolio.accounts : [];
    writePortfolio(userId, { ...portfolio, accounts: [account, ...accounts] });
    appendAuditEvent(userId, { type: "manual_account_added", accountId: account.id, provider: account.provider });
    createNotification(userId, {
      source: "dashboard_update",
      sourceKey: `manual_account_added_${account.id}`,
      category: "data_quality",
      priority: "medium",
      title: "Dashboard updated",
      body: `${account.provider} was added as a manual pension account. Review its charge and latest statement before relying on it.`,
      linkedView: "pensions"
    });
    runAgentForUser({ userId, persist: true, reason: "manual_account_added" });
    return json(res, 201, { account });
  }

  if (pathname === "/api/profile-data") {
    if (req.method !== "PUT") return json(res, 405, { error: "Method not allowed" });
    const portfolio = readPortfolio(userId, seedPortfolio);
    const nextPortfolio = portfolioWithPlanningData(portfolio, await parseBody(readBody, req));
    const saved = writePortfolio(userId, nextPortfolio);
    appendAuditEvent(userId, { type: "planning_data_updated", retirementAge: saved.assumptions?.retirementAge, monthlyTarget: saved.assumptions?.monthlyTarget });
    createNotification(userId, {
      source: "dashboard_update",
      sourceKey: `planning_data_updated_${Date.now()}`,
      category: "projection",
      priority: "medium",
      title: "Planning data updated",
      body: "Your projection, dashboard checks and assistant context have been refreshed using the latest figures.",
      linkedView: "target"
    });
    runAgentForUser({ userId, persist: true, reason: "planning_data_updated" });
    return json(res, 200, { portfolio: saved });
  }

  const actionMatch = routeMatch(pathname, /^\/api\/actions\/([^/]+)$/);
  if (actionMatch) {
    if (req.method !== "PATCH") return json(res, 405, { error: "Method not allowed" });
    const action = updateAction(userId, actionMatch[0], await parseBody(readBody, req));
    appendAuditEvent(userId, { type: "action_updated", actionId: action.id, status: action.status });
    return json(res, 200, { action });
  }

  if (pathname === "/api/notifications") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, { notifications: listNotifications(userId, { status: searchParams.get("status") || "active" }) });
  }

  if (pathname === "/api/notification-deliveries") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, { deliveries: listNotificationDeliveries(userId, { status: searchParams.get("status") || "all" }) });
  }

  if (pathname === "/api/notifications/dispatch") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, await flushNotificationDeliveries(userId));
  }

  const readNotificationMatch = routeMatch(pathname, /^\/api\/notifications\/([^/]+)\/read$/);
  if (readNotificationMatch) {
    if (req.method !== "PATCH") return json(res, 405, { error: "Method not allowed" });
    const notification = markNotificationRead(userId, readNotificationMatch[0]);
    appendAuditEvent(userId, { type: "notification_read", notificationId: notification.id });
    return json(res, 200, { notification });
  }

  const dismissNotificationMatch = routeMatch(pathname, /^\/api\/notifications\/([^/]+)\/dismiss$/);
  if (dismissNotificationMatch) {
    if (req.method !== "PATCH") return json(res, 405, { error: "Method not allowed" });
    const notification = dismissNotification(userId, dismissNotificationMatch[0]);
    appendAuditEvent(userId, { type: "notification_dismissed", notificationId: notification.id });
    return json(res, 200, { notification });
  }

  if (pathname === "/api/notification-preferences") {
    if (req.method === "GET") return json(res, 200, { preferences: getNotificationPreferences(userId) });
    if (req.method === "PUT") {
      const preferences = updateNotificationPreferences(userId, validateNotificationPreferences(await parseBody(readBody, req)));
      appendAuditEvent(userId, { type: "notification_preferences_updated", preferences });
      return json(res, 200, { preferences });
    }
    return json(res, 405, { error: "Method not allowed" });
  }

  if (pathname === "/api/risk-profile") {
    if (req.method === "GET") return json(res, 200, { riskProfile: readRiskProfile(userId) });
    if (req.method === "PUT") {
      const riskProfile = writeRiskProfile(userId, validateRiskProfileInput(await parseBody(readBody, req)));
      appendAuditEvent(userId, { type: "risk_profile_updated", status: riskProfile.status, preferredStyle: riskProfile.preferredStyle });
      runAgentForUser({ userId, persist: true, reason: "risk_profile_updated" });
      return json(res, 200, { riskProfile });
    }
    return json(res, 405, { error: "Method not allowed" });
  }

  if (pathname === "/api/documents") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, { documents: listDocuments(userId, seedPortfolio) });
  }

  const documentFactsMatch = routeMatch(pathname, /^\/api\/documents\/([^/]+)\/facts$/);
  if (documentFactsMatch) {
    if (req.method !== "PATCH") return json(res, 405, { error: "Method not allowed" });
    const body = await parseBody(readBody, req);
    const document = updateDocumentFacts(userId, seedPortfolio, documentFactsMatch[0], body.facts || body);
    runAgentForUser({ userId, persist: true, reason: "document_facts_updated" });
    return json(res, 200, { document });
  }

  const documentConfirmMatch = routeMatch(pathname, /^\/api\/documents\/([^/]+)\/confirm$/);
  if (documentConfirmMatch) {
    if (req.method !== "POST" && req.method !== "PATCH") return json(res, 405, { error: "Method not allowed" });
    const document = confirmDocumentFacts(userId, seedPortfolio, documentConfirmMatch[0], await parseBody(readBody, req));
    runAgentForUser({ userId, persist: true, reason: "document_confirmed" });
    return json(res, 200, { document });
  }

  if (pathname === "/api/integrations/status") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, getIntegrationStatus(userId));
  }

  if (pathname === "/api/compliance/status") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, getComplianceStatus(userId));
  }

  if (pathname === "/api/compliance/audit-log") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, { auditLog: readAuditLog(userId).slice(0, Number(searchParams.get("limit") || 50)) });
  }

  if (pathname === "/api/timeline") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 8)));
    return json(res, 200, { timeline: readAuditLog(userId).slice(0, limit).map(formatAuditEventForTimeline) });
  }

  if (pathname === "/api/projection-scenarios") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    const increments = String(searchParams.get("increments") || "50,100,200")
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item >= 0)
      .slice(0, 8);
    return json(res, 200, getContributionScenarios({ userId, increments: increments.length ? increments : [50, 100, 200] }));
  }

  if (pathname === "/api/explain-number") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, explainNumber(userId, searchParams.get("metric") || "monthlyGap"));
  }

  if (pathname === "/api/scheduler/status") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, schedulerStatus());
  }

  if (pathname === "/api/scheduler/run") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, await runScheduledAgent({ userId, reason: "manual_scheduler_run" }));
  }

  if (pathname === "/api/jobs/status") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, queueStatus());
  }

  if (pathname === "/api/security/sign-out-all") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    const revoked = revokeOtherSessions(userId, bearerToken(req));
    createNotification(userId, {
      source: "security",
      sourceKey: `security_sessions_revoked_${Date.now()}`,
      category: "security",
      priority: "medium",
      title: "Other sessions signed out",
      body: "All other dashboard sessions have been signed out. This session remains active.",
      linkedView: "settings"
    });
    return json(res, 200, { message: "Other sessions signed out. This session remains active.", ...revoked });
  }

  if (pathname === "/api/security/data-deletion") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    const body = await parseBody(readBody, req);
    const request = requestDataDeletion(userId, { reason: body.reason || "", requestedBy: "user" });
    createNotification(userId, {
      source: "security",
      sourceKey: request.id,
      category: "security",
      priority: "high",
      title: "Data deletion request submitted",
      body: "Your request has been recorded for review before any sensitive data is removed.",
      linkedView: "settings"
    });
    return json(res, 200, { message: "Data deletion request submitted.", request });
  }

  if (pathname === "/api/admin/deletion-requests") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, { requests: listDeletionRequests({ status: searchParams.get("status") || "all" }) });
  }

  const adminDeletionMatch = routeMatch(pathname, /^\/api\/admin\/deletion-requests\/([^/]+)$/);
  if (adminDeletionMatch) {
    if (req.method !== "PATCH") return json(res, 405, { error: "Method not allowed" });
    return json(res, 200, { request: updateDeletionRequest(adminDeletionMatch[0], await parseBody(readBody, req)) });
  }

  return false;
}
