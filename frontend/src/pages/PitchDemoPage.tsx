import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, Check, CheckCircle2, ChevronRight, CircleDollarSign, Database, FileCheck2, Landmark, Play, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../api/client";
import { money, dateTime } from "../data";

type SystemStatus = { api: string; database: string; gemini: string; model: string; customers: number; payments: number; checkedAt: string };
type Metrics = { openAmount: number; openInvoices: number; unmatchedPayments: number; reconciliationRate: number; pendingApprovals: number };
type Payment = { id: string; externalId: string; declaredInvoice: string | null; amount: string; currency: string; paidAt: string; accountCode: string | null; customer: { legalName: string; taxId: string } | null };
type Candidate = { invoiceId: string; externalId: string; openAmount: number; score: number; signals: string[] };
type MatchCase = { id: string; confidence: number; rationale: string; policyDecision: string; policyChecks: Array<{ code: string; label: string; passed: boolean; detail: string }>; candidates: Candidate[]; payment: Payment };
type Approval = { id: string; status: string };
type Settlement = { id: string; reference: string; items: Array<{ invoiceId: string; amount: string }> };
type Event = { id: string; action: string; entityType: string; createdAt: string; user: { fullName: string } | null };

const steps = ["Login", "A0 · Control Tower", "Seleccionar pago", "A3 · Matching", "Evidencia", "Policy Engine", "Aprobación", "A5 · Aplicación", "A4 + Auditoría"];

