import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { clone, isoNow, normaliseStyle, slugify } from "../utils/values.js";

const DATA_ROOT = fileURLToPath(new URL("../../data/", import.meta.url));
const USERS_ROOT = fileURLToPath(new URL("../../data/users/", import.meta.url));
const STORAGE_MODE = String(process.env.PENSIONS_STORAGE || (process.env.DATABASE_URL ? "postgres" : "sqlite")).trim().toLowerCase();
const SQLITE_DB_PATH = process.env.PENSIONS_DB_PATH || join(DATA_ROOT, "pensions-dashboard.sqlite");
const require = createRequire(import.meta.url);
let DatabaseSync = null;
let sqliteDb = null;
let postgresClient = null;
let postgresReady = false;
let postgresCache = new Map();
let postgresWriteQueue = Promise.resolve();

const DEFAULT_RISK_PROFILE = {
  status: "not_started",
  completed: false,
  preferredStyle: "",
  timeHorizonYears: null,
  lossTolerancePct: null,
  mainGoal: "",
  mustCheckItems: [],
  answers: {},
  updatedAt: null
};

const DEFAULT_NOTIFICATION_PREFERENCES = {
  actionNeeded: "immediate",
  documentReview: "immediate",
  projectionUpdates: "weekly",
  investmentReview: "immediate",
  annualReview: "weekly",
  emailSummary: "weekly",
  phonePush: "off",
  inApp: true
};

export function userIdFromRequest(userId = "alex-morgan") {
  return slugify(userId || "alex-morgan");
}

function userDir(userId) {
  return join(USERS_ROOT, userIdFromRequest(userId));
}

function fileFor(userId, name) {
  return join(userDir(userId), name);
}

