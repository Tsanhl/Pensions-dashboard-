import { getVerifiedDashboardContext } from "../portfolioStore.js";

const EXPLANATIONS = {
  projectedMonthlyIncome: {
    label: "Projected monthly income",
    formula: "Estimated drawdown income from pension pots plus State Pension and any defined-benefit monthly amount.",
    caveat: "This is an estimate, not a guaranteed income."
  },
  monthlyGap: {
    label: "Monthly gap",
    formula: "Monthly target minus projected monthly income.",
    caveat: "The gap can change when pot values, contributions, retirement age, charges, inflation or growth assumptions change."
  },
  coverage: {
    label: "Target coverage",
    formula: "Projected monthly income divided by monthly target.",
    caveat: "Coverage is based on current assumptions and verified dashboard data."
  },
  finalPot: {
    label: "Estimated final pot",
    formula: "Current pension pots plus monthly contributions, grown using the dashboard growth, inflation and charge assumptions until retirement age.",
    caveat: "Investment returns are uncertain and charges may differ by fund or provider."
  },
  charges: {
    label: "Annual charge",
    formula: "Provider or document-stated annual charge for the pension account.",
    caveat: "Check fund factsheets and provider documents for platform, fund and transaction costs."
  },
  equityExposure: {
    label: "Equity exposure",
    formula: "Share of the current investment profile allocated to equity or growth assets.",
    caveat: "Higher equity exposure can improve long-term growth potential but increases temporary fall risk."
  },
  savingsBuffer: {
    label: "Emergency savings months",
    formula: "Current savings divided by estimated monthly expenses.",
    caveat: "The savings buffer is separate from pension investments and should be checked before taking extra investment risk."
  }
};

export function explainNumber(userId, metric) {
  const dashboard = getVerifiedDashboardContext({ userId });
  const key = EXPLANATIONS[metric] ? metric : "monthlyGap";
  const explanation = EXPLANATIONS[key];
  const values = {
    projectedMonthlyIncome: dashboard.projectedMonthlyIncome,
    monthlyGap: dashboard.monthlyGap,
    coverage: dashboard.coverage,
    finalPot: dashboard.finalPot,
    charges: dashboard.largestAccount?.charges || "",
    equityExposure: dashboard.investmentProfile?.equityExposure || "",
    savingsBuffer: dashboard.savings?.monthsCovered || ""
  };
  return {
    metric: key,
    label: explanation.label,
    value: values[key] || "not available",
    formula: explanation.formula,
    caveat: explanation.caveat,
    dataSource: dashboard.dataSource
  };
}
