type MonthlyPoint = { month: string; billed: number; collected: number };
type StatusPoint = { key: string; label: string; value: number };
type AmountPoint = { key?: string; month?: string; label?: string; amount: number };
type AgentPoint = { agent: string; cases: number };

export type ControlTowerAnalytics = {
  monthlyRevenue: MonthlyPoint[];
  paymentStatus: StatusPoint[];
  portfolioEvolution: Array<{ month: string; amount: number }>;
  aging: Array<{ key: string; label: string; amount: number }>;
  agentActivity: AgentPoint[];
};

const compact = new Intl.NumberFormat("es-PE", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
const statusColors: Record<string, string> = {
  unmatched: "#2867d8",
  proposed: "#20a5e8",
  pendingApproval: "#f4a51c",
  approved: "#26a269",
  applied: "#18b89d",
  exception: "#e5485d"
};

function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  if (!year || !value) return month;
  return new Intl.DateTimeFormat("es-PE", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, value - 1, 1)))
    .replace(" de ", " ");
}

function maxValue(values: number[]) {
  return Math.max(1, ...values);
}

function yTicks(max: number, count = 4) {
  return Array.from({ length: count + 1 }, (_, index) => max * (1 - index / count));
}

function DataBadge() {
  return <span className="chart-data-badge">DATOS REALES</span>;
}

function ChartPanel({ title, subtitle, className = "", children }: { title: string; subtitle: string; className?: string; children: React.ReactNode }) {
  return <article className={`panel chart-panel ${className}`}>
    <header className="chart-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><DataBadge /></header>
    {children}
  </article>;
}

export function ControlTowerCharts({ analytics }: { analytics: ControlTowerAnalytics }) {
  return <section className="control-charts" aria-label="Analítica del ciclo de ingresos">
    <ChartPanel title="Facturado vs. cobrado por mes" subtitle="Importes registrados en facturas y pagos" className="chart-wide">
      <GroupedBars data={analytics.monthlyRevenue} />
    </ChartPanel>
    <ChartPanel title="Estado de pagos" subtitle="Distribución del flujo de conciliación">
      <StatusDonut data={analytics.paymentStatus} />
    </ChartPanel>
    <ChartPanel title="Evolución de cartera" subtitle="Saldo abierto por mes de emisión">
      <AreaChart data={analytics.portfolioEvolution} />
    </ChartPanel>
    <ChartPanel title="Aging de cartera" subtitle="Saldo abierto por días de vencimiento">
      <AgingBars data={analytics.aging} />
    </ChartPanel>
    <ChartPanel title="Actividad por agente" subtitle="Consultas especializadas registradas en auditoría">
      <AgentLine data={analytics.agentActivity} />
    </ChartPanel>
  </section>;
}

function GroupedBars({ data }: { data: MonthlyPoint[] }) {
  const width = 760, height = 260, left = 58, right = 16, top = 14, bottom = 42;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const max = maxValue(data.flatMap((item) => [item.billed, item.collected]));
  const groupWidth = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(24, groupWidth * .3);
  return <div className="chart-canvas"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de barras de facturación y cobranza mensual">
    {yTicks(max).map((tick, index) => { const y = top + index * plotHeight / 4; return <g key={index}><line x1={left} x2={width - right} y1={y} y2={y} className="chart-grid-line" /><text x={left - 9} y={y + 4} textAnchor="end" className="chart-axis-label">{compact.format(tick)}</text></g>; })}
    {data.map((item, index) => {
      const center = left + groupWidth * (index + .5);
      const billedHeight = item.billed / max * plotHeight, collectedHeight = item.collected / max * plotHeight;
      return <g key={item.month}>
        <rect x={center - barWidth - 2} y={top + plotHeight - billedHeight} width={barWidth} height={billedHeight} rx="3" fill="#2867d8"><title>{monthLabel(item.month)} · Facturado: S/ {integer.format(item.billed)}</title></rect>
        <rect x={center + 2} y={top + plotHeight - collectedHeight} width={barWidth} height={collectedHeight} rx="3" fill="#16a5e9"><title>{monthLabel(item.month)} · Cobrado: S/ {integer.format(item.collected)}</title></rect>
        <text x={center} y={height - 17} textAnchor="middle" className="chart-axis-label">{monthLabel(item.month)}</text>
      </g>;
    })}
  </svg><div className="chart-legend"><span><i style={{ background: "#2867d8" }} />Facturado</span><span><i style={{ background: "#16a5e9" }} />Cobrado</span></div></div>;
}

