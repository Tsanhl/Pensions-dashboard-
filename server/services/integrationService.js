import { getVerifiedDashboardContext } from "../portfolioStore.js";
import { daysSince } from "../utils/values.js";

function connectionStatus(account) {
  const source = String(account.source || "");
  const staleDays = daysSince(account.lastUpdated);
  const isProviderLinked = /provider-linked|connected/i.test(source);
  const isStale = staleDays != null && staleDays >= 90;
  if (isProviderLinked && !isStale) return "connected";
  if (isProviderLinked && isStale) return "data_stale";
  if (/manual/i.test(source)) return "manual_entry";
  return "needs_review";
}

export function getIntegrationStatus(userId) {
  const dashboard = getVerifiedDashboardContext({ userId });
  return {
    generatedAt: new Date().toISOString(),
    environment: "local_product_backend",
    providerConnections: (dashboard.pensionAccounts || []).map((account) => ({
      provider: account.provider,
      accountName: account.name,
      status: connectionStatus(account),
      source: account.source,
      lastUpdated: account.lastUpdated,
      availableModes: ["manual_entry", "document_scan"],
      plannedModes: ["provider_api", "open_banking_or_pension_dashboard_ecosystem_when_available"],
      reliability: connectionStatus(account) === "connected" ? "verified_recent" : "needs_user_or_provider_confirmation"
    })),
    hmrcPayroll: {
      status: "planned",
      availableModes: [],
      plannedModes: ["secure_consent_flow", "payroll_or_hmrc_verified_contribution_check"],
      note: "No HMRC or payroll connector is active in this local build."
    },
    statePension: {
      status: dashboard.statePension?.source ? "manual_or_forecast_recorded" : "missing",
      source: dashboard.statePension?.source || "",
      lastUpdated: dashboard.statePension?.lastUpdated || "",
      plannedModes: ["government_forecast_import_when_user_supplies_verified_document_or_connector"]
    },
    secureStorage: {
      status: "local_json_demo_store",
      productionNeeded: ["database_encryption", "key_management", "consent_records", "data_retention_policy", "backups"]
    }
  };
}
