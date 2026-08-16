import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "../api/client";
import { dateTime } from "../data";
import { EmptyState, PageError, PageLoading } from "./DashboardPage";

type Event = { id: string; action: string; entityType: string; entityId: string | null; detail: unknown; ipAddress: string | null; createdAt: string; user: { fullName: string; email: string } | null };

export function AuditPage() {
  const query = useQuery({ queryKey: ["audit"], queryFn: () => api<{ events: Event[] }>("/api/audit") });
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data) return <PageError retry={() => query.refetch()} />;
  return <>
    <div className="page-heading heading-row"><div><span className="overline dark">TRAZABILIDAD</span><h1>Registro de auditoría</h1><p>Evidencia cronológica de accesos, consultas, decisiones y ejecuciones.</p></div><button className="button secondary" onClick={() => query.refetch()}><RefreshCw size={16}/> Actualizar</button></div>
    <div className="table-panel"><table><thead><tr><th>Fecha</th><th>Evento</th><th>Entidad</th><th>Responsable</th><th>Origen</th></tr></thead><tbody>{query.data.events.map((event) => <tr key={event.id}><td>{dateTime(event.createdAt)}</td><td><span className="event-name"><ShieldCheck size={15}/>{event.action.replaceAll("_", " ")}</span></td><td>{event.entityType}</td><td>{event.user?.fullName || "Sistema"}</td><td>{event.ipAddress || "Proceso interno"}</td></tr>)}</tbody></table>{!query.data.events.length && <EmptyState text="Todavía no existen eventos de auditoría." />}</div>
  </>;
}