export function PitchDemoPage() {
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [before, setBefore] = useState<Metrics | null>(null);
  const [after, setAfter] = useState<Metrics | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [matchCase, setMatchCase] = useState<MatchCase | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const selected = useMemo(() => payments.find((payment) => payment.id === selectedId), [payments, selectedId]);
  const stage = settlement ? 9 : approval?.status === "APPROVED" ? 7 : approval ? 6 : matchCase ? 5 : selected ? 3 : 2;

  async function load() {
    setError("");
    try {
      const [status, dashboard, queue] = await Promise.all([
        api<SystemStatus>("/api/agents/status"),
        api<{ metrics: Metrics }>("/api/dashboard"),
        api<{ payments: Payment[] }>("/api/reconciliations/payments")
      ]);
      setSystem(status); setBefore(dashboard.metrics); setPayments(queue.payments); if (!selectedId && queue.payments[0]) setSelectedId(queue.payments[0].id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo preparar la demostración."); }
  }
  useEffect(() => { void load(); }, []);

  async function act(name: string, callback: () => Promise<void>) { setBusy(name); setError(""); try { await callback(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible completar esta etapa."); } finally { setBusy(""); } }
  function generate() { if (!selected) return; return act("match", async () => { const response = await api<{ case: MatchCase }>(`/api/reconciliations/generate/${selected.id}`, { method: "POST" }); setMatchCase(response.case); }); }
  function requestApproval() { if (!matchCase) return; return act("request", async () => { const response = await api<{ approval: Approval }>(`/api/approvals/request/${matchCase.id}`, { method: "POST" }); setApproval(response.approval); }); }
  function approve() { if (!approval) return; return act("approve", async () => { const response = await api<{ approval: Approval }>(`/api/approvals/${approval.id}/decision`, { method: "POST", body: JSON.stringify({ status: "APPROVED", comment: "Aprobación ejecutada durante la demostración del MVP." }) }); setApproval(response.approval); }); }
  function settle() { if (!matchCase) return; return act("settle", async () => {
    const response = await api<{ settlement: Settlement; indicators: Metrics }>(`/api/settlements/${matchCase.id}/execute`, { method: "POST", body: "{}" }); setSettlement(response.settlement);
    const [dashboard, audit] = await Promise.all([api<{ metrics: Metrics }>("/api/dashboard"), api<{ events: Event[] }>("/api/audit")]); setAfter(dashboard.metrics); setEvents(audit.events.slice(0, 8));
  }); }

  return <div className="demo-page">
    <header className="page-heading heading-row"><div><span className="overline dark"><Sparkles size={14} /> DEMOSTRACIÓN PARA EL PITCH</span><h1>Recorrido integral del MVP</h1><p>Una operación real sobre PostgreSQL, desde el pago sin identificar hasta el ledger y la auditoría.</p></div><button className="button secondary" onClick={() => void load()}><RefreshCw size={16} /> Reiniciar selección</button></header>
    <div className="demo-system-bar"><StatusDot label="API" value={system?.api} /><StatusDot label="PostgreSQL" value={system?.database} /><StatusDot label="Gemini" value={system?.gemini === "CONFIGURED" ? system.model : "Clave pendiente"} warning={system?.gemini !== "CONFIGURED"} /><span>Sin integración bancaria real · datos sintéticos SON-IA</span></div>
    {error && <div className="notice error">{error}</div>}
    <div className="demo-layout">
      <aside className="demo-steps">{steps.map((label, index) => <div className={`${index < stage ? "done" : index === stage ? "active" : ""}`} key={label}><span>{index < stage ? <Check size={13} /> : index + 1}</span><strong>{label}</strong></div>)}</aside>
      <main className="demo-flow">
        <section className="demo-stage panel"><div className="demo-stage-title"><span><Bot /></span><div><small>PASO 1 · A0 SUPERVISOR</small><h2>Control Tower prioriza la operación</h2><p>A0 consulta el estado inicial y dirige la atención hacia pagos sin aplicar.</p></div></div>{before && <div className="demo-metrics"><Metric label="Cartera abierta" value={money(before.openAmount)} /><Metric label="Pagos pendientes" value={String(before.unmatchedPayments)} /><Metric label="Tasa aplicada" value={`${before.reconciliationRate.toFixed(1)}%`} /></div>}</section>

        <section className="demo-stage panel"><div className="demo-stage-title"><span><Landmark /></span><div><small>PASO 2 · PAGO RECIBIDO</small><h2>Selecciona un movimiento bancario</h2><p>El extracto aporta monto, fecha y operación; no existe conexión con un banco real.</p></div></div><div className="payment-picker">{payments.slice(0, 6).map((payment) => <button className={selectedId === payment.id ? "selected" : ""} onClick={() => { setSelectedId(payment.id); setMatchCase(null); setApproval(null); setSettlement(null); setAfter(null); setEvents([]); }} key={payment.id}><span>{payment.customer?.legalName || "Pagador por identificar"}<small>{payment.externalId.slice(-12)} · {dateTime(payment.paidAt)}</small></span><strong>{money(payment.amount, payment.currency)}</strong>{selectedId === payment.id && <CheckCircle2 />}</button>)}</div>{!payments.length && <div className="empty-state">No quedan pagos aptos para esta demostración. Puedes importar o sembrar nuevamente el dataset SON-IA.</div>}{selected && !matchCase && <div className="stage-action"><button className="button primary" onClick={() => void generate()} disabled={busy === "match"}><Play size={16} />{busy === "match" ? "A3 está comparando…" : "A3: generar candidatos reales"}</button></div>}</section>

        {matchCase && <section className="demo-stage panel"><div className="demo-stage-title"><span><FileCheck2 /></span><div><small>PASOS 3–5 · A3 + EVIDENCIA + POLICY ENGINE</small><h2>Matching explicable y controlado</h2><p>A3 compara el pago con facturas abiertas; las reglas se evalúan y persisten antes de avanzar.</p></div></div><div className="candidate-grid">{matchCase.candidates.map((candidate, index) => <article className={index === 0 ? "top" : ""} key={candidate.invoiceId}><span>{index === 0 ? "RECOMENDADO" : `CANDIDATO ${index + 1}`}</span><h3>{candidate.externalId}</h3><strong>{Math.round(candidate.score * 100)}% de confianza</strong><p>{money(candidate.openAmount)}</p><div>{candidate.signals.map((signal) => <em key={signal}><Check size={12} />{signal}</em>)}</div></article>)}</div><div className="policy-panel"><div className="policy-heading"><ShieldCheck /><span><strong>Policy Engine: {matchCase.policyDecision.replaceAll("_", " ")}</strong><small>{matchCase.rationale}</small></span></div><div className="policy-checks">{matchCase.policyChecks.map((check) => <div className={check.passed ? "passed" : "failed"} key={check.code}>{check.passed ? <Check size={14} /> : "!"}<span><strong>{check.label}</strong><small>{check.detail}</small></span></div>)}</div></div>{!approval && <div className="stage-action"><button className="button primary" onClick={() => void requestApproval()} disabled={busy === "request"}><ShieldCheck size={16} />{busy === "request" ? "Registrando solicitud…" : "Solicitar aprobación humana"}</button></div>}</section>}

        {approval && <section className="demo-stage panel approval-stage"><div className="demo-stage-title"><span><ShieldCheck /></span><div><small>PASO 6 · CONTROL HUMANO</small><h2>{approval.status === "APPROVED" ? "Caso aprobado" : "Decisión financiera pendiente"}</h2><p>La recomendación no puede aplicarse hasta que un responsable autorizado la apruebe.</p></div><b>{approval.status}</b></div>{approval.status === "PENDING" && <div className="stage-action"><button className="button primary" onClick={() => void approve()} disabled={busy === "approve"}><Check size={16} />{busy === "approve" ? "Aprobando…" : "Aprobar como responsable"}</button></div>}{approval.status === "APPROVED" && !settlement && <div className="stage-action"><button className="button primary" onClick={() => void settle()} disabled={busy === "settle"}><CircleDollarSign size={16} />{busy === "settle" ? "Aplicando en ledger…" : "A5: aplicar pago en ledger"}</button></div>}</section>}

        {settlement && <section className="demo-stage panel result-stage"><div className="result-mark"><CheckCircle2 /></div><div><small>PASOS 7–9 · A5 + A4 + AUDITORÍA</small><h2>Pago aplicado y métricas recalculadas</h2><p>Referencia de ledger <strong>{settlement.reference}</strong>. La factura, el pago, el caso y los indicadores cambiaron dentro de una transacción controlada.</p></div>{before && after && <div className="comparison-grid"><Comparison label="Pagos pendientes" before={String(before.unmatchedPayments)} after={String(after.unmatchedPayments)} /><Comparison label="Cartera abierta" before={money(before.openAmount)} after={money(after.openAmount)} /><Comparison label="Tasa aplicada" before={`${before.reconciliationRate.toFixed(1)}%`} after={`${after.reconciliationRate.toFixed(1)}%`} /></div>}<div className="demo-audit"><h3><Database size={16} /> Evidencia registrada</h3>{events.map((event) => <div key={event.id}><span className="activity-dot" /><strong>{event.action.replaceAll("_", " ")}</strong><small>{event.user?.fullName || "Sistema"} · {dateTime(event.createdAt)}</small></div>)}</div></section>}
      </main>
    </div>
  </div>;
}

function StatusDot({ label, value, warning = false }: { label: string; value?: string; warning?: boolean }) { return <div className={warning ? "warning" : ""}><i /><span>{label}<strong>{value || "Verificando…"}</strong></span></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Comparison({ label, before, after }: { label: string; before: string; after: string }) { return <div><span>{label}</span><small>{before}</small><ChevronRight size={15} /><strong>{after}</strong></div>; }
