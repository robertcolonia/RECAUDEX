import { prisma } from "../config/database.js";
import { agentProfiles, type AgentCode, type AgentToolName } from "./agent-config.js";

type ToolDefinition = { name: AgentToolName; description: string; parameters: Record<string, unknown> };
export type ToolExecution = { name: AgentToolName; label: string; args: Record<string, unknown>; result: unknown };

const emptyParameters = { type: "OBJECT", properties: {}, required: [] };
const limitProperty = { type: "NUMBER", description: "Cantidad de resultados. Mínimo 1 y máximo 20." };
const queryProperty = { type: "STRING", description: "RUC, razón social, identificador de factura, pago o caso." };

export const toolDefinitions: Record<AgentToolName, ToolDefinition> = {
  get_dashboard_metrics: { name: "get_dashboard_metrics", description: "Obtiene el estado agregado de cartera, pagos, conciliaciones, aprobaciones y aplicaciones.", parameters: emptyParameters },
  get_revenue_pipeline: { name: "get_revenue_pipeline", description: "Obtiene cantidades por etapa del flujo de conciliación y el valor aplicado en el ledger.", parameters: emptyParameters },
  list_invoice_anomalies: { name: "list_invoice_anomalies", description: "Detecta facturas con señales de integridad o vencimiento que requieren revisión.", parameters: { type: "OBJECT", properties: { limit: limitProperty }, required: [] } },
  list_overdue_invoices: { name: "list_overdue_invoices", description: "Lista facturas abiertas vencidas con cliente, saldo y días de atraso.", parameters: { type: "OBJECT", properties: { limit: limitProperty, minDaysOverdue: { type: "NUMBER", description: "Mínimo de días de atraso." }, minAmount: { type: "NUMBER", description: "Saldo abierto mínimo en PEN." } }, required: [] } },
  search_invoices: { name: "search_invoices", description: "Busca facturas por número, RUC o razón social.", parameters: { type: "OBJECT", properties: { query: queryProperty, limit: limitProperty }, required: ["query"] } },
  get_customer_summary: { name: "get_customer_summary", description: "Devuelve el estado financiero de un cliente identificado por RUC o razón social.", parameters: { type: "OBJECT", properties: { query: queryProperty }, required: ["query"] } },
  list_collection_priorities: { name: "list_collection_priorities", description: "Prioriza clientes con deuda vencida por saldo y antigüedad.", parameters: { type: "OBJECT", properties: { limit: limitProperty }, required: [] } },
  list_payment_intents: { name: "list_payment_intents", description: "Consulta Payment Twins o intenciones de pago por cliente y estado.", parameters: { type: "OBJECT", properties: { query: queryProperty, status: { type: "STRING", description: "Estado del Payment Twin, por ejemplo OPEN." }, limit: limitProperty }, required: [] } },
  list_unmatched_payments: { name: "list_unmatched_payments", description: "Lista depósitos sin aplicar o con identificación pendiente.", parameters: { type: "OBJECT", properties: { limit: limitProperty, minAmount: { type: "NUMBER", description: "Monto mínimo del pago." } }, required: [] } },
  list_pending_reconciliations: { name: "list_pending_reconciliations", description: "Lista casos de conciliación con confianza, decisión de política y evidencia.", parameters: { type: "OBJECT", properties: { limit: limitProperty, status: { type: "STRING", description: "Estado opcional del caso." } }, required: [] } },
  get_reconciliation_case: { name: "get_reconciliation_case", description: "Obtiene el detalle de un caso o pago, candidatos, reglas, aprobación y aplicación.", parameters: { type: "OBJECT", properties: { query: queryProperty }, required: ["query"] } },
  get_matching_metrics: { name: "get_matching_metrics", description: "Obtiene benchmark Top-1/Top-3 y métricas vivas de confianza y decisiones.", parameters: emptyParameters },
  get_risk_indicators: { name: "get_risk_indicators", description: "Calcula antigüedad de cartera y exposición por pagos sin aplicar y aprobaciones pendientes.", parameters: emptyParameters },
  list_ready_applications: { name: "list_ready_applications", description: "Lista casos aprobados y aún no aplicados en el ledger.", parameters: { type: "OBJECT", properties: { limit: limitProperty }, required: [] } },
  get_settlement_ledger: { name: "get_settlement_ledger", description: "Consulta aplicaciones de pago ya registradas y sus facturas afectadas.", parameters: { type: "OBJECT", properties: { limit: limitProperty }, required: [] } },
  get_recent_audit_events: { name: "get_recent_audit_events", description: "Consulta eventos recientes de auditoría del ciclo de ingresos.", parameters: { type: "OBJECT", properties: { limit: limitProperty }, required: [] } }
};

