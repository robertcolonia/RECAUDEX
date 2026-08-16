export const agents = [
  { code: "A0", name: "Supervisor de Ingresos", domain: "Coordinación integral", color: "#2dd4bf", prompt: "Resume las prioridades del ciclo de ingresos y propón un plan de acción.", suggestions: ["¿Cuál es el estado general del ciclo de ingresos?", "Prioriza los tres principales bloqueos operativos.", "¿Qué debería mostrar a Dirección hoy?"] },
  { code: "A1", name: "Aseguramiento de Facturación", domain: "Facturación", color: "#60a5fa", prompt: "Identifica facturas vencidas o señales que requieran revisión.", suggestions: ["¿Qué facturas requieren revisión inmediata?", "Muéstrame las mayores exposiciones vencidas.", "Busca la factura S5AA-0040413241."] },
  { code: "A2", name: "Gestión de Cobranzas", domain: "Cobranzas", color: "#a78bfa", prompt: "Prioriza la cartera que debe gestionarse y explica el criterio.", suggestions: ["¿A qué clientes debemos contactar primero?", "Prioriza la cobranza por monto y antigüedad.", "¿Cómo evitamos cobrar una deuda ya pagada?"] },
  { code: "A3", name: "Conciliación de Pagos", domain: "Recaudo", color: "#34d399", prompt: "Explica los casos de conciliación con mayor confianza.", suggestions: ["¿Cuál es el estado actual de conciliación?", "Muéstrame los pagos sin aplicar de mayor monto.", "¿Cómo usa A3 el Payment Twin?"] },
  { code: "A4", name: "Analítica de Ingresos", domain: "Inteligencia financiera", color: "#f59e0b", prompt: "Interpreta los indicadores actuales y señala los principales riesgos.", suggestions: ["Explica Top-1 y Top-3 sin confundirlos con confianza.", "¿Cuál es el riesgo actual de la cartera?", "¿Qué métricas demuestran el impacto del MVP?"] },
  { code: "A5", name: "Aplicación y Rebaja", domain: "Aplicación financiera", color: "#fb7185", prompt: "Indica qué casos aprobados están listos para aplicación.", suggestions: ["¿Qué casos están listos para aplicar?", "Muéstrame las últimas aplicaciones del ledger.", "¿Qué controles impiden una rebaja no autorizada?"] }
] as const;

export const roleLabels: Record<string, string> = {
  DIRECTION: "Dirección General",
  BILLING: "Facturación",
  COLLECTIONS: "Cobranzas",
  RECONCILIATION: "Recaudo",
  FINANCE: "Finanzas",
  BI: "Inteligencia de negocio",
  ADMIN: "Administración"
};

export const money = (value: number | string | null | undefined, currency = "PEN") =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));

export const dateTime = (value: string) => new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