function ensureParent(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function readJson(filePath, fallback) {
  if (usesPostgresStore()) return readPostgresJson(filePath, fallback);
  if (usesSqliteStore()) return readSqliteJson(filePath, fallback);
  ensureParent(filePath);
  if (!existsSync(filePath)) {
    writeJson(filePath, fallback);
    return clone(fallback);
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    const backupPath = `${filePath}.invalid-${Date.now()}`;
    try {
      writeFileSync(backupPath, readFileSync(filePath));
    } catch {}
    writeJson(filePath, fallback);
    return clone(fallback);
  }
}

function writeJson(filePath, value) {
  if (usesPostgresStore()) {
    writePostgresJson(filePath, value);
    return;
  }
  if (usesSqliteStore()) {
    writeSqliteJson(filePath, value);
    return;
  }
  ensureParent(filePath);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function usesSqliteStore() {
  return STORAGE_MODE !== "json" && STORAGE_MODE !== "postgres" && STORAGE_MODE !== "postgresql";
}

function usesPostgresStore() {
  return STORAGE_MODE === "postgres" || STORAGE_MODE === "postgresql";
}

function db() {
  if (sqliteDb) return sqliteDb;
  if (!DatabaseSync) ({ DatabaseSync } = require("node:sqlite"));
  mkdirSync(dirname(SQLITE_DB_PATH), { recursive: true });
  sqliteDb = new DatabaseSync(SQLITE_DB_PATH);
  sqliteDb.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS user_records (
      user_id TEXT NOT NULL,
      record_name TEXT NOT NULL,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, record_name)
    );
    CREATE INDEX IF NOT EXISTS idx_user_records_user ON user_records(user_id);
  `);
  return sqliteDb;
}

function recordParts(filePath) {
  const rel = relative(USERS_ROOT, filePath);
  if (!rel.startsWith("..")) {
    const [userId, ...rest] = rel.split(/[\\/]+/);
    return { userId: userIdFromRequest(userId), recordName: rest.join("/") || "record.json" };
  }
  return { userId: "_global", recordName: filePath };
}

function readLegacyJsonFile(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readSqliteJson(filePath, fallback) {
  const { userId, recordName } = recordParts(filePath);
  const row = db().prepare("SELECT json FROM user_records WHERE user_id = ? AND record_name = ?").get(userId, recordName);
  if (row?.json) {
    try {
      return JSON.parse(row.json);
    } catch {
      db().prepare("DELETE FROM user_records WHERE user_id = ? AND record_name = ?").run(userId, recordName);
    }
  }
  try {
    const legacy = readLegacyJsonFile(filePath);
    if (legacy != null) {
      writeSqliteJson(filePath, legacy);
      return clone(legacy);
    }
  } catch {}
  writeSqliteJson(filePath, fallback);
  return clone(fallback);
}

function writeSqliteJson(filePath, value) {
  const { userId, recordName } = recordParts(filePath);
  db().prepare(`
    INSERT INTO user_records (user_id, record_name, json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, record_name)
    DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at
  `).run(userId, recordName, JSON.stringify(value, null, 2), isoNow());
}

function postgresKey(userId, recordName) {
  return `${userId}\u0000${recordName}`;
}

function assertPostgresReady() {
  if (!postgresReady || !postgresClient) {
    throw new Error("Postgres storage is enabled but not initialised. Call initialiseDataStore() before reading data.");
  }
}

function readPostgresJson(filePath, fallback) {
  assertPostgresReady();
  const { userId, recordName } = recordParts(filePath);
  const key = postgresKey(userId, recordName);
  if (postgresCache.has(key)) return clone(postgresCache.get(key));
  try {
    const legacy = readLegacyJsonFile(filePath);
    if (legacy != null) {
      writePostgresJson(filePath, legacy);
      return clone(legacy);
    }
  } catch {}
  writePostgresJson(filePath, fallback);
  return clone(fallback);
}

function writePostgresJson(filePath, value) {
  assertPostgresReady();
  const { userId, recordName } = recordParts(filePath);
  const key = postgresKey(userId, recordName);
  const jsonValue = clone(value);
  postgresCache.set(key, jsonValue);
  const payload = JSON.stringify(jsonValue);
  postgresWriteQueue = postgresWriteQueue.then(() => postgresClient.query(
    `INSERT INTO user_records (user_id, record_name, json, updated_at)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (user_id, record_name)
     DO UPDATE SET json = EXCLUDED.json, updated_at = EXCLUDED.updated_at`,
    [userId, recordName, payload, isoNow()]
  )).catch((error) => {
    console.error("Postgres write failed:", error.message);
  });
}

export async function initialiseDataStore() {
  if (!usesPostgresStore()) {
    if (usesSqliteStore()) db();
    return storageStatus();
  }
  if (postgresReady) return storageStatus();
  if (!process.env.DATABASE_URL) {
    throw new Error("PENSIONS_STORAGE=postgres requires DATABASE_URL.");
  }
  const { Client } = await import("pg");
  postgresClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: String(process.env.POSTGRES_SSL || "true").toLowerCase() === "false" ? false : { rejectUnauthorized: false }
  });
  await postgresClient.connect();
  await postgresClient.query(`
    CREATE TABLE IF NOT EXISTS user_records (
      user_id TEXT NOT NULL,
      record_name TEXT NOT NULL,
      json JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (user_id, record_name)
    );
    CREATE INDEX IF NOT EXISTS idx_user_records_user ON user_records(user_id);
  `);
  const rows = await postgresClient.query("SELECT user_id, record_name, json FROM user_records");
  postgresCache = new Map(rows.rows.map((row) => [postgresKey(row.user_id, row.record_name), row.json]));
  postgresReady = true;
  return storageStatus();
}

export async function flushDataStore() {
  if (!usesPostgresStore()) return;
  await postgresWriteQueue;
}

function withUpdatedAt(value) {
  return { ...value, updatedAt: isoNow() };
}

export function newId(prefix = "item") {
  return `${prefix}_${randomUUID()}`;
}

export function readPortfolio(userId, seedPortfolio = {}) {
  return readJson(fileFor(userId, "portfolio.json"), seedPortfolio);
}

export function writePortfolio(userId, portfolio) {
  const next = { ...clone(portfolio), updatedAt: isoNow() };
  writeJson(fileFor(userId, "portfolio.json"), next);
  return clone(next);
}

export function readRiskProfile(userId) {
  return {
    ...DEFAULT_RISK_PROFILE,
    ...readJson(fileFor(userId, "risk-profile.json"), DEFAULT_RISK_PROFILE)
  };
}

export function writeRiskProfile(userId, profile = {}) {
  const preferredStyle = normaliseStyle(profile.preferredStyle || profile.style || profile.riskProfile || "");
  const mustCheckItems = Array.isArray(profile.mustCheckItems)
    ? profile.mustCheckItems.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
    : String(profile.mustCheckItems || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  const next = withUpdatedAt({
    ...DEFAULT_RISK_PROFILE,
    ...profile,
    preferredStyle,
    timeHorizonYears: profile.timeHorizonYears == null ? null : Number(profile.timeHorizonYears),
    lossTolerancePct: profile.lossTolerancePct == null ? null : Number(profile.lossTolerancePct),
    mainGoal: String(profile.mainGoal || "").trim(),
    mustCheckItems,
    completed: Boolean(preferredStyle && profile.timeHorizonYears != null && profile.lossTolerancePct != null && profile.mainGoal),
    status: preferredStyle && profile.timeHorizonYears != null && profile.lossTolerancePct != null && profile.mainGoal ? "completed" : "incomplete"
  });
  writeJson(fileFor(userId, "risk-profile.json"), next);
  return clone(next);
}

export function readActions(userId) {
  return readJson(fileFor(userId, "actions.json"), []);
}

export function writeActions(userId, actions = []) {
  writeJson(fileFor(userId, "actions.json"), actions);
  return clone(actions);
}

export function readNotifications(userId) {
  return readJson(fileFor(userId, "notifications.json"), []);
}

export function writeNotifications(userId, notifications = []) {
  writeJson(fileFor(userId, "notifications.json"), notifications);
  return clone(notifications);
}

export function readNotificationPreferences(userId) {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...readJson(fileFor(userId, "notification-preferences.json"), DEFAULT_NOTIFICATION_PREFERENCES)
  };
}

export function writeNotificationPreferences(userId, preferences = {}) {
  const allowedCadences = new Set(["immediate", "daily", "weekly", "off"]);
  const current = readNotificationPreferences(userId);
  const next = { ...current, ...preferences };
  for (const key of ["actionNeeded", "documentReview", "projectionUpdates", "investmentReview", "annualReview", "emailSummary", "phonePush"]) {
    if (!allowedCadences.has(next[key])) next[key] = current[key] || "off";
  }
  next.inApp = next.inApp !== false;
  writeJson(fileFor(userId, "notification-preferences.json"), next);
  return clone(next);
}

export function readAuditLog(userId) {
  return readJson(fileFor(userId, "audit-log.json"), []);
}

export function appendAuditEvent(userId, event = {}) {
  const auditLog = readAuditLog(userId);
  const entry = {
    id: newId("audit"),
    occurredAt: isoNow(),
    actor: "backend",
    ...event
  };
  auditLog.unshift(entry);
  writeJson(fileFor(userId, "audit-log.json"), auditLog.slice(0, 500));
  return clone(entry);
}

export function dataPathsForUser(userId) {
  const safeUserId = userIdFromRequest(userId);
  return {
    userId: safeUserId,
    storageMode: usesPostgresStore() ? "postgres" : usesSqliteStore() ? "sqlite" : "json",
    postgresConfigured: usesPostgresStore() ? Boolean(process.env.DATABASE_URL) : false,
    sqliteDatabase: usesSqliteStore() ? SQLITE_DB_PATH : null,
    directory: userDir(safeUserId),
    portfolio: fileFor(safeUserId, "portfolio.json"),
    riskProfile: fileFor(safeUserId, "risk-profile.json"),
    actions: fileFor(safeUserId, "actions.json"),
    notifications: fileFor(safeUserId, "notifications.json"),
    notificationPreferences: fileFor(safeUserId, "notification-preferences.json"),
    auditLog: fileFor(safeUserId, "audit-log.json")
  };
}

export function readSessions(userId) {
  return readJson(fileFor(userId, "sessions.json"), []);
}

export function writeSessions(userId, sessions = []) {
  writeJson(fileFor(userId, "sessions.json"), sessions);
  return clone(sessions);
}

export function readMfaChallenges(userId) {
  return readJson(fileFor(userId, "mfa-challenges.json"), []);
}

export function writeMfaChallenges(userId, challenges = []) {
  writeJson(fileFor(userId, "mfa-challenges.json"), challenges);
  return clone(challenges);
}

export function readDeletionRequests(userId) {
  return readJson(fileFor(userId, "deletion-requests.json"), []);
}

export function writeDeletionRequests(userId, requests = []) {
  writeJson(fileFor(userId, "deletion-requests.json"), requests);
  return clone(requests);
}

export function readNotificationDeliveries(userId) {
  return readJson(fileFor(userId, "notification-deliveries.json"), []);
}

export function writeNotificationDeliveries(userId, deliveries = []) {
  writeJson(fileFor(userId, "notification-deliveries.json"), deliveries);
  return clone(deliveries);
}

export function readSchedulerRuns(userId) {
  return readJson(fileFor(userId, "scheduler-runs.json"), []);
}

export function writeSchedulerRuns(userId, runs = []) {
  writeJson(fileFor(userId, "scheduler-runs.json"), runs);
  return clone(runs);
}

export function listKnownUsers() {
  const users = new Set();
  if (usesPostgresStore()) {
    for (const key of postgresCache.keys()) {
      const userId = key.split("\u0000")[0];
      if (userId && !userId.startsWith("_")) users.add(userId);
    }
  }
  if (usesSqliteStore()) {
    try {
      for (const row of db().prepare("SELECT DISTINCT user_id FROM user_records WHERE user_id NOT LIKE '\\_%' ESCAPE '\\'").all()) {
        if (row.user_id) users.add(row.user_id);
      }
    } catch {}
  }
  try {
    for (const entry of readdirSync(USERS_ROOT, { withFileTypes: true })) {
      if (entry.isDirectory()) users.add(userIdFromRequest(entry.name));
    }
  } catch {}
  if (!users.size) users.add("alex-morgan");
  return [...users].sort();
}

export function storageStatus() {
  return {
    mode: usesPostgresStore() ? "postgres" : usesSqliteStore() ? "sqlite" : "json",
    postgresConfigured: usesPostgresStore() ? Boolean(process.env.DATABASE_URL) : false,
    postgresReady: usesPostgresStore() ? postgresReady : false,
    sqliteDatabase: usesSqliteStore() ? SQLITE_DB_PATH : null,
    knownUsers: listKnownUsers()
  };
}