export const toolLabels: Record<AgentToolName, string> = {
  get_dashboard_metrics: "Indicadores generales",
  get_revenue_pipeline: "Flujo de ingresos",
  list_invoice_anomalies: "Anomalías de facturación",
  list_overdue_invoices: "Facturas vencidas",
  search_invoices: "Búsqueda de facturas",
  get_customer_summary: "Estado del cliente",
  list_collection_priorities: "Prioridad de cobranza",
  list_payment_intents: "Payment Twin",
  list_unmatched_payments: "Pagos sin aplicar",
  list_pending_reconciliations: "Casos de conciliación",
  get_reconciliation_case: "Evidencia del caso",
  get_matching_metrics: "Métricas de matching",
  get_risk_indicators: "Indicadores de riesgo",
  list_ready_applications: "Aplicaciones autorizadas",
  get_settlement_ledger: "Ledger RECAUDEX",
  get_recent_audit_events: "Auditoría"
};

const toNumber = (value: unknown) => Number(value ?? 0);
const safeLimit = (value: unknown) => Math.min(20, Math.max(1, Math.floor(Number(value) || 8)));
const iso = (value: Date | null) => value?.toISOString() ?? null;

export async function executeAgentTool(name: AgentToolName, args: Record<string, unknown>, organizationId: string): Promise<unknown> {
  if (name === "get_dashboard_metrics") {
    const [organization, open, overdue, payments, unmatched, cases, approvals, settlements] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
      prisma.invoice.aggregate({ where: { organizationId, status: "OPEN" }, _count: true, _sum: { openAmount: true } }),
      prisma.invoice.count({ where: { organizationId, status: "OPEN", dueAt: { lt: new Date() } } }),
      prisma.payment.aggregate({ where: { organizationId }, _count: true, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { organizationId, status: "UNMATCHED" }, _count: true, _sum: { amount: true } }),
      prisma.reconciliationCase.count({ where: { organizationId, settlement: null } }),
      prisma.approval.count({ where: { organizationId, status: "PENDING" } }),
      prisma.settlement.findMany({ where: { organizationId }, select: { payment: { select: { amount: true } } } })
    ]);
    return { organization: organization?.name, openInvoices: open._count, overdueInvoices: overdue, openAmount: toNumber(open._sum.openAmount), payments: payments._count, collectedAmount: toNumber(payments._sum.amount), unmatchedPayments: unmatched._count, unmatchedAmount: toNumber(unmatched._sum.amount), openReconciliationCases: cases, pendingApprovals: approvals, settlements: settlements.length, settledAmount: settlements.reduce((sum, item) => sum + toNumber(item.payment.amount), 0) };
  }

  if (name === "get_revenue_pipeline") {
    const [cases, settlements] = await Promise.all([
      prisma.reconciliationCase.groupBy({ by: ["status"], where: { organizationId }, _count: true }),
      prisma.settlement.findMany({ where: { organizationId }, select: { payment: { select: { amount: true } } } })
    ]);
    return { stages: cases.map((item) => ({ status: item.status, count: item._count })), appliedCount: settlements.length, appliedAmount: settlements.reduce((sum, item) => sum + toNumber(item.payment.amount), 0) };
  }

  if (name === "list_overdue_invoices" || name === "list_invoice_anomalies") {
    const today = new Date();
    const minDays = Math.max(0, Number(args.minDaysOverdue) || 0);
    const cutoff = new Date(today.getTime() - minDays * 86_400_000);
    const invoices = await prisma.invoice.findMany({
      where: { organizationId, status: "OPEN", dueAt: { lt: cutoff }, openAmount: { gte: Math.max(0, Number(args.minAmount) || 0) } },
      orderBy: [{ openAmount: "desc" }, { dueAt: "asc" }],
      take: safeLimit(args.limit),
      select: { externalId: true, issuedAt: true, dueAt: true, totalAmount: true, openAmount: true, currency: true, customer: { select: { legalName: true, taxId: true } } }
    });
    return invoices.map((item) => ({ invoice: item.externalId, customer: item.customer, issuedAt: iso(item.issuedAt), dueAt: iso(item.dueAt), totalAmount: toNumber(item.totalAmount), openAmount: toNumber(item.openAmount), currency: item.currency, daysOverdue: item.dueAt ? Math.max(0, Math.floor((today.getTime() - item.dueAt.getTime()) / 86_400_000)) : 0, signals: [item.dueAt && item.dueAt < today ? "OVERDUE" : null, toNumber(item.openAmount) > toNumber(item.totalAmount) ? "OPEN_EXCEEDS_TOTAL" : null].filter(Boolean) }));
  }

  if (name === "search_invoices") {
    const query = String(args.query ?? "").trim();
    if (query.length < 3) return { error: "La búsqueda requiere al menos tres caracteres." };
    const invoices = await prisma.invoice.findMany({ where: { organizationId, OR: [{ externalId: { contains: query, mode: "insensitive" } }, { customer: { taxId: query } }, { customer: { legalName: { contains: query, mode: "insensitive" } } }] }, orderBy: { issuedAt: "desc" }, take: safeLimit(args.limit), select: { externalId: true, status: true, issuedAt: true, dueAt: true, totalAmount: true, openAmount: true, currency: true, customer: { select: { legalName: true, taxId: true } } } });
    return invoices.map((item) => ({ ...item, issuedAt: iso(item.issuedAt), dueAt: iso(item.dueAt), totalAmount: toNumber(item.totalAmount), openAmount: toNumber(item.openAmount) }));
  }

  if (name === "get_customer_summary") {
    const query = String(args.query ?? "").trim();
    if (query.length < 3) return { error: "Indica al menos tres caracteres del RUC o razón social." };
    const customer = await prisma.customer.findFirst({ where: { organizationId, OR: [{ taxId: query }, { legalName: { contains: query, mode: "insensitive" } }] }, include: { invoices: { select: { status: true, openAmount: true, dueAt: true } }, payments: { select: { status: true, amount: true, paidAt: true } }, paymentIntents: { select: { status: true, expectedAmount: true, reference: true, expectedAt: true } }, _count: { select: { serviceAssets: true } } } });
    if (!customer) return { found: false, query };
    const today = new Date();
    const openInvoices = customer.invoices.filter((item) => item.status === "OPEN");
    const overdue = openInvoices.filter((item) => item.dueAt && item.dueAt < today);
    return { found: true, customer: { taxId: customer.taxId, legalName: customer.legalName, segment: customer.segment, status: customer.status }, services: customer._count.serviceAssets, openInvoices: openInvoices.length, openAmount: openInvoices.reduce((sum, item) => sum + toNumber(item.openAmount), 0), overdueInvoices: overdue.length, overdueAmount: overdue.reduce((sum, item) => sum + toNumber(item.openAmount), 0), payments: customer.payments.length, paymentsAmount: customer.payments.reduce((sum, item) => sum + toNumber(item.amount), 0), paymentIntents: customer.paymentIntents.map((item) => ({ reference: item.reference, status: item.status, expectedAmount: toNumber(item.expectedAmount), expectedAt: iso(item.expectedAt) })) };
  }

  if (name === "list_collection_priorities") {
    const today = new Date();
    const invoices = await prisma.invoice.findMany({ where: { organizationId, status: "OPEN", dueAt: { lt: today } }, select: { customerId: true, openAmount: true, dueAt: true, customer: { select: { legalName: true, taxId: true, status: true } } } });
    const grouped = new Map<string, { customer: { legalName: string; taxId: string; status: string | null }; invoices: number; overdueAmount: number; maxDaysOverdue: number }>();
    for (const invoice of invoices) {
      const current = grouped.get(invoice.customerId) ?? { customer: invoice.customer, invoices: 0, overdueAmount: 0, maxDaysOverdue: 0 };
      current.invoices += 1;
      current.overdueAmount += toNumber(invoice.openAmount);
      current.maxDaysOverdue = Math.max(current.maxDaysOverdue, invoice.dueAt ? Math.floor((today.getTime() - invoice.dueAt.getTime()) / 86_400_000) : 0);
      grouped.set(invoice.customerId, current);
    }
    return [...grouped.values()].sort((a, b) => b.overdueAmount - a.overdueAmount || b.maxDaysOverdue - a.maxDaysOverdue).slice(0, safeLimit(args.limit));
  }

  if (name === "list_payment_intents") {
    const query = String(args.query ?? "").trim();
    const status = String(args.status ?? "").trim().toUpperCase();
    const intents = await prisma.paymentIntent.findMany({ where: { organizationId, ...(status ? { status } : {}), ...(query.length >= 3 ? { OR: [{ reference: { contains: query, mode: "insensitive" } }, { customer: { taxId: query } }, { customer: { legalName: { contains: query, mode: "insensitive" } } }] } : {}) }, orderBy: { createdAt: "desc" }, take: safeLimit(args.limit), select: { reference: true, expectedAmount: true, expectedAt: true, status: true, invoiceIds: true, customer: { select: { legalName: true, taxId: true } } } });
    return intents.map((item) => ({ ...item, expectedAmount: toNumber(item.expectedAmount), expectedAt: iso(item.expectedAt) }));
  }

  if (name === "list_unmatched_payments") {
    const payments = await prisma.payment.findMany({ where: { organizationId, status: "UNMATCHED", amount: { gte: Math.max(0, Number(args.minAmount) || 0) } }, orderBy: [{ amount: "desc" }, { paidAt: "asc" }], take: safeLimit(args.limit), select: { externalId: true, bankOperation: true, declaredInvoice: true, paidAt: true, amount: true, currency: true, customer: { select: { legalName: true, taxId: true } } } });
    return payments.map((item) => ({ ...item, paidAt: iso(item.paidAt), amount: toNumber(item.amount) }));
  }

  if (name === "list_pending_reconciliations") {
    const status = String(args.status ?? "").trim().toUpperCase();
    const cases = await prisma.reconciliationCase.findMany({ where: { organizationId, settlement: null, ...(status ? { status } : {}) }, orderBy: { confidence: "desc" }, take: safeLimit(args.limit), select: { id: true, status: true, confidence: true, rationale: true, policyDecision: true, policyChecks: true, candidates: true, payment: { select: { externalId: true, amount: true, paidAt: true, bankOperation: true, customer: { select: { legalName: true, taxId: true } } } }, approval: { select: { status: true } } } });
    return cases.map((item) => ({ ...item, payment: { ...item.payment, amount: toNumber(item.payment.amount), paidAt: iso(item.payment.paidAt) } }));
  }

  if (name === "get_reconciliation_case") {
    const query = String(args.query ?? "").trim();
    if (query.length < 3) return { error: "Indica el identificador del caso o pago." };
    const item = await prisma.reconciliationCase.findFirst({ where: { organizationId, OR: [{ id: query }, { payment: { externalId: { contains: query, mode: "insensitive" } } }, { payment: { bankOperation: { contains: query, mode: "insensitive" } } }] }, include: { payment: { include: { customer: { select: { legalName: true, taxId: true } } } }, approval: { select: { status: true, comment: true, requestedAt: true, decidedAt: true, decidedBy: { select: { fullName: true } } } }, settlement: { include: { items: { include: { invoice: { select: { externalId: true } } } } } } } });
    if (!item) return { found: false, query };
    return { found: true, case: { id: item.id, status: item.status, confidence: item.confidence, rationale: item.rationale, policyDecision: item.policyDecision, policyChecks: item.policyChecks, candidates: item.candidates }, payment: { externalId: item.payment.externalId, bankOperation: item.payment.bankOperation, amount: toNumber(item.payment.amount), paidAt: iso(item.payment.paidAt), customer: item.payment.customer }, approval: item.approval ? { ...item.approval, requestedAt: iso(item.approval.requestedAt), decidedAt: iso(item.approval.decidedAt) } : null, settlement: item.settlement ? { reference: item.settlement.reference, status: item.settlement.status, executedAt: iso(item.settlement.executedAt), items: item.settlement.items.map((line) => ({ invoice: line.invoice.externalId, amount: toNumber(line.amount) })) } : null };
  }

  if (name === "get_matching_metrics") {
    const cases = await prisma.reconciliationCase.findMany({ where: { organizationId }, select: { confidence: true, status: true, policyDecision: true } });
    const average = cases.length ? cases.reduce((sum, item) => sum + item.confidence, 0) / cases.length : 0;
    return { benchmark: { verifiedRelations: 3474, top1: 0.8638, top3: 0.9954, method: "Etiqueta real oculta durante el ranking y usada solo para validación." }, live: { cases: cases.length, averageConfidence: average, highConfidence: cases.filter((item) => item.confidence >= 0.9).length, approvalRequired: cases.filter((item) => item.policyDecision === "APPROVAL_REQUIRED").length, manualReview: cases.filter((item) => item.policyDecision === "MANUAL_REVIEW").length } };
  }

  if (name === "get_risk_indicators") {
    const today = new Date();
    const [invoices, unmatched, approvals] = await Promise.all([
      prisma.invoice.findMany({ where: { organizationId, status: "OPEN" }, select: { openAmount: true, dueAt: true } }),
      prisma.payment.aggregate({ where: { organizationId, status: "UNMATCHED" }, _count: true, _sum: { amount: true } }),
      prisma.approval.count({ where: { organizationId, status: "PENDING" } })
    ]);
    const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
    for (const invoice of invoices) {
      const amount = toNumber(invoice.openAmount);
      const days = invoice.dueAt ? Math.floor((today.getTime() - invoice.dueAt.getTime()) / 86_400_000) : -1;
      if (days <= 0) buckets.current += amount; else if (days <= 30) buckets.days1to30 += amount; else if (days <= 60) buckets.days31to60 += amount; else if (days <= 90) buckets.days61to90 += amount; else buckets.over90 += amount;
    }
    return { agingPEN: buckets, openAmount: Object.values(buckets).reduce((sum, value) => sum + value, 0), unmatchedPayments: unmatched._count, unmatchedAmount: toNumber(unmatched._sum.amount), pendingApprovals: approvals };
  }

  if (name === "list_ready_applications") {
    const cases = await prisma.reconciliationCase.findMany({ where: { organizationId, status: "APPROVED", settlement: null, approval: { status: "APPROVED" } }, orderBy: { updatedAt: "asc" }, take: safeLimit(args.limit), select: { id: true, confidence: true, policyDecision: true, candidates: true, payment: { select: { externalId: true, amount: true, customer: { select: { legalName: true, taxId: true } } } }, approval: { select: { decidedAt: true, decidedBy: { select: { fullName: true } } } } } });
    return cases.map((item) => ({ ...item, payment: { ...item.payment, amount: toNumber(item.payment.amount) }, approval: item.approval ? { ...item.approval, decidedAt: iso(item.approval.decidedAt) } : null }));
  }

  if (name === "get_settlement_ledger") {
    const settlements = await prisma.settlement.findMany({ where: { organizationId }, orderBy: { executedAt: "desc" }, take: safeLimit(args.limit), select: { reference: true, status: true, executedAt: true, payment: { select: { externalId: true, amount: true, customer: { select: { legalName: true, taxId: true } } } }, items: { select: { amount: true, invoice: { select: { externalId: true } } } } } });
    return settlements.map((item) => ({ ...item, executedAt: iso(item.executedAt), payment: { ...item.payment, amount: toNumber(item.payment.amount) }, items: item.items.map((line) => ({ invoice: line.invoice.externalId, amount: toNumber(line.amount) })) }));
  }

  const events = await prisma.auditEvent.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: safeLimit(args.limit), select: { action: true, entityType: true, entityId: true, detail: true, createdAt: true, user: { select: { fullName: true, role: true } } } });
  return events.map((item) => ({ ...item, createdAt: iso(item.createdAt) }));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function extractQuery(message: string) {
  const quoted = message.match(/["“']([^"”']{3,80})["”']/)?.[1];
  if (quoted) return quoted.trim();
  const id = message.match(/\b(?:\d{8,11}|[A-Za-z0-9]+-[A-Za-z0-9-]{3,})\b/)?.[0];
  return id?.trim();
}

