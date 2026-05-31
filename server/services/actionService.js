import { isoNow } from "../utils/values.js";
import { newId, readActions, writeActions } from "../store/userDataStore.js";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function normalisePriority(priority = "medium") {
  return ["high", "medium", "low"].includes(priority) ? priority : "medium";
}

function actionFromCandidate(candidate) {
  return {
    id: newId("action"),
    source: "agent",
    sourceKey: candidate.sourceKey,
    category: candidate.category || "general",
    priority: normalisePriority(candidate.priority),
    title: candidate.title,
    detail: candidate.detail || "",
    linkedView: candidate.linkedView || "overview",
    status: "open",
    createdAt: isoNow(),
    updatedAt: isoNow(),
    dueAt: candidate.dueAt || null,
    completedAt: null
  };
}

export function sortActions(actions = []) {
  return [...actions].sort((a, b) => {
    const priority = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    if (priority) return priority;
    return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
  });
}

export function syncActionsFromAgent(userId, summary) {
  const candidates = Array.isArray(summary?.actionCandidates) ? summary.actionCandidates : [];
  const candidateKeys = new Set(candidates.map((candidate) => candidate?.sourceKey).filter(Boolean));
  const actions = readActions(userId);
  let changed = false;

  for (const candidate of candidates) {
    if (!candidate?.sourceKey || !candidate.title) continue;
    const dismissed = actions.find((action) => action.sourceKey === candidate.sourceKey && action.status === "dismissed");
    if (dismissed) continue;
    const existing = actions.find((action) => action.sourceKey === candidate.sourceKey && action.status !== "dismissed");
    if (existing) {
      const nextPriority = normalisePriority(candidate.priority);
      if (
        existing.title !== candidate.title ||
        existing.detail !== candidate.detail ||
        existing.priority !== nextPriority ||
        existing.linkedView !== candidate.linkedView
      ) {
        existing.title = candidate.title;
        existing.detail = candidate.detail || "";
        existing.priority = nextPriority;
        existing.linkedView = candidate.linkedView || existing.linkedView || "overview";
        existing.updatedAt = isoNow();
        changed = true;
      }
      continue;
    }
    actions.push(actionFromCandidate(candidate));
    changed = true;
  }

  for (const action of actions) {
    if (action.source === "agent" && action.status === "open" && action.sourceKey && !candidateKeys.has(action.sourceKey)) {
      action.status = "dismissed";
      action.updatedAt = isoNow();
      action.completedAt = action.completedAt || null;
      changed = true;
    }
  }

  return changed ? writeActions(userId, actions) : actions;
}

export function listActions(userId, { status = "open" } = {}) {
  const actions = readActions(userId);
  const filtered = status === "all" ? actions : actions.filter((action) => action.status === status);
  return sortActions(filtered);
}

export function createManualAction(userId, input = {}) {
  const actions = readActions(userId);
  const action = {
    id: newId("action"),
    source: "manual",
    sourceKey: input.sourceKey || null,
    category: input.category || "manual",
    priority: normalisePriority(input.priority || "medium"),
    title: String(input.title || "").trim(),
    detail: String(input.detail || "").trim(),
    linkedView: input.linkedView || "overview",
    status: "open",
    createdAt: isoNow(),
    updatedAt: isoNow(),
    dueAt: input.dueAt || null,
    completedAt: null
  };
  if (!action.title) throw new Error("Action title is required");
  actions.push(action);
  writeActions(userId, actions);
  return action;
}

export function updateAction(userId, actionId, patch = {}) {
  const actions = readActions(userId);
  const action = actions.find((item) => item.id === actionId);
  if (!action) {
    const error = new Error("Action not found");
    error.status = 404;
    throw error;
  }
  if (patch.title != null) action.title = String(patch.title).trim() || action.title;
  if (patch.detail != null) action.detail = String(patch.detail).trim();
  if (patch.priority != null) action.priority = normalisePriority(patch.priority);
  if (patch.linkedView != null) action.linkedView = String(patch.linkedView || "overview");
  if (patch.dueAt !== undefined) action.dueAt = patch.dueAt || null;
  if (patch.status != null) {
    const nextStatus = String(patch.status);
    if (!["open", "done", "dismissed"].includes(nextStatus)) throw new Error("Unsupported action status");
    action.status = nextStatus;
    action.completedAt = nextStatus === "done" ? isoNow() : null;
  }
  action.updatedAt = isoNow();
  writeActions(userId, actions);
  return action;
}
