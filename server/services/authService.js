import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { isoNow } from "../utils/values.js";
import {
  appendAuditEvent,
  listKnownUsers,
  newId,
  readMfaChallenges,
  readSessions,
  writeMfaChallenges,
  writeSessions
} from "../store/userDataStore.js";

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 8);
const MFA_TTL_MS = Number(process.env.MFA_TTL_MS || 1000 * 60 * 10);

function sha256(value = "") {
  return createHash("sha256").update(String(value)).digest("hex");
}

function token() {
  return randomBytes(32).toString("base64url");
}

function expiresAt(ms) {
  return new Date(Date.now() + ms).toISOString();
}

function notExpired(value) {
  return !value || Date.parse(value) > Date.now();
}

function safeEqual(a = "", b = "") {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSession(userId, { email = "", userAgent = "", ip = "", mfaVerified = false } = {}) {
  const rawToken = token();
  const sessions = readSessions(userId).filter((session) => session.status === "active" && notExpired(session.expiresAt));
  const session = {
    id: newId("session"),
    tokenHash: sha256(rawToken),
    email: String(email || "").trim(),
    userAgent: String(userAgent || "").slice(0, 240),
    ip: String(ip || "").slice(0, 80),
    status: "active",
    mfaVerified,
    createdAt: isoNow(),
    updatedAt: isoNow(),
    expiresAt: expiresAt(SESSION_TTL_MS)
  };
  sessions.unshift(session);
  writeSessions(userId, sessions.slice(0, 25));
  appendAuditEvent(userId, { type: "session_created", sessionId: session.id, mfaVerified });
  return { session: publicSession(session), sessionToken: rawToken };
}

export function publicSession(session = {}) {
  const { tokenHash, ...safe } = session;
  return safe;
}

export function listSessions(userId) {
  return readSessions(userId).filter((session) => session.status === "active" && notExpired(session.expiresAt)).map(publicSession);
}

export function getSession(userId, rawToken = "") {
  const hash = sha256(rawToken || "");
  const session = readSessions(userId).find((item) => item.status === "active" && notExpired(item.expiresAt) && safeEqual(item.tokenHash, hash));
  return session ? publicSession(session) : null;
}

export function findSessionByToken(rawToken = "") {
  if (!rawToken) return null;
  for (const userId of listKnownUsers()) {
    const session = getSession(userId, rawToken);
    if (session) return { userId, session };
  }
  return null;
}

export function revokeSession(userId, rawToken = "") {
  const hash = sha256(rawToken || "");
  const sessions = readSessions(userId);
  let revoked = 0;
  for (const session of sessions) {
    if (session.status === "active" && safeEqual(session.tokenHash, hash)) {
      session.status = "revoked";
      session.updatedAt = isoNow();
      revoked += 1;
    }
  }
  writeSessions(userId, sessions);
  if (revoked) appendAuditEvent(userId, { type: "session_revoked", revoked });
  return { revoked };
}

export function revokeOtherSessions(userId, rawToken = "") {
  const keepHash = rawToken ? sha256(rawToken) : "";
  const sessions = readSessions(userId);
  let revoked = 0;
  for (const session of sessions) {
    if (session.status !== "active") continue;
    if (keepHash && safeEqual(session.tokenHash, keepHash)) continue;
    session.status = "revoked";
    session.updatedAt = isoNow();
    revoked += 1;
  }
  writeSessions(userId, sessions);
  appendAuditEvent(userId, { type: "security_sessions_revoked", revoked });
  return { revoked };
}

export function startMfaChallenge(userId, { channel = "app", purpose = "login" } = {}) {
  const code = String(randomInt(100000, 1000000));
  const challenge = {
    id: newId("mfa"),
    codeHash: sha256(code),
    channel,
    purpose,
    status: "pending",
    createdAt: isoNow(),
    updatedAt: isoNow(),
    expiresAt: expiresAt(MFA_TTL_MS),
    attempts: 0
  };
  const challenges = readMfaChallenges(userId).filter((item) => item.status === "pending" && notExpired(item.expiresAt));
  challenges.unshift(challenge);
  writeMfaChallenges(userId, challenges.slice(0, 10));
  appendAuditEvent(userId, { type: "mfa_challenge_created", challengeId: challenge.id, channel, purpose });
  return {
    challengeId: challenge.id,
    channel,
    expiresAt: challenge.expiresAt,
    demoCode: process.env.NODE_ENV === "production" ? undefined : code
  };
}

export function verifyMfaChallenge(userId, { challengeId = "", code = "", sessionToken = "" } = {}) {
  const challenges = readMfaChallenges(userId);
  const challenge = challenges.find((item) => item.id === challengeId);
  if (!challenge || challenge.status !== "pending" || !notExpired(challenge.expiresAt)) {
    const error = new Error("2FA challenge expired or not found");
    error.status = 400;
    throw error;
  }
  challenge.attempts += 1;
  if (!safeEqual(challenge.codeHash, sha256(code))) {
    challenge.updatedAt = isoNow();
    if (challenge.attempts >= 5) challenge.status = "locked";
    writeMfaChallenges(userId, challenges);
    const error = new Error("Invalid 2FA code");
    error.status = 400;
    throw error;
  }
  challenge.status = "verified";
  challenge.updatedAt = isoNow();
  writeMfaChallenges(userId, challenges);

  const hash = sha256(sessionToken || "");
  const sessions = readSessions(userId);
  const session = sessions.find((item) => item.status === "active" && notExpired(item.expiresAt) && safeEqual(item.tokenHash, hash));
  if (session) {
    session.mfaVerified = true;
    session.updatedAt = isoNow();
    writeSessions(userId, sessions);
  }
  appendAuditEvent(userId, { type: "mfa_challenge_verified", challengeId: challenge.id, sessionId: session?.id || null });
  return { verified: true, session: session ? publicSession(session) : null };
}
