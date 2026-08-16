import type { MatchCandidate } from "../types.js";

export type MatchPayment = {
  amount: number;
  paidAt: Date;
  customerId?: string | null;
  accountCode?: string | null;
  declaredInvoice?: string | null;
};

export type MatchInvoice = {
  id: string;
  externalId: string;
  customerId: string;
  accountCode?: string | null;
  issuedAt: Date;
  dueAt?: Date | null;
  totalAmount: number;
  openAmount: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

export function scoreCandidate(payment: MatchPayment, invoice: MatchInvoice): MatchCandidate {
  let score = 0;
  const signals: string[] = [];
  const amountDelta = Math.abs(payment.amount - invoice.openAmount);

  if (payment.declaredInvoice && payment.declaredInvoice === invoice.externalId) {
    score += 0.55;
    signals.push("referencia de factura exacta");
  }
  if (payment.customerId && payment.customerId === invoice.customerId) {
    score += 0.15;
    signals.push("cliente coincidente");
  }
  if (payment.accountCode && payment.accountCode === invoice.accountCode) {
    score += 0.1;
    signals.push("cuenta coincidente");
  }
  if (amountDelta <= 0.01) {
    score += 0.25;
    signals.push("monto exacto");
  } else if (amountDelta / Math.max(invoice.openAmount, 1) <= 0.02) {
    score += 0.12;
    signals.push("monto dentro de tolerancia del 2%");
  }

  const windowEnd = invoice.dueAt ? new Date(invoice.dueAt) : new Date(invoice.issuedAt);
  windowEnd.setDate(windowEnd.getDate() + 45);
  if (payment.paidAt >= invoice.issuedAt && payment.paidAt <= windowEnd) {
    score += 0.05;
    signals.push("fecha dentro de la ventana esperada");
  }

  return {
    invoiceId: invoice.id,
    externalId: invoice.externalId,
    customerId: invoice.customerId,
    totalAmount: round(invoice.totalAmount),
    openAmount: round(invoice.openAmount),
    score: Math.min(1, round(score)),
    signals
  };
}

export function rankCandidates(payment: MatchPayment, invoices: MatchInvoice[], limit = 3) {
  return invoices
    .map((invoice) => scoreCandidate(payment, invoice))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || Math.abs(payment.amount - a.openAmount) - Math.abs(payment.amount - b.openAmount))
    .slice(0, limit);
}

export function confidenceLabel(score: number) {
  if (score >= 0.85) return "HIGH";
  if (score >= 0.6) return "MEDIUM";
  return "LOW";
}
