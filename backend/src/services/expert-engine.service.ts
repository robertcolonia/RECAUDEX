import { agentProfiles, type AgentCode } from "./agent-config.js";
import { env } from "../config/env.js";
import type { ToolExecution } from "./agent-tools.service.js";

const number = (value: unknown) => Number(value ?? 0);
const money = (value: unknown) => `S/ ${number(value).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: unknown) => `${(number(value) * 100).toFixed(2)}%`;
const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown) => Array.isArray(value) ? value : [];
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function resultOf(evidence: ToolExecution[], name: string) {
  return evidence.find((item) => item.name === name)?.result;
}

function numbered(items: unknown[], render: (item: Record<string, unknown>, index: number) => string) {
  return items.slice(0, 5).map((item, index) => `${index + 1}. ${render(record(item), index)}`).join("\n");
}

function greeting(code: AgentCode) {
  const profile = agentProfiles[code];
  return `Soy ${code}, ${profile.name}. Estoy especializado en ${profile.domain.toLowerCase()} y consulto información autorizada de RECAUDEX antes de responder.\n\nPuedo ayudarte con:\n${profile.capabilities.map((item) => `• ${item}`).join("\n")}\n\nFormula una pregunta concreta o incluye un RUC, razón social, factura, pago o caso cuando quieras revisar un registro específico.`;
}

function aiIdentity(code: AgentCode) {
  return `Soy ${code}, ${agentProfiles[code].name}, un agente especializado de RECAUDEX. La plataforma utiliza ${env.GEMINI_MODEL} como modelo principal y ${env.GEMINI_FALLBACK_MODEL} como respaldo generativo. Si ambos están temporalmente indisponibles, el Motor Experto RECAUDEX mantiene consultas operativas sobre PostgreSQL sin inventar datos.\n\nEl modelo redacta y razona; las facturas, pagos, clientes y decisiones financieras provienen exclusivamente de funciones autorizadas del backend.`;
}

function providerChangeAnswer() {
  return `La respuesta cambió porque RECAUDEX alterna automáticamente entre el modelo principal, el modelo generativo de respaldo y el motor experto local cuando existe un límite de cuota o un fallo temporal. Los datos de PostgreSQL no cambiaron.\n\nSi una respuesta anterior mostró ceros sin sustento, debe considerarse inválida: se produjo porque el respaldo no recibió las métricas que su plantilla esperaba. Indícame si deseas revisar depósitos, facturas, cartera o el estado general y consultaré la fuente correspondiente.`;
}

function customerAnswer(data: Record<string, unknown>) {
  if (data.error) return `Necesito identificar la cuenta B2B. Envíame el RUC o al menos tres caracteres de la razón social para consultar facturas, pagos e intenciones de pago sin mezclar clientes.`;
  if (data.found === false) return `No encontré un cliente que coincida con “${String(data.query ?? "la búsqueda indicada")}” dentro de la organización activa. Verifica el RUC o escribe una parte más precisa de la razón social.`;
  const customer = record(data.customer);
  return `Estado de ${String(customer.legalName ?? "la cuenta")} (RUC ${String(customer.taxId ?? "no disponible")}):\n\n• ${number(data.openInvoices)} facturas abiertas por ${money(data.openAmount)}.\n• ${number(data.overdueInvoices)} están vencidas y concentran ${money(data.overdueAmount)}.\n• Se registran ${number(data.payments)} pagos por ${money(data.paymentsAmount)}.\n• Tiene ${array(data.paymentIntents).length} Payment Twin o intenciones de pago registradas.\n\nRecomendación: revisar primero cualquier pago o intención pendiente antes de iniciar una cobranza, para evitar gestionar una deuda ya pagada.`;
}

function dashboardAnswer(code: AgentCode, data: Record<string, unknown>, pipeline: Record<string, unknown>) {
  const stages = array(pipeline.stages);
  const pending = stages.reduce((sum, item) => sum + (String(record(item).status) === "SETTLED" ? 0 : number(record(item).count)), 0);
  return `Estado actual del ciclo de ingresos de ${String(data.organization ?? "la organización")}:\n\n• Cartera abierta: ${money(data.openAmount)} en ${number(data.openInvoices)} facturas; ${number(data.overdueInvoices)} están vencidas.\n• Pagos sin aplicar: ${number(data.unmatchedPayments)} por ${money(data.unmatchedAmount)}.\n• Flujo de control: ${pending || number(data.openReconciliationCases)} casos activos y ${number(data.pendingApprovals)} aprobaciones pendientes.\n• Ledger RECAUDEX: ${number(data.settlements)} aplicaciones registradas${pipeline.appliedAmount !== undefined ? ` por ${money(pipeline.appliedAmount)}` : ""}.\n\n${code === "A0" ? "Prioridad recomendada: resolver primero depósitos de alto valor con evidencia suficiente, completar la aprobación y medir la reducción de pagos sin aplicar." : "La exposición principal está en cartera vencida y pagos todavía no aplicados; conviene seguir su evolución después de cada aplicación."}`;
}

function invoiceAnswer(evidence: ToolExecution[]) {
  const invoices = array(resultOf(evidence, "list_invoice_anomalies") ?? resultOf(evidence, "list_overdue_invoices"));
  if (!invoices.length) return "No encontré facturas abiertas vencidas dentro de los criterios consultados. Esto no sustituye los controles de integridad del facturador, pero no hay excepciones visibles en la muestra actual.";
  const total = invoices.reduce((sum, item) => sum + number(record(item).openAmount), 0);
  return `Encontré ${invoices.length} facturas prioritarias que concentran ${money(total)} de saldo abierto.\n\n${numbered(invoices, (item) => { const customer = record(item.customer); return `${String(customer.legalName ?? "Cliente")} · ${String(item.invoice ?? item.externalId)} · ${money(item.openAmount)} · ${number(item.daysOverdue)} días de atraso`; })}\n\nCriterio: saldo abierto y antigüedad. Antes de corregir una factura, debe validarse si el problema es de emisión, vencimiento o aplicación de un pago.`;
}

function invoiceSearchAnswer(data: unknown) {
  const invoices = array(data);
  if (!invoices.length) return "No encontré facturas con el número, RUC o razón social indicados. Revisa el identificador y vuelve a intentarlo.";
  return `Facturas encontradas:\n\n${numbered(invoices, (item) => { const customer = record(item.customer); return `${String(item.externalId)} · ${String(customer.legalName ?? "Cliente")} · saldo ${money(item.openAmount)} · estado ${String(item.status)}`; })}\n\nLa deuda debe interpretarse con el saldo abierto, no únicamente con el monto original de la factura.`;
}

function collectionsAnswer(data: unknown) {
  const priorities = array(data);
  if (!priorities.length) return "No se identificó cartera vencida para priorizar en la muestra actual.";
  return `La cartera debe gestionarse en este orden:\n\n${numbered(priorities, (item) => { const customer = record(item.customer); return `${String(customer.legalName ?? "Cliente")} · ${money(item.overdueAmount)} vencidos · ${number(item.invoices)} facturas · antigüedad máxima ${number(item.maxDaysOverdue)} días`; })}\n\nAntes de contactar, A2 debe revisar Payment Twin y pagos en conciliación. Esa verificación reduce el riesgo de cobranza improcedente.`;
}

function paymentIntentsAnswer(data: unknown) {
  const intents = array(data);
  if (!intents.length) return "No encontré Payment Twins con los criterios indicados. Puedes darme un RUC, razón social o referencia para afinar la búsqueda.";
  return `Payment Twins encontrados:\n\n${numbered(intents, (item) => { const customer = record(item.customer); return `${String(item.reference)} · ${String(customer.legalName ?? "Cliente")} · ${money(item.expectedAmount)} · ${String(item.status)}`; })}\n\nEstas intenciones anticipan qué facturas cubrirá el depósito y fortalecen la identificación cuando la referencia bancaria es insuficiente.`;
}

function reconciliationAnswer(evidence: ToolExecution[], message: string) {
  const direct = record(resultOf(evidence, "get_reconciliation_case"));
  if (Object.keys(direct).length) {
    if (direct.found === false) return `No encontré el caso o pago indicado. Comprueba el identificador de pago, número de operación o código del caso.`;
    const detail = record(direct.case); const payment = record(direct.payment); const approval = record(direct.approval); const settlement = record(direct.settlement);
    return `El pago ${String(payment.externalId ?? "consultado")} por ${money(payment.amount)} está en estado ${String(detail.status ?? "sin estado")}, con ${percent(detail.confidence)} de confianza.\n\nEvidencia: ${String(detail.rationale ?? "sin explicación disponible")}.\nDecisión del Policy Engine: ${String(detail.policyDecision ?? "pendiente")}.\nAprobación: ${String(approval.status ?? "no registrada")}.\nAplicación en ledger: ${settlement.reference ? `${String(settlement.reference)} (${String(settlement.status)})` : "todavía no registrada"}.\n\nSiguiente paso: ${settlement.reference ? "conservar la trazabilidad y verificar el impacto en cartera." : approval.status === "APPROVED" ? "remitir a A5 para la aplicación controlada." : "completar la revisión o aprobación humana requerida."}`;
  }
  const cases = array(resultOf(evidence, "list_pending_reconciliations"));
  const payments = array(resultOf(evidence, "list_unmatched_payments"));
  const ambiguous = /\b(mi|la|esta) cuenta\b/.test(normalized(message)) && !/\b\d{8,11}\b/.test(message);
  const total = payments.reduce((sum, item) => sum + number(record(item).amount), 0);
  const header = ambiguous ? "“Mi cuenta” puede referirse a un cliente B2B o al estado general de recaudo. Para revisar un cliente específico necesito su RUC o razón social.\n\nComo panorama operativo:" : "Panorama actual de conciliación:";
  return `${header}\n\n• ${payments.length} pagos prioritarios sin aplicar concentran ${money(total)} en la consulta.\n• ${cases.length} casos de conciliación están visibles para revisión.\n${numbered(cases, (item) => { const payment = record(item.payment); return `Pago ${String(payment.externalId ?? "sin referencia")} · ${money(payment.amount)} · ${percent(item.confidence)} · ${String(item.policyDecision ?? item.status)}`; }) || "No hay casos pendientes."}\n\nA3 recomienda por evidencia; el Policy Engine y una persona autorizada controlan cualquier aplicación.`;
}

function supervisorPaymentsAnswer(evidence: ToolExecution[]) {
  const payments = array(resultOf(evidence, "list_unmatched_payments"));
  const cases = array(resultOf(evidence, "list_pending_reconciliations"));
  if (!payments.length && !cases.length) return "No encontré depósitos pendientes ni casos de conciliación en las fuentes consultadas. A3 debe confirmar si el filtro o el estado solicitado es correcto.";
  const total = payments.reduce((sum, item) => sum + number(record(item).amount), 0);
  return `Depósitos prioritarios identificados en la consulta:\n\n${numbered(payments, (item) => { const customer = record(item.customer); return `${String(item.externalId ?? "Sin identificador")} · ${money(item.amount)} · ${String(customer.legalName ?? "Pagador por identificar")} · operación ${String(item.bankOperation ?? "sin referencia")}`; }) || "No hay depósitos pendientes en esta selección."}\n\nLa muestra visible reúne ${payments.length} depósitos por ${money(total)} y ${cases.length} casos de conciliación. A3 debe validar candidatos y evidencia; A2 debe suspender cualquier cobranza relacionada hasta aclarar el pago; A5 interviene únicamente después de una aprobación válida.`;
}

function supervisorCrossAnswer(evidence: ToolExecution[]) {
  const invoices = array(resultOf(evidence, "list_invoice_anomalies") ?? resultOf(evidence, "list_overdue_invoices"));
  const payments = array(resultOf(evidence, "list_unmatched_payments"));
  const invoiceAmount = invoices.reduce((sum, item) => sum + number(record(item).openAmount), 0);
  const paymentAmount = payments.reduce((sum, item) => sum + number(record(item).amount), 0);
  return `Diagnóstico transversal sobre la muestra prioritaria consultada:\n\n• Facturación: ${invoices.length} facturas vencidas o anómalas concentran ${money(invoiceAmount)} de saldo abierto.\n• Recaudo: ${payments.length} depósitos sin aplicar concentran ${money(paymentAmount)}.\n\nPrioridad de intervención:\n1. A3 debe identificar primero los depósitos de mayor valor y generar candidatos con evidencia.\n2. A1 debe revisar las facturas candidatas y confirmar que su emisión, saldo y vencimiento sean correctos.\n3. A2 debe detener temporalmente la cobranza de clientes con pagos en investigación.\n4. A5 debe aplicar únicamente los casos aprobados; A4 medirá la reducción de pagos sin aplicar y cartera vencida.\n\nA0 supervisará el avance, los bloqueos y la trazabilidad del recorrido.`;
}

function matchingAnswer(metrics: Record<string, unknown>, risk: Record<string, unknown>) {
  const benchmark = record(metrics.benchmark); const live = record(metrics.live); const aging = record(risk.agingPEN);
  return `Desempeño del motor de correspondencia:\n\n• Precisión Top-1: ${percent(benchmark.top1)} sobre ${number(benchmark.verifiedRelations).toLocaleString("es-PE")} relaciones verificables.\n• Cobertura Top-3: ${percent(benchmark.top3)}.\n• Operación viva: ${number(live.cases)} casos con confianza promedio de ${percent(live.averageConfidence)}; ${number(live.manualReview)} requieren revisión manual.\n• Riesgo de cartera mayor a 90 días: ${money(aging.over90)}.\n• Pagos sin aplicar: ${number(risk.unmatchedPayments)} por ${money(risk.unmatchedAmount)}.\n\nInterpretación: Top-1 y Top-3 son métricas de validación; la confianza operativa no debe presentarse como precisión real. El impacto debe medirse además por intervención manual, tiempo hasta aplicación y reducción de cobranza improcedente.`;
}

function applicationsAnswer(evidence: ToolExecution[]) {
  const ready = array(resultOf(evidence, "list_ready_applications"));
  const ledger = array(resultOf(evidence, "get_settlement_ledger"));
  return `Estado de aplicación financiera:\n\n• ${ready.length} casos aprobados están listos y todavía no figuran aplicados.\n• ${ledger.length} aplicaciones recientes tienen evidencia en el ledger consultado.\n\n${ready.length ? numbered(ready, (item) => { const payment = record(item.payment); const customer = record(payment.customer); return `Caso ${String(item.id).slice(-8)} · ${String(customer.legalName ?? "Cliente")} · ${money(payment.amount)} · confianza ${percent(item.confidence)}`; }) : "No hay casos listos para ejecutar en este momento."}\n\nA5 solo debe aplicar cuando el caso y la aprobación continúan vigentes. La ejecución real ocurre en el backend y genera un evento de auditoría.`;
}

export function buildExpertAnswer(code: AgentCode, message: string, evidence: ToolExecution[]) {
  const text = normalized(message).trim();
  if (/^(hola|buenos dias|buenas tardes|buenas noches|gracias|quien eres|que puedes hacer)[.!? ]*$/.test(text)) return greeting(code);
  if (/(que|cual) (ia|inteligencia artificial|modelo) (usas|utilizas)|con que (ia|modelo)|eres gemini|gemini/.test(text)) return aiIdentity(code);
  if (/(por que|porque|porq).*(cambiaste|cambio|respondes diferente|respuesta)|de la nada cambiaste/.test(text)) return providerChangeAnswer();
  if (/^[¿¡]?(que|como|por que|no entiendo|explica)[.!? ]*$/.test(text)) return "Necesito un poco más de contexto para responder con precisión. Puedes pedirme, por ejemplo: “muestra los primeros depósitos pendientes”, “resume la cartera vencida” o “explica por qué un pago requiere aprobación”.";

  const customer = resultOf(evidence, "get_customer_summary");
  if (customer) return customerAnswer(record(customer));
  const invoiceSearch = resultOf(evidence, "search_invoices");
  if (invoiceSearch) return invoiceSearchAnswer(invoiceSearch);
  const intents = resultOf(evidence, "list_payment_intents");
  if (intents) return paymentIntentsAnswer(intents);

  if (code === "A0") {
    const hasInvoices = Boolean(resultOf(evidence, "list_invoice_anomalies") ?? resultOf(evidence, "list_overdue_invoices"));
    const hasPayments = Boolean(resultOf(evidence, "list_unmatched_payments") ?? resultOf(evidence, "list_pending_reconciliations"));
    if (hasInvoices && hasPayments) return supervisorCrossAnswer(evidence);
    if (hasPayments) return supervisorPaymentsAnswer(evidence);
    if (hasInvoices) return `${invoiceAnswer(evidence)}\n\nResponsables: A1 valida la factura; si existe evidencia de depósito, A3 continúa la conciliación y A2 evita una cobranza improcedente.`;
    const dashboard = resultOf(evidence, "get_dashboard_metrics");
    if (dashboard) return dashboardAnswer(code, record(dashboard), record(resultOf(evidence, "get_revenue_pipeline")));
    return greeting(code);
  }
  if (code === "A1") return invoiceAnswer(evidence);
  if (code === "A2") return collectionsAnswer(resultOf(evidence, "list_collection_priorities"));
  if (code === "A3") return reconciliationAnswer(evidence, message);
  if (code === "A4") return matchingAnswer(record(resultOf(evidence, "get_matching_metrics")), record(resultOf(evidence, "get_risk_indicators")));
  return applicationsAnswer(evidence);
}
