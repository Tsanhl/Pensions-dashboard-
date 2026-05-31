import { isoNow } from "../utils/values.js";
import { newId } from "../store/userDataStore.js";

const jobs = [];

export function addJob({ type, payload = {}, status = "queued" } = {}) {
  const job = {
    id: newId("job"),
    type: type || "general",
    payload,
    status,
    createdAt: isoNow(),
    updatedAt: isoNow()
  };
  jobs.unshift(job);
  return job;
}

export function listJobs({ limit = 50 } = {}) {
  return jobs.slice(0, limit);
}

export function queueStatus() {
  return {
    generatedAt: isoNow(),
    mode: "in_memory_local_queue",
    queued: jobs.filter((job) => job.status === "queued").length,
    running: jobs.filter((job) => job.status === "running").length,
    completed: jobs.filter((job) => job.status === "completed").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    recentJobs: listJobs({ limit: 10 }),
    productionNeeded: ["durable_queue", "retry_policy", "dead_letter_queue", "worker_metrics"]
  };
}
