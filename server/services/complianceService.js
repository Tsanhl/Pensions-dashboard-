import { dataPathsForUser, readAuditLog, readRiskProfile, storageStatus } from "../store/userDataStore.js";

export function complianceMetadata({ provider, model, usedSearch, currentSourceNote, agentSummary, riskProfile } = {}) {
  return {
    generatedAt: new Date().toISOString(),
    adviceBoundary: "planning_support_not_regulated_financial_advice",
    allowed: [
      "explain_dashboard_numbers",
      "identify_review_routes",
      "suggest_questions_for_provider_or_adviser",
      "compare_risks_and_tradeoffs",
      "flag_missing_documents_or_data",
      "suggest_candidate_allocation_review_ranges",
      "give_source_checked_legal_route_guidance"
    ],
    blocked: [
      "move_money",
      "submit_forms",
      "execute_trades",
      "choose_final_fund_or_provider",
      "give_final_tax_or_legal_conclusion",
      "claim_100_percent_legal_accuracy_without_current_sources",
      "recommend_transfer_without_guarantee_and_benefit_checks"
    ],
    model: {
      provider: provider || "local",
      model: model || "server-portfolio-linked",
      usedSearch: Boolean(usedSearch),
      currentSourceNote: currentSourceNote || ""
    },
    riskProfile: {
      status: riskProfile?.completed ? "completed" : "missing_or_incomplete",
      preferredStyle: riskProfile?.preferredStyle || ""
    },
    agent: agentSummary ? {
      version: agentSummary.agentVersion,
      status: agentSummary.status,
      nextBestAction: agentSummary.nextBestAction
    } : null
  };
}

export function getComplianceStatus(userId) {
  const riskProfile = readRiskProfile(userId);
  const auditLog = readAuditLog(userId);
  const emailJsConfigured = Boolean(process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY);
  return {
    generatedAt: new Date().toISOString(),
    status: "backend_controls_enabled",
    dataPaths: dataPathsForUser(userId),
    controls: {
      backendVerifiedPortfolioOnly: true,
      promptFilesBlockedFromPublicStaticServing: true,
      assistantReadOnly: true,
      productionAuthSwitchAvailable: true,
      sessionExpiryEnabled: true,
      twoFactorAuthAvailable: true,
      auditLogEnabled: true,
      riskProfileGateEnabled: true,
      allocationReviewRangeGuardEnabled: true,
      legalCurrentSourceGuardEnabled: true,
      documentConfirmationWorkflowEnabled: true,
      emailProviderDeliverySupported: Boolean(emailJsConfigured || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.EMAIL_WEBHOOK_URL),
      scheduledAgentRunsEnabled: String(process.env.AGENT_SCHEDULER_ENABLED || "true").toLowerCase() !== "false",
      providerKeyTestingSupported: true
    },
    productionReadiness: {
      authRequired: String(process.env.REQUIRE_AUTH || "").toLowerCase() === "true",
      twoFactorRequired: String(process.env.REQUIRE_2FA || "true").toLowerCase() !== "false",
      hostedDatabaseConfigured: Boolean(process.env.DATABASE_URL || process.env.PENSIONS_DB_PATH),
      storageMode: storageStatus().mode,
      emailProvider: emailJsConfigured ? "emailjs" : process.env.RESEND_API_KEY ? "resend" : process.env.SENDGRID_API_KEY ? "sendgrid" : process.env.EMAIL_WEBHOOK_URL ? "webhook" : "dry_run",
      externalCronRecommended: true
    },
    productionControlsStillNeeded: [
      "hosted_postgres_adapter_or_managed_database",
      "database_encryption_or_managed_encryption",
      "provider_consent_management",
      "admin_case_review_dashboard",
      "human_escalation_queue",
      "push_notification_provider"
    ],
    riskProfileStatus: riskProfile.completed ? "completed" : riskProfile.status,
    auditEvents: auditLog.length,
    latestAuditEvents: auditLog.slice(0, 10)
  };
}
