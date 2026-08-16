import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, ChevronRight, Play, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { api } from "../api/client";
import { money } from "../data";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState, PageError, PageLoading } from "./DashboardPage";

type Candidate = { invoiceId: string; externalId: string; openAmount: number; score: number; signals: string[] };
type Reconciliation = {
  id: string; status: string; confidence: number; rationale: string; candidates: Candidate[];
  policyDecision: string; policyChecks: Array<{ code: string; label: string; passed: boolean; detail: string }> | null;
  payment: { externalId: string; amount: string; currency: string; paidAt: string; customer: { legalName: string; taxId: string } | null };
  approval: { id: string; status: string } | null;
  settlement: { id: string; reference: string } | null;
};

export function ReconciliationPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["reconciliations"], queryFn: () => api<{ cases: Reconciliation[] }>("/api/reconciliations") });
  const refresh = () => client.invalidateQueries({ queryKey: ["reconciliations"] });
  const generate = useMutation({ mutationFn: () => api<{ created: number }>("/api/reconciliations/generate", { method: "POST" }), onSuccess: refresh });
  const request = useMutation({ mutationFn: (caseId: string) => api(`/api/approvals/request/${caseId}`, { method: "POST" }), onSuccess: refresh });
  const settle = useMutation({ mutationFn: (caseId: string) => api(`/api/settlements/${caseId}/execute`, { method: "POST", body: "{}" }), onSuccess: refresh });
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data) return <PageError retry={() => query.refetch()} />;

  return <>
    <div className="page-heading heading-row"><div><span className="overline dark">AGENTE A3</span><h1>Conciliación de pagos</h1><p>Candidatos explicables generados por señales de monto, cliente, cuenta, fecha y referencia.</p></div><button className="button primary" onClick={() => generate.mutate()} disabled={generate.isPending}><Play size={16} /> {generate.isPending ? "Analizando…" : "Analizar pendientes"}</button></div>
    {(generate.isError || request.isError || settle.isError) && <div className="inline-error">{String((generate.error || request.error || settle.error)?.message || "No fue posible completar la operación.")}</div>}
    <div className="summary-row"><span><strong>{query.data.cases.length}</strong> casos</span><span><strong>{query.data.cases.filter((item) => item.confidence >= .85).length}</strong> alta confianza</span><button className="icon-button" onClick={() => query.refetch()} aria-label="Actualizar"><RefreshCw size={16} /></button></div>
    <div className="cases-list">{query.data.cases.length ? query.data.cases.map((item) => {
      const top = item.candidates[0];
      return <article className="case-card" key={item.id}>
        <div className="case-main"><div className="case-payment"><span className="case-icon"><Bot size={19} /></span><div><span>Pago {item.payment.externalId.slice(-10)}</span><strong>{money(item.payment.amount, item.payment.currency)}</strong><small>{item.payment.customer?.legalName || "Pagador por identificar"}</small></div></div><ChevronRight className="case-arrow"/><div className="case-candidate"><span>Factura recomendada</span><strong>{top?.externalId || "Sin candidato"}</strong><small>{top ? money(top.openAmount, item.payment.currency) : "—"}</small></div></div>
        <div className="confidence-block"><div><span>Confianza</span><strong>{Math.round(item.confidence * 100)}%</strong></div><div className="confidence-track"><i style={{ width: `${item.confidence * 100}%` }} /></div><p>{item.rationale}</p></div>
        <div className="case-footer"><StatusBadge value={item.settlement ? "SETTLED" : item.status} /><span className="policy-chip"><ShieldCheck size={12} /> {item.policyDecision.replaceAll("_", " ")}</span><div className="signal-list">{top?.signals.slice(0, 3).map((signal) => <span key={signal}>{signal}</span>)}</div><div className="case-actions">{!item.approval && !item.settlement && item.policyDecision !== "BLOCKED" && <button className="button small secondary" onClick={() => request.mutate(item.id)}><Send size={14} /> Solicitar aprobación</button>}{item.approval?.status === "APPROVED" && !item.settlement && <button className="button small primary" onClick={() => settle.mutate(item.id)}><Play size={14} /> Ejecutar aplicación</button>}{item.settlement && <span className="reference">{item.settlement.reference}</span>}</div></div>
      </article>;
    }) : <EmptyState text="No existen casos. Ejecuta el análisis para generar candidatos sobre los pagos pendientes." />}</div>
  </>;
}
