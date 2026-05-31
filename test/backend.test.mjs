import test from "node:test";
import assert from "node:assert/strict";
import { buildAgentSummaryForDashboard } from "../server/services/agentService.js";
import { escalateActionsForAssistantQuestion, syncActionsFromAgent } from "../server/services/actionService.js";
import { createSession, getSession, startMfaChallenge, verifyMfaChallenge } from "../server/services/authService.js";
import { complianceMetadata } from "../server/services/complianceService.js";
import { requestDataDeletion, listDeletionRequests, updateDeletionRequest } from "../server/services/adminWorkflowService.js";
import { createNotification, listNotifications } from "../server/services/notificationService.js";
import { flushNotificationDeliveries, listNotificationDeliveries } from "../server/services/notificationDeliveryService.js";
import { readActions, storageStatus, writeActions } from "../server/store/userDataStore.js";
import { validateRiskProfileInput } from "../server/utils/validation.js";

const dashboard = {
  monthlyGap: "£804",
  monthlyTarget: "£2,500",
  projectedMonthlyIncome: "£1,696",
  pensionPotValue: "£123,450",
  investmentProfile: {
    currentStyle: "Balanced",
    equityExposure: "62%",
    bondExposure: "28%",
    cashOther: "10%"
  },
  dataQuality: { reviewDocs: 1, highCharge: 1 },
  pensionAccounts: [
    { provider: "Aviva", source: "Provider-linked", charges: "0.45%", lastUpdated: "12 May 2026" },
    { provider: "OneLife", source: "Manual entry", charges: "0.80%", lastUpdated: "18 Apr 2026" }
  ],
  documents: [
    { name: "Aviva statement", status: "Checked" },
    { name: "OneLife policy", status: "Review" }
  ],
  statePension: { lastUpdated: "12 May 2026" }
};

test("agent returns next best action and assistant context", () => {
  const summary = buildAgentSummaryForDashboard({
    dashboard,
    riskProfile: { completed: false },
    existingActions: []
  });
  assert.equal(summary.status, "action_needed");
  assert.equal(summary.nextBestAction.priority, "high");
  assert.match(summary.assistantContext.summary, /Current investment style: Balanced/);
  assert.match(summary.assistantContext.summary, /Risk profile: missing/);
  assert.ok(summary.actionCandidates.some((action) => action.sourceKey === "document_review_required"));
  assert.ok(!summary.actionCandidates.some((action) => action.sourceKey === "risk_profile_missing"));
});

test("compliance metadata keeps advice boundary explicit", () => {
  const meta = complianceMetadata({
    provider: "groq",
    model: "groq/compound-mini",
    usedSearch: true,
    riskProfile: { completed: true, preferredStyle: "balanced" }
  });
  assert.equal(meta.adviceBoundary, "planning_support_not_regulated_financial_advice");
  assert.ok(meta.blocked.includes("move_money"));
  assert.equal(meta.model.provider, "groq");
});

test("risk profile validation normalises accepted values and rejects bad numbers", () => {
  const valid = validateRiskProfileInput({
    preferredStyle: "growth",
    timeHorizonYears: 12,
    lossTolerancePct: 20,
    mainGoal: "Close the monthly gap"
  });
  assert.equal(valid.preferredStyle, "growth");
  assert.equal(valid.lossTolerancePct, 20);
  assert.throws(() => validateRiskProfileInput({ preferredStyle: "balanced", timeHorizonYears: 90 }), /outside the allowed range/);
});

test("SQLite-backed auth session and 2FA flow works", () => {
  const userId = `test-auth-${Date.now()}`;
  const { session, sessionToken } = createSession(userId, { email: "test@example.com" });
  assert.equal(session.status, "active");
  assert.equal(getSession(userId, sessionToken).id, session.id);
  const challenge = startMfaChallenge(userId, { channel: "app" });
  assert.ok(challenge.challengeId);
  assert.ok(challenge.demoCode);
  const verified = verifyMfaChallenge(userId, { challengeId: challenge.challengeId, code: challenge.demoCode, sessionToken });
  assert.equal(verified.verified, true);
  assert.equal(getSession(userId, sessionToken).mfaVerified, true);
  assert.equal(storageStatus().mode, "sqlite");
});

test("data deletion request uses admin workflow", () => {
  const userId = `test-delete-${Date.now()}`;
  const request = requestDataDeletion(userId, { reason: "test" });
  assert.equal(request.status, "pending");
  assert.ok(listDeletionRequests({ status: "pending" }).some((item) => item.id === request.id));
  const reviewed = updateDeletionRequest(request.id, { status: "approved", adminNote: "approved in test" });
  assert.equal(reviewed.status, "approved");
});

