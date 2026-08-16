import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bot, CheckCircle2, CircleDollarSign, FileClock, Landmark, PlayCircle, RefreshCw, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ControlTowerCharts, type ControlTowerAnalytics } from "../components/ControlTowerCharts";
import { useAuth } from "../context/AuthContext";
import { agents, dateTime, money } from "../data";

type Dashboard = {
  metrics: { customers: number; invoices: number; openInvoices: number; openAmount: number; payments: number; collectedAmount: number; unmatchedPayments: number; pendingApprovals: number; reconciliationRate: number };
  analytics: ControlTowerAnalytics;
  recentActivity: Array<{ id: string; action: string; entityType: string; createdAt: string; user: { fullName: string } | null }>;
};

export function DashboardPage() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/api/dashboard") });
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data) return <PageError retry={() => query.refetch()} />;
  const { metrics, analytics, recentActivity } = query.data;

  return <>
    <div className="page-heading heading-row"><div><span className="overline dark">VISIÓN EJECUTIVA</span><h1>Torre de control</h1><p>Estado consolidado del ciclo de ingresos de {user?.organizationName || "la organización"}.</p></div><div className="heading-actions"><Link className="button primary" to="/demo"><PlayCircle size={16} /> Iniciar demo MVP</Link><button className="button secondary" onClick={() => query.refetch()}><RefreshCw size={16} /> Actualizar</button></div></div>
    <section className="metric-grid">
      <Metric icon={<CircleDollarSign />} label="Cartera abierta" value={money(metrics.openAmount)} note={`${metrics.openInvoices.toLocaleString("es-PE")} facturas abiertas`} tone="mint" />
      <Metric icon={<Landmark />} label="Recaudo registrado" value={money(metrics.collectedAmount)} note={`${metrics.payments.toLocaleString("es-PE")} movimientos`} tone="blue" />
      <Metric icon={<FileClock />} label="Pagos por conciliar" value={metrics.unmatchedPayments.toLocaleString("es-PE")} note="Requieren identificación o validación" tone="amber" />
      <Metric icon={<CheckCircle2 />} label="Tasa aplicada" value={`${metrics.reconciliationRate.toFixed(1)}%`} note={`${metrics.pendingApprovals} aprobaciones pendientes`} tone="violet" />
    </section>
    <ControlTowerCharts analytics={analytics} />
    <section className="dashboard-grid">
      <div className="panel agents-panel">
        <div className="panel-heading"><div><h2>Red de agentes</h2><p>Selecciona un dominio para consultar su información.</p></div><Bot size={20} /></div>
        <div className="agent-cards">{agents.map((agent) => <Link to={`/agentes/${agent.code}`} className="agent-card" key={agent.code}><span className="agent-code" style={{ color: agent.color, borderColor: `${agent.color}55`, background: `${agent.color}12` }}>{agent.code}</span><div><strong>{agent.name}</strong><span>{agent.domain}</span></div><ArrowRight size={17} /></Link>)}</div>
      </div>
      <div className="panel activity-panel">
        <div className="panel-heading"><div><h2>Actividad reciente</h2><p>Últimos eventos registrados.</p></div></div>
        <div className="activity-list">{recentActivity.length ? recentActivity.map((event) => <div className="activity-item" key={event.id}><span className="activity-dot" /><div><strong>{event.action.replaceAll("_", " ")}</strong><span>{event.user?.fullName || "Sistema"} · {event.entityType}</span></div><time>{dateTime(event.createdAt)}</time></div>) : <EmptyState text="La actividad aparecerá después de las primeras operaciones." />}</div>
      </div>
    </section>
    <section className="portfolio-strip"><div><Users /><span><strong>{metrics.customers.toLocaleString("es-PE")}</strong> clientes B2B</span></div><div><FileClock /><span><strong>{metrics.invoices.toLocaleString("es-PE")}</strong> facturas analizadas</span></div><div><Landmark /><span><strong>{metrics.payments.toLocaleString("es-PE")}</strong> pagos importados</span></div></section>
  </>;
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <article className={`metric-card tone-${tone}`}><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

export function PageLoading() { return <div className="page-state"><div className="spinner" /><span>Cargando información…</span></div>; }
export function PageError({ retry }: { retry: () => void }) { return <div className="page-state error-state"><strong>No pudimos consultar el backend.</strong><span>Comprueba que la API y PostgreSQL estén disponibles.</span><button className="button secondary" onClick={retry}>Reintentar</button></div>; }
export function EmptyState({ text }: { text: string }) { return <div className="empty-state">{text}</div>; }