export function selectToolsForMessage(code: AgentCode, message: string): Array<{ name: AgentToolName; args: Record<string, unknown> }> {
  const normalized = normalize(message);
  if (/^(hola|buenos dias|buenas tardes|buenas noches|gracias|quien eres|presentate|que puedes hacer)[.!? ]*$/.test(normalized)) return [];
  if (/(que|cual) (ia|inteligencia artificial|modelo) (usas|utilizas)|con que (ia|modelo)|eres gemini|por que.*(cambiaste|respondes diferente)|de la nada cambiaste/.test(normalized)) return [];
  if (/^[¿¡]?(que|como|por que|no entiendo|explica)[.!? ]*$/.test(normalized)) return [];
  const query = extractQuery(message);
  const requestsLiveData = /(actual|hoy|ahora|estado de|cuanto|cuánto|lista|muestra|busca|consulta|pendiente|vencid|sin aplicar|prioriza|riesgo operativo)/.test(normalized);
  const conceptual = /(que es|qué es|como funciona|cómo funciona|para que sirve|para qué sirve|cual es la diferencia|cuál es la diferencia|explica el proceso|define |concepto)/.test(normalized);
  const draftingOrSimulation = /(redacta|prepara un borrador|crea un guion|para el pitch|simula|ejemplo hipotetico|ejemplo hipotético)/.test(normalized);
  if (!query && !requestsLiveData && (conceptual || draftingOrSimulation)) return [];
  const selected: Array<{ name: AgentToolName; args: Record<string, unknown> }> = [];
  const allowed = new Set<AgentToolName>(agentProfiles[code].tools);
  const add = (name: AgentToolName, args: Record<string, unknown> = {}) => { if (allowed.has(name) && !selected.some((item) => item.name === name)) selected.push({ name, args }); };

  if (query && /(cliente|cuenta|ruc|empresa|estado)/.test(normalized)) add("get_customer_summary", { query });
  if (query && /(factura|comprobante)/.test(normalized)) add("search_invoices", { query, limit: 8 });
  if (query && /(caso|pago|deposito|operacion|concili)/.test(normalized)) add("get_reconciliation_case", { query });
  if (/(payment twin|intencion de pago|pagara|pagará)/.test(normalized)) add("list_payment_intents", { ...(query ? { query } : {}), limit: 8 });
  if (/(factur|comprobante|emision|emisión|nota de credito|nota de crédito)/.test(normalized)) {
    add("list_invoice_anomalies", { limit: 8 });
    add("list_overdue_invoices", { limit: 8 });
  }
  if (/(cobran|moros|cartera|contactar|promesa de pago)/.test(normalized)) add("list_collection_priorities", { limit: 8 });
  if (/(pago|deposito|depósito|abono|movimiento bancario|recaudo)/.test(normalized)) {
    add("list_unmatched_payments", { limit: 8 });
    add("list_pending_reconciliations", { limit: 8 });
  }
  if (/(top.?1|top.?3|precision|precisión|matching|acierto|confianza)/.test(normalized)) add("get_matching_metrics");
  if (/(riesgo|antiguedad|antigüedad|aging|exposicion|exposición)/.test(normalized)) add("get_risk_indicators");
  if (/(auditoria|auditoría|trazabilidad|evento)/.test(normalized)) add("get_recent_audit_events", { limit: 8 });
  if (/(aprobacion|aprobación|policy engine|politica|política)/.test(normalized)) add("list_pending_reconciliations", { limit: 8 });
  if (/(aplicad|aplicar|rebaja|ledger|asiento)/.test(normalized)) {
    add("list_ready_applications", { limit: 8 });
    add("get_settlement_ledger", { limit: 8 });
    add("get_revenue_pipeline");
  }

  if (!selected.length) {
    const defaults: Record<AgentCode, Array<{ name: AgentToolName; args: Record<string, unknown> }>> = {
      A0: [{ name: "get_dashboard_metrics", args: {} }, { name: "get_revenue_pipeline", args: {} }],
      A1: [{ name: "list_invoice_anomalies", args: { limit: 8 } }, { name: "list_overdue_invoices", args: { limit: 8 } }],
      A2: [{ name: "list_collection_priorities", args: { limit: 8 } }],
      A3: [{ name: "list_pending_reconciliations", args: { limit: 8 } }, { name: "list_unmatched_payments", args: { limit: 8 } }],
      A4: [{ name: "get_matching_metrics", args: {} }, { name: "get_risk_indicators", args: {} }],
      A5: [{ name: "list_ready_applications", args: { limit: 8 } }, { name: "get_settlement_ledger", args: { limit: 5 } }]
    };
    selected.push(...defaults[code]);
  }
  return selected.slice(0, code === "A0" ? 4 : 2);
}

export async function preloadEvidence(code: AgentCode, message: string, organizationId: string) {
  const requests = selectToolsForMessage(code, message);
  return Promise.all(requests.map(async ({ name, args }) => ({ name, label: toolLabels[name], args, result: await executeAgentTool(name, args, organizationId) })));
}
