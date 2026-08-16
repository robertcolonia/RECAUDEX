import { prisma } from "../config/database.js";
import { getAiProviderStatus, type AgentCode } from "./agent.service.js";

const number = (value: unknown) => Number(value ?? 0);
const currency = (value: unknown) => `S/ ${number(value).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function getAgentWorkspace(code: AgentCode, organizationId: string) {
  const [provider, open, payments, unmatched, pendingApprovals, settlements, cases] = await Promise.all([
    getAiProviderStatus(organizationId),
    prisma.invoice.aggregate({ where: { organizationId, status: "OPEN" }, _count: true, _sum: { openAmount: true } }),
    prisma.payment.aggregate({ where: { organizationId }, _count: true, _sum: { amount: true } }),
    prisma.payment.count({ where: { organizationId, status: "UNMATCHED" } }),
    prisma.approval.count({ where: { organizationId, status: "PENDING" } }),
    prisma.settlement.count({ where: { organizationId } }),
    prisma.reconciliationCase.findMany({ where: { organizationId }, select: { confidence: true, status: true, policyDecision: true } })
  ]);
  const base = {
    provider,
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: "Cartera abierta", value: currency(open._sum.openAmount), detail: `${open._count} facturas`, tone: "blue" },
      { label: "Pagos sin aplicar", value: unmatched.toLocaleString("es-PE"), detail: `${payments._count} pagos recibidos`, tone: "amber" },
      { label: "Aprobaciones", value: pendingApprovals.toLocaleString("es-PE"), detail: `${settlements} aplicaciones ejecutadas`, tone: "mint" }
    ]
  };

  if (code === "A0") {
    const pipeline = ["RECOMMENDED", "REVIEW", "PENDING_APPROVAL", "APPROVED", "SETTLED"].map((status) => ({ status, count: cases.filter((item) => item.status === status).length }));
    return { ...base, title: "Orquestación del ciclo de ingresos", insight: `${unmatched} pagos requieren atención; ${pendingApprovals} decisiones están pendientes y ${settlements} pagos ya fueron aplicados en el ledger.`, items: pipeline.map((item) => ({ id: item.status, title: item.status.replaceAll("_", " "), subtitle: "Etapa del flujo controlado", value: String(item.count), status: item.status })), actions: [{ label: "Iniciar recorrido del pitch", to: "/demo" }, { label: "Abrir conciliación", to: "/conciliacion" }] };
  }

  if (code === "A1" || code === "A2") {
    const overdue = await prisma.invoice.findMany({ where: { organizationId, status: "OPEN", dueAt: { lt: new Date() } }, orderBy: [{ openAmount: "desc" }, { dueAt: "asc" }], take: 8, include: { customer: { select: { legalName: true, taxId: true } } } });
    const overdueAmount = overdue.reduce((sum, item) => sum + number(item.openAmount), 0);
    return { ...base, title: code === "A1" ? "Control de facturación" : "Cartera priorizada", insight: code === "A1" ? `${overdue.length} facturas críticas concentran ${currency(overdueAmount)} en saldo abierto.` : `La prioridad combina saldo abierto, vencimiento y contexto del cliente; las primeras ${overdue.length} cuentas concentran ${currency(overdueAmount)}.`, items: overdue.map((item) => ({ id: item.id, title: item.customer.legalName, subtitle: `${item.externalId} · RUC ${item.customer.taxId}`, value: currency(item.openAmount), status: item.dueAt && item.dueAt < new Date() ? "OVERDUE" : item.status })), actions: [{ label: code === "A1" ? "Ver clientes" : "Gestionar cartera", to: "/clientes" }] };
  }

  if (code === "A3") {
    const queue = await prisma.reconciliationCase.findMany({ where: { organizationId, settlement: null }, include: { payment: { include: { customer: { select: { legalName: true } } } } }, orderBy: { confidence: "desc" }, take: 8 });
    return { ...base, title: "Cola de conciliación explicable", insight: `${queue.length} casos visibles; ${queue.filter((item) => item.policyDecision === "APPROVAL_REQUIRED").length} superan las reglas y esperan control humano.`, items: queue.map((item) => ({ id: item.id, title: item.payment.customer?.legalName || "Pagador por identificar", subtitle: `${Math.round(item.confidence * 100)}% · ${item.rationale}`, value: currency(item.payment.amount), status: item.policyDecision })), actions: [{ label: "Seleccionar pago y conciliar", to: "/demo" }, { label: "Ver todos los casos", to: "/conciliacion" }] };
  }

  if (code === "A4") {
    const averageConfidence = cases.length ? cases.reduce((sum, item) => sum + item.confidence, 0) / cases.length : 0;
    return { ...base, title: "Indicadores y validación del matching", insight: `El motor mantiene ${Math.round(averageConfidence * 100)}% de confianza promedio en ${cases.length} casos operativos. El benchmark oculta la etiqueta real durante el ranking.`, kpis: [
      { label: "Top-1 validado", value: "86.38%", detail: "3,474 relaciones verificables", tone: "mint" },
      { label: "Top-3 validado", value: "99.54%", detail: "Etiqueta usada solo para validar", tone: "blue" },
      { label: "Confianza operativa", value: `${Math.round(averageConfidence * 100)}%`, detail: `${cases.length} casos en PostgreSQL`, tone: "amber" }
    ], items: [
      { id: "top1", title: "Precisión Top-1", subtitle: "La factura correcta aparece como primera recomendación", value: "86.38%", status: "VALIDATED" },
      { id: "top3", title: "Cobertura Top-3", subtitle: "La factura correcta aparece entre tres candidatos", value: "99.54%", status: "VALIDATED" },
      { id: "stp", title: "Aplicaciones registradas", subtitle: "Ledger controlado de RECAUDEX", value: settlements.toLocaleString("es-PE"), status: "LIVE" }
    ], actions: [{ label: "Ejecutar demo medible", to: "/demo" }, { label: "Ver auditoría", to: "/auditoria" }] };
  }

  const ready = await prisma.reconciliationCase.findMany({ where: { organizationId, status: "APPROVED", settlement: null }, include: { payment: { include: { customer: { select: { legalName: true } } } } }, orderBy: { updatedAt: "asc" }, take: 8 });
  return { ...base, title: "Aplicaciones autorizadas", insight: `${ready.length} casos aprobados están listos para aplicación; A5 nunca ejecuta un caso sin aprobación vigente.`, items: ready.map((item) => ({ id: item.id, title: item.payment.customer?.legalName || "Pagador por identificar", subtitle: `Caso ${item.id.slice(-8)} · control aprobado`, value: currency(item.payment.amount), status: "READY" })), actions: [{ label: "Aplicar caso en la demo", to: "/demo" }, { label: "Abrir aprobaciones", to: "/aprobaciones" }] };
}

export async function getSystemStatus(organizationId: string) {
  const [organizations, customers, payments, provider] = await Promise.all([
    prisma.organization.count({ where: { id: organizationId } }),
    prisma.customer.count({ where: { organizationId } }),
    prisma.payment.count({ where: { organizationId } }),
    getAiProviderStatus(organizationId)
  ]);
  return { api: "ONLINE", database: organizations === 1 ? "ONLINE" : "UNAVAILABLE", ai: provider.mode, provider: provider.provider, gemini: provider.configured ? "CONFIGURED" : "KEY_REQUIRED", model: provider.model, tokensUsedToday: provider.tokensUsedToday, dailyTokenBudget: provider.dailyTokenBudget, customers, payments, checkedAt: new Date().toISOString() };
}
