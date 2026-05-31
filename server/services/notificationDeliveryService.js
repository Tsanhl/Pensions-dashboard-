import { isoNow } from "../utils/values.js";
import {
  newId,
  readPortfolio,
  readNotificationDeliveries,
  writeNotificationDeliveries
} from "../store/userDataStore.js";

const CHANNEL_ENV = {
  email_summary: "EMAIL_WEBHOOK_URL",
  phone_push: "PUSH_WEBHOOK_URL"
};

function deliveryProvider(channel, destination = "") {
  if (channel === "email_summary") {
    if (process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY && destination) return "emailjs";
    if (process.env.RESEND_API_KEY && destination) return "resend";
    if (process.env.SENDGRID_API_KEY && destination) return "sendgrid";
    if (process.env.EMAIL_WEBHOOK_URL) return "webhook";
    return "dry_run";
  }
  if (channel === "phone_push") return process.env.PUSH_WEBHOOK_URL ? "webhook" : "dry_run";
  return "dry_run";
}

function externalChannels(notification = {}) {
  return (notification.channels || []).filter((channel) => channel !== "in_app");
}

export function queueNotificationDelivery(userId, notification = {}) {
  const channels = externalChannels(notification);
  if (!channels.length) return [];
  const profile = readPortfolio(userId, {})?.profile || {};
  const deliveries = readNotificationDeliveries(userId);
  const existingKeys = new Set(deliveries.map((delivery) => delivery.deliveryKey));
  const queued = [];
  for (const channel of channels) {
    const deliveryKey = `${notification.id}:${channel}`;
    if (existingKeys.has(deliveryKey)) continue;
    const destination = channel === "email_summary" ? String(profile.email || "") : "";
    queued.push({
      id: newId("delivery"),
      deliveryKey,
      notificationId: notification.id,
      channel,
      provider: deliveryProvider(channel, destination),
      status: "queued",
      title: notification.title,
      body: notification.body,
      linkedView: notification.linkedView,
      destination,
      sendPolicy: notification.priority === "high" || notification.category === "security" ? "immediate" : "in_app_only",
      attempts: 0,
      createdAt: isoNow(),
      updatedAt: isoNow(),
      deliveredAt: null,
      error: ""
    });
  }
  if (queued.length) writeNotificationDeliveries(userId, [...queued, ...deliveries].slice(0, 500));
  return queued;
}

export function listNotificationDeliveries(userId, { status = "all" } = {}) {
  const deliveries = readNotificationDeliveries(userId);
  return status === "all" ? deliveries : deliveries.filter((delivery) => delivery.status === status);
}

async function postWebhook(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Webhook failed with status ${response.status}`);
}

async function sendWithResend(delivery) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Pension Plan <alerts@example.com>",
      to: [delivery.destination],
      subject: delivery.title,
      text: `${delivery.body}\n\nOpen dashboard section: ${delivery.linkedView || "overview"}`
    })
  });
  if (!response.ok) throw new Error(`Resend failed with status ${response.status}`);
}

async function sendWithSendGrid(delivery) {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: delivery.destination }] }],
      from: { email: process.env.EMAIL_FROM || "alerts@example.com", name: "Pension Plan" },
      subject: delivery.title,
      content: [{ type: "text/plain", value: `${delivery.body}\n\nOpen dashboard section: ${delivery.linkedView || "overview"}` }]
    })
  });
  if (!response.ok) throw new Error(`SendGrid failed with status ${response.status}`);
}

function deliverySubject(delivery) {
  return String(delivery.title || "Urgent pension dashboard task").trim();
}

function deliveryMessage(delivery) {
  const title = deliverySubject(delivery);
  const body = String(delivery.body || "Open the dashboard to review this urgent pension task.").trim();
  const view = String(delivery.linkedView || "overview").trim();
  return `${title}\n\n${body}\n\nOpen dashboard section: ${view}`;
}

async function sendWithEmailJs(delivery) {
  const subject = deliverySubject(delivery);
  const message = deliveryMessage(delivery);
  const payload = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    template_params: {
      to_email: delivery.destination,
      to_name: delivery.destination,
      from_name: "Pension Plan",
      from_email: process.env.EMAIL_FROM || "alerts@example.com",
      reply_to: process.env.EMAIL_REPLY_TO || delivery.destination,
      subject,
      title: subject,
      message,
      alert_title: delivery.title,
      alert_body: delivery.body,
      linked_view: delivery.linkedView || "overview"
    }
  };
  if (process.env.EMAILJS_PRIVATE_KEY) payload.accessToken = process.env.EMAILJS_PRIVATE_KEY;

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`EmailJS failed with status ${response.status}`);
}

export async function flushNotificationDeliveries(userId, { limit = 20 } = {}) {
  const deliveries = readNotificationDeliveries(userId);
  const queue = deliveries.filter((delivery) => delivery.status === "queued" || delivery.status === "retry").slice(0, limit);
  for (const delivery of queue) {
    delivery.attempts += 1;
    delivery.updatedAt = isoNow();
    const webhook = process.env[CHANNEL_ENV[delivery.channel]];
    try {
      if (delivery.provider === "resend") {
        await sendWithResend(delivery);
        delivery.status = "delivered";
        delivery.deliveredAt = isoNow();
        delivery.error = "";
      } else if (delivery.provider === "emailjs") {
        await sendWithEmailJs(delivery);
        delivery.status = "delivered";
        delivery.deliveredAt = isoNow();
        delivery.error = "";
      } else if (delivery.provider === "sendgrid") {
        await sendWithSendGrid(delivery);
        delivery.status = "delivered";
        delivery.deliveredAt = isoNow();
        delivery.error = "";
      } else if (webhook) {
        await postWebhook(webhook, { userId, delivery });
        delivery.status = "delivered";
        delivery.provider = "webhook";
        delivery.deliveredAt = isoNow();
        delivery.error = "";
      } else {
        delivery.status = "dry_run";
        delivery.provider = "dry_run";
        delivery.deliveredAt = isoNow();
        delivery.error = "No provider webhook configured";
      }
    } catch (error) {
      delivery.status = delivery.attempts >= 3 ? "failed" : "retry";
      delivery.error = error.message;
    }
  }
  writeNotificationDeliveries(userId, deliveries);
  return { processed: queue.length, deliveries: queue };
}