function StatusDonut({ data }: { data: StatusPoint[] }) {
  const visible = data.filter((item) => item.value > 0);
  const total = visible.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient = visible.length ? visible.map((item) => {
    const start = cursor;
    cursor += item.value / total * 100;
    return `${statusColors[item.key] ?? "#8a98a8"} ${start}% ${cursor}%`;
  }).join(",") : "#e8eef4 0 100%";
  return <div className="donut-layout">
    <div className="donut" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={`Estado de ${total} pagos`}><div><strong>{integer.format(total)}</strong><span>pagos</span></div></div>
    <div className="donut-legend">{data.map((item) => <div key={item.key}><i style={{ background: statusColors[item.key] ?? "#8a98a8" }} /><span>{item.label}</span><strong>{integer.format(item.value)}</strong></div>)}</div>
  </div>;
}

function AreaChart({ data }: { data: AmountPoint[] }) {
  const width = 520, height = 230, left = 54, right = 12, top = 14, bottom = 38;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const max = maxValue(data.map((item) => item.amount));
  const points = data.map((item, index) => ({ ...item, x: left + (data.length === 1 ? plotWidth / 2 : index * plotWidth / Math.max(data.length - 1, 1)), y: top + plotHeight - item.amount / max * plotHeight }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length ? `${left},${top + plotHeight} ${line} ${left + plotWidth},${top + plotHeight}` : "";
  return <div className="chart-canvas"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de evolución de cartera">
    <defs><linearGradient id="portfolio-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2a51a" stopOpacity=".32" /><stop offset="100%" stopColor="#f2a51a" stopOpacity=".04" /></linearGradient></defs>
    {yTicks(max).map((tick, index) => { const y = top + index * plotHeight / 4; return <g key={index}><line x1={left} x2={width - right} y1={y} y2={y} className="chart-grid-line" /><text x={left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">{compact.format(tick)}</text></g>; })}
    {area && <polygon points={area} fill="url(#portfolio-fill)" />}
    {line && <polyline points={line} fill="none" stroke="#f2a51a" strokeWidth="2.5" strokeLinejoin="round" />}
    {points.map((point) => <g key={point.month}><circle cx={point.x} cy={point.y} r="3" fill="#fff" stroke="#f2a51a" strokeWidth="2"><title>{monthLabel(point.month ?? "")} · S/ {integer.format(point.amount)}</title></circle><text x={point.x} y={height - 14} textAnchor="middle" className="chart-axis-label">{monthLabel(point.month ?? "")}</text></g>)}
  </svg></div>;
}

function AgingBars({ data }: { data: AmountPoint[] }) {
  const width = 520, height = 230, left = 54, right = 12, top = 14, bottom = 38;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const max = maxValue(data.map((item) => item.amount));
  const slot = plotWidth / Math.max(data.length, 1), barWidth = Math.min(62, slot * .68);
  return <div className="chart-canvas"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de antigüedad de cartera">
    {yTicks(max).map((tick, index) => { const y = top + index * plotHeight / 4; return <g key={index}><line x1={left} x2={width - right} y1={y} y2={y} className="chart-grid-line" /><text x={left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">{compact.format(tick)}</text></g>; })}
    {data.map((item, index) => { const barHeight = item.amount / max * plotHeight, x = left + slot * index + (slot - barWidth) / 2; return <g key={item.key}><rect x={x} y={top + plotHeight - barHeight} width={barWidth} height={barHeight} rx="4" fill={index === data.length - 1 ? "#d9273e" : "#e6485c"}><title>{item.label} días · S/ {integer.format(item.amount)}</title></rect><text x={x + barWidth / 2} y={height - 14} textAnchor="middle" className="chart-axis-label">{item.label}</text></g>; })}
  </svg></div>;
}

function AgentLine({ data }: { data: AgentPoint[] }) {
  const width = 520, height = 230, left = 46, right = 14, top = 14, bottom = 38;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const max = maxValue(data.map((item) => item.cases));
  const points = data.map((item, index) => ({ ...item, x: left + index * plotWidth / Math.max(data.length - 1, 1), y: top + plotHeight - item.cases / max * plotHeight }));
  return <div className="chart-canvas"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de consultas por agente">
    {yTicks(max).map((tick, index) => { const y = top + index * plotHeight / 4; return <g key={index}><line x1={left} x2={width - right} y1={y} y2={y} className="chart-grid-line" /><text x={left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">{integer.format(tick)}</text></g>; })}
    <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#2867d8" strokeWidth="2.5" strokeLinejoin="round" />
    {points.map((point) => <g key={point.agent}><circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#2867d8" strokeWidth="2.5"><title>{point.agent} · {integer.format(point.cases)} consultas</title></circle><text x={point.x} y={height - 14} textAnchor="middle" className="chart-axis-label chart-agent-label">{point.agent}</text></g>)}
  </svg></div>;
}
