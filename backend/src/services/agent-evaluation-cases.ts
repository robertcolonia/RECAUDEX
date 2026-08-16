import type { AgentCode, AgentToolName } from "./agent-config.js";

export type AgentEvaluationCase = {
  id: string;
  agent: AgentCode;
  category: "CONCEPTUAL" | "OPERATIONAL" | "ANALYTICAL" | "DRAFTING";
  question: string;
  expectedTools: AgentToolName[];
  expectedConcepts: string[];
};

export const agentEvaluationCases: AgentEvaluationCase[] = [
  { id: "a0-cross-billing", agent: "A0", category: "OPERATIONAL", question: "Muestra las facturas actuales que requieren revisión y prioriza responsables.", expectedTools: ["list_invoice_anomalies"], expectedConcepts: ["prioridad", "A1"] },
  { id: "a0-cross-risk", agent: "A0", category: "ANALYTICAL", question: "Analiza el Top-1 y el riesgo operativo actual del ciclo de ingresos.", expectedTools: ["get_matching_metrics", "get_risk_indicators"], expectedConcepts: ["benchmark", "riesgo"] },
  { id: "a1-operational", agent: "A1", category: "OPERATIONAL", question: "¿Qué facturas requieren revisión inmediata?", expectedTools: ["list_invoice_anomalies"], expectedConcepts: ["factura", "revisión"] },
  { id: "a1-conceptual", agent: "A1", category: "CONCEPTUAL", question: "Explica el proceso de aseguramiento de facturación.", expectedTools: [], expectedConcepts: ["integridad", "saldo"] },
  { id: "a2-priorities", agent: "A2", category: "OPERATIONAL", question: "Prioriza la cartera actual sin generar cobranzas improcedentes.", expectedTools: ["list_collection_priorities"], expectedConcepts: ["prioridad", "pago"] },
  { id: "a2-drafting", agent: "A2", category: "DRAFTING", question: "Redacta un ejemplo hipotético de comunicación preventiva de cobranza.", expectedTools: [], expectedConcepts: ["cliente", "verificación"] },
  { id: "a3-pending", agent: "A3", category: "OPERATIONAL", question: "Muestra los pagos actuales pendientes de conciliación.", expectedTools: ["list_unmatched_payments", "list_pending_reconciliations"], expectedConcepts: ["pago", "evidencia"] },
  { id: "a3-twin", agent: "A3", category: "CONCEPTUAL", question: "¿Qué es un Payment Twin y para qué sirve?", expectedTools: [], expectedConcepts: ["intención", "depósito"] },
  { id: "a4-live", agent: "A4", category: "ANALYTICAL", question: "Analiza las métricas actuales Top-1, Top-3 y riesgo operativo.", expectedTools: ["get_matching_metrics", "get_risk_indicators"], expectedConcepts: ["benchmark", "operación"] },
  { id: "a4-conceptual", agent: "A4", category: "CONCEPTUAL", question: "¿Cuál es la diferencia entre Top-1 y Top-3?", expectedTools: [], expectedConcepts: ["primer", "tres"] },
  { id: "a5-ledger", agent: "A5", category: "OPERATIONAL", question: "¿Qué aplicaciones están listas y cuáles figuran actualmente en el ledger?", expectedTools: ["list_ready_applications", "get_settlement_ledger"], expectedConcepts: ["aprobación", "ledger"] },
  { id: "a5-states", agent: "A5", category: "CONCEPTUAL", question: "¿Cuál es la diferencia entre preparado, aprobado y aplicado?", expectedTools: [], expectedConcepts: ["estado", "ledger"] }
];
