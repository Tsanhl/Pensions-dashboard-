import { isoNow } from "../utils/values.js";
import { listKnownUsers, newId, readJobs, writeJobs } from "../store/userDataStore.js";

export function addJob(userId, { type, payload = {}, status = "queued" } = {}) {
  const job = {
    id: newId("job"),
    type: type || "general",
    payload,
    status,
    createdAt: isoNow(),
    updatedAt: isoNow(),
    startedAt: null,
    completedAt: null,
    error: "",
    result: null
  };
  const jobs = readJobs(userId);
  jobs.unshift(job);
  writeJobs(userId, jobs.slice(0, 500));
  return job;
}

export function listJobs(userId, { limit = 50, status = "all" } = {}) {
  const jobs = readJobs(userId);
  const filtered = status === "all" ? jobs : jobs.filter((job) => job.status === status);
  return filtered.slice(0, limit);
}

export function getJob(userId, jobId) {
  return readJobs(userId).find((job) => job.id === jobId) || null;
}

export function updateJob(userId, jobId, patch = {}) {
  const jobs = readJobs(userId);
  const job = jobs.find((item) => item.id === jobId);
  if (!job) {
    const error = new Error("Job not found");
    error.status = 404;
    throw error;
  }
  Object.assign(job, patch, { updatedAt: isoNow() });
  writeJobs(userId, jobs);
  return job;
}

export async function runJob(userId, jobId, processor) {
  updateJob(userId, jobId, { status: "running", startedAt: isoNow(), error: "" });
  try {
    const result = await processor();
    return updateJob(userId, jobId, { status: "completed", completedAt: isoNow(), result });
  } catch (error) {
    return updateJob(userId, jobId, { status: "failed", completedAt: isoNow(), error: error.message || "Job failed" });
  }
}

export function queueStatus() {
  const jobs = listKnownUsers().flatMap((userId) => readJobs(userId).map((job) => ({ userId, ...job })));
  return {
    generatedAt: isoNow(),
    mode: "persisted_local_queue",
    queued: jobs.filter((job) => job.status === "queued").length,
    running: jobs.filter((job) => job.status === "running").length,
    completed: jobs.filter((job) => job.status === "completed").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    recentJobs: jobs
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
      .slice(0, 10),
    productionNeeded: ["external_worker_runtime", "retry_backoff_policy", "dead_letter_queue", "worker_metrics"]
  };
}