test("notification provider queues and dry-runs external delivery", async () => {
  const userId = `test-delivery-${Date.now()}`;
  const mediumNotification = createNotification(userId, {
    title: "Medium alert",
    body: "In-app only queue test",
    linkedView: "actions",
    priority: "medium"
  });
  assert.ok(!mediumNotification.channels.includes("email_summary"));
  const notification = createNotification(userId, {
    title: "High alert",
    body: "External delivery queue test",
    linkedView: "actions",
    priority: "high"
  });
  assert.ok(notification.channels.includes("email_summary"));
  assert.ok(listNotificationDeliveries(userId, { status: "queued" }).length >= 1);
  const result = await flushNotificationDeliveries(userId);
  assert.ok(result.processed >= 1);
  assert.ok(listNotificationDeliveries(userId, { status: "dry_run" }).length >= 1);
});

test("open actions escalate by age and dependent assistant questions", () => {
  const userId = `test-escalation-${Date.now()}`;
  const oldDate = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
  writeActions(userId, [
    {
      id: "low-action",
      source: "agent",
      sourceKey: "dashboard_checked",
      category: "overview",
      priority: "low",
      basePriority: "low",
      title: "Low priority review",
      detail: "General review item.",
      linkedView: "overview",
      status: "open",
      createdAt: oldDate(91),
      updatedAt: oldDate(91),
      dueAt: null,
      completedAt: null
    },
    {
      id: "medium-action",
      source: "agent",
      sourceKey: "high_charge_account",
      category: "charges",
      priority: "medium",
      basePriority: "medium",
      title: "Charge to check",
      detail: "Review charge before changing funds.",
      linkedView: "pensions",
      status: "open",
      createdAt: oldDate(31),
      updatedAt: oldDate(31),
      dueAt: null,
      completedAt: null
    },
    {
      id: "fresh-medium",
      source: "agent",
      sourceKey: "manual_account_review",
      category: "data_quality",
      priority: "medium",
      basePriority: "medium",
      title: "Manual account review",
      detail: "Manual account should be verified.",
      linkedView: "pensions",
      status: "open",
      createdAt: oldDate(1),
      updatedAt: oldDate(1),
      dueAt: null,
      completedAt: null
    },
    {
      id: "very-old-low",
      source: "agent",
      sourceKey: "very_old_dashboard_review",
      category: "overview",
      priority: "low",
      basePriority: "low",
      title: "Very old review",
      detail: "This low-priority item has stayed open too long.",
      linkedView: "overview",
      status: "open",
      createdAt: oldDate(121),
      updatedAt: oldDate(121),
      dueAt: null,
      completedAt: null
    }
  ]);

  syncActionsFromAgent(userId, { actionCandidates: [
    { sourceKey: "dashboard_checked", category: "overview", priority: "low", title: "Low priority review", detail: "General review item.", linkedView: "overview" },
    { sourceKey: "high_charge_account", category: "charges", priority: "medium", title: "Charge to check", detail: "Review charge before changing funds.", linkedView: "pensions" },
    { sourceKey: "manual_account_review", category: "data_quality", priority: "medium", title: "Manual account review", detail: "Manual account should be verified.", linkedView: "pensions" },
    { sourceKey: "very_old_dashboard_review", category: "overview", priority: "low", title: "Very old review", detail: "This low-priority item has stayed open too long.", linkedView: "overview" }
  ] });

  let actions = readActions(userId);
  assert.equal(actions.find((action) => action.id === "low-action").priority, "medium");
  assert.equal(actions.find((action) => action.id === "medium-action").priority, "high");
  assert.equal(actions.find((action) => action.id === "fresh-medium").priority, "medium");
  assert.equal(actions.find((action) => action.id === "very-old-low").priority, "high");

  const escalated = escalateActionsForAssistantQuestion(userId, "Should I transfer or change investment funds using this manual account data?");
  assert.ok(escalated.some((action) => action.id === "fresh-medium"));
  actions = readActions(userId);
  assert.equal(actions.find((action) => action.id === "fresh-medium").priority, "high");
  assert.ok(listNotifications(userId, { status: "all" }).some((notification) => notification.source === "action_escalation" && notification.priority === "high"));
  assert.ok(listNotificationDeliveries(userId, { status: "queued" }).some((delivery) => delivery.channel === "email_summary"));
});
