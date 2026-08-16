import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RefreshCw, X } from "lucide-react";
import { api } from "../api/client";
import { money, dateTime } from "../data";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState, PageError, PageLoading } from "./DashboardPage";

type Approval = { id: string; status: string; comment: string | null; requestedAt: string; decidedAt: string | null; requestedBy: { fullName: string }; decidedBy: { fullName: string } | null; case: { confidence: number; payment: { externalId: string; amount: string; currency: string; customer: { legalName: string } | null } } };

export function ApprovalsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["approvals"], queryFn: () => api<{ approvals: Approval[] }>("/api/approvals") });
  const decision = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => api(`/api/approvals/${id}/decision`, { method: "POST", body: JSON.stringify({ status }) }), onSuccess: () => client.invalidateQueries({ queryKey: ["approvals"] }) });
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data) return <PageError retry={() => query.refetch()} />;

  return <>
    <div className="page-heading heading-row"><div><span className="overline dark">CONTROL HUMANO</span><h1>Bandeja de aprobaciones</h1><p>Las acciones financieras permanecen detenidas hasta que un responsable autorizado decida.</p></div><button className="button secondary" onClick={() => query.refetch()}><RefreshCw size={16}/> Actualizar</button></div>
    {decision.isError && <div className="inline-error">{decision.error.message}</div>}
    <div className="approval-grid">{query.data.approvals.length ? query.data.approvals.map((item) => <article className="approval-card" key={item.id}><div className="approval-top"><StatusBadge value={item.status}/><span>{dateTime(item.requestedAt)}</span></div><div className="approval-payment"><span>{item.case.payment.customer?.legalName || "Cliente por identificar"}</span><strong>{money(item.case.payment.amount, item.case.payment.currency)}</strong><small>Pago {item.case.payment.externalId.slice(-10)} · confianza {Math.round(item.case.confidence * 100)}%</small></div><div className="approval-meta"><span>Solicitado por <strong>{item.requestedBy.fullName}</strong></span>{item.decidedBy && <span>Decidido por <strong>{item.decidedBy.fullName}</strong></span>}</div>{item.status === "PENDING" && <div className="approval-actions"><button className="button danger-outline" onClick={() => decision.mutate({ id: item.id, status: "REJECTED" })}><X size={15}/> Rechazar</button><button className="button primary" onClick={() => decision.mutate({ id: item.id, status: "APPROVED" })}><Check size={15}/> Aprobar</button></div>}</article>) : <EmptyState text="No existen solicitudes de aprobación." />}</div>
  </>;
}

