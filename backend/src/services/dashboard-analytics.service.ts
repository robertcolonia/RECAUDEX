export type DashboardInvoiceDatum = {
  issuedAt: Date;
  dueAt: Date | null;
  totalAmount: number;
  openAmount: number;
};

export type DashboardPaymentDatum = {
  paidAt: Date;
  amount: number;
  status: string;
  caseStatus?: string;
};

export type DashboardAuditDatum = { detail: unknown };

const agentCodes = ["A0", "A1", "A2", "A3", "A4", "A5"] as const;

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthSequence(end: Date, length: number) {
  return Array.from({ length }, (_, index) => {
    const offset = index - length + 1;
    return monthKey(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + offset, 1)));
  });
}

function add(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function latestDate(invoices: DashboardInvoiceDatum[], payments: DashboardPaymentDatum[], fallback: Date) {
  const timestamps = [
    ...invoices.map((item) => item.issuedAt.getTime()),
    ...payments.map((item) => item.paidAt.getTime())
  ].filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)) : fallback;
}

function paymentState(payment: DashboardPaymentDatum) {
  if (payment.status === "APPLIED" || payment.caseStatus === "SETTLED") return "applied";
  if (payment.caseStatus === "APPROVED") return "approved";
  if (payment.caseStatus === "PENDING_APPROVAL") return "pendingApproval";
  if (payment.caseStatus) return "proposed";
  if (payment.status === "UNMATCHED") return "unmatched";
  return "exception";
}

function detailAgentCode(detail: unknown) {
  if (!detail || typeof detail !== "object" || !("agentCode" in detail)) return undefined;
  const code = String((detail as { agentCode?: unknown }).agentCode ?? "").toUpperCase();
  return agentCodes.find((candidate) => candidate === code);
}

export function buildDashboardAnalytics(
  invoices: DashboardInvoiceDatum[],
  payments: DashboardPaymentDatum[],
  audits: DashboardAuditDatum[],
  now = new Date()
) {
  const end = latestDate(invoices, payments, now);
  const months = monthSequence(end, 8);
  const billedByMonth = new Map<string, number>();
  const collectedByMonth = new Map<string, number>();
  const portfolioByMonth = new Map<string, number>();

  for (const invoice of invoices) {
    const key = monthKey(invoice.issuedAt);
    add(billedByMonth, key, invoice.totalAmount);
    add(portfolioByMonth, key, invoice.openAmount);
  }
  for (const payment of payments) add(collectedByMonth, monthKey(payment.paidAt), payment.amount);

  const paymentCounts = new Map<string, number>();
  for (const payment of payments) add(paymentCounts, paymentState(payment), 1);

  const aging = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
  const currentTime = now.getTime();
  for (const invoice of invoices) {
    if (!invoice.dueAt || invoice.dueAt.getTime() >= currentTime) aging.current += invoice.openAmount;
    else {
      const days = Math.floor((currentTime - invoice.dueAt.getTime()) / 86_400_000);
      if (days <= 30) aging.days1to30 += invoice.openAmount;
      else if (days <= 60) aging.days31to60 += invoice.openAmount;
      else if (days <= 90) aging.days61to90 += invoice.openAmount;
      else aging.over90 += invoice.openAmount;
    }
  }

  const activity = new Map<string, number>(agentCodes.map((code) => [code, 0]));
  for (const audit of audits) {
    const code = detailAgentCode(audit.detail);
    if (code) add(activity, code, 1);
  }

  return {
    monthlyRevenue: months.map((month) => ({
      month,
      billed: round(billedByMonth.get(month) ?? 0),
      collected: round(collectedByMonth.get(month) ?? 0)
    })),
    paymentStatus: [
      { key: "unmatched", label: "Sin conciliar", value: paymentCounts.get("unmatched") ?? 0 },
      { key: "proposed", label: "Propuesto", value: paymentCounts.get("proposed") ?? 0 },
      { key: "pendingApproval", label: "Por aprobar", value: paymentCounts.get("pendingApproval") ?? 0 },
      { key: "approved", label: "Aprobado", value: paymentCounts.get("approved") ?? 0 },
      { key: "applied", label: "Aplicado", value: paymentCounts.get("applied") ?? 0 },
      { key: "exception", label: "Excepción", value: paymentCounts.get("exception") ?? 0 }
    ],
    portfolioEvolution: months.map((month) => ({ month, amount: round(portfolioByMonth.get(month) ?? 0) })),
    aging: [
      { key: "current", label: "Por vencer", amount: round(aging.current) },
      { key: "days1to30", label: "1–30", amount: round(aging.days1to30) },
      { key: "days31to60", label: "31–60", amount: round(aging.days31to60) },
      { key: "days61to90", label: "61–90", amount: round(aging.days61to90) },
      { key: "over90", label: "90+", amount: round(aging.over90) }
    ],
    agentActivity: agentCodes.map((code) => ({ agent: code, cases: activity.get(code) ?? 0 }))
  };
}
