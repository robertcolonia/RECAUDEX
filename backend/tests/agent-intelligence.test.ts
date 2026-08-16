import assert from "node:assert/strict";
import test from "node:test";
import { agentProfiles, buildSystemInstruction, type AgentCode } from "../src/services/agent-config.js";
import { selectToolsForMessage, type ToolExecution } from "../src/services/agent-tools.service.js";
import { buildExpertAnswer } from "../src/services/expert-engine.service.js";

test("cada agente selecciona únicamente herramientas de su especialidad", () => {
  const questions: Record<AgentCode, string> = {
    A0: "Resume las prioridades del ciclo de ingresos",
    A1: "¿Qué facturas requieren revisión?",
    A2: "Prioriza la cartera para cobranza",
    A3: "¿Cuál es el estado de conciliación?",
    A4: "Explica la precisión Top-1 y el riesgo",
    A5: "¿Qué casos están listos para aplicar?"
  };
  for (const code of Object.keys(agentProfiles) as AgentCode[]) {
    const selected = selectToolsForMessage(code, questions[code]);
    assert.ok(selected.length > 0, `${code} debe seleccionar contexto`);
    for (const tool of selected) assert.ok(agentProfiles[code].tools.includes(tool.name as never), `${tool.name} debe estar autorizado para ${code}`);
  }
});

test("un saludo no consume consultas operativas innecesarias", () => {
  assert.deepEqual(selectToolsForMessage("A3", "Hola"), []);
});

test("las preguntas sobre el proveedor y las continuaciones cortas no disparan métricas", () => {
  assert.deepEqual(selectToolsForMessage("A0", "¿Qué IA usas?"), []);
  assert.deepEqual(selectToolsForMessage("A0", "¿Por qué cambiaste?"), []);
  assert.deepEqual(selectToolsForMessage("A0", "¿Qué?"), []);
  assert.match(buildExpertAnswer("A0", "¿Qué IA usas?", []), /modelo principal/i);
  assert.match(buildExpertAnswer("A0", "¿Por qué cambiaste?", []), /alterna automáticamente/i);
  assert.doesNotMatch(buildExpertAnswer("A0", "¿Qué?", []), /S\/ 0\.00/);
});

test("las consultas conceptuales y de elaboración se resuelven sin forzar datos operativos", () => {
  assert.deepEqual(selectToolsForMessage("A3", "¿Qué es un Payment Twin y para qué sirve?"), []);
  assert.deepEqual(selectToolsForMessage("A2", "Redacta un ejemplo hipotético de comunicación preventiva"), []);
});

test("A0 puede orquestar consultas de todas las especialidades", () => {
  const billing = selectToolsForMessage("A0", "Muestra las facturas actuales que requieren revisión");
  const settlement = selectToolsForMessage("A0", "¿Qué aplicaciones están listas y cuáles figuran en el ledger?");
  assert.ok(billing.some((item) => item.name === "list_invoice_anomalies"));
  assert.ok(settlement.some((item) => item.name === "list_ready_applications"));
  assert.ok(agentProfiles.A0.tools.includes("get_settlement_ledger"));
});

test("A0 lista depósitos reales y combina facturación con recaudo", () => {
  const deposits = selectToolsForMessage("A0", "¿Cuáles son los primeros depósitos pendientes?");
  assert.ok(deposits.some((item) => item.name === "list_unmatched_payments"));
  const cross = selectToolsForMessage("A0", "Tenemos depósitos sin referencia y facturas vencidas. Analiza el problema transversal.");
  assert.ok(cross.some((item) => item.name === "list_invoice_anomalies"));
  assert.ok(cross.some((item) => item.name === "list_unmatched_payments"));

  const evidence: ToolExecution[] = [
    { name: "list_unmatched_payments", label: "Pagos", args: {}, result: [{ externalId: "PAY-900", bankOperation: null, amount: 4500, customer: null }] },
    { name: "list_pending_reconciliations", label: "Casos", args: {}, result: [] }
  ];
  const answer = buildExpertAnswer("A0", "Muestra los primeros depósitos", evidence);
  assert.match(answer, /PAY-900/);
  assert.match(answer, /A3 debe validar/i);
});

test("cada instrucción cubre consultas abiertas y conocimiento de dominio", () => {
  for (const code of Object.keys(agentProfiles) as AgentCode[]) {
    const instruction = buildSystemInstruction(code);
    assert.match(instruction, /MODOS DE CONSULTA QUE DEBES RESOLVER/);
    assert.match(instruction, /CONOCIMIENTO ESPECIALIZADO/);
    assert.match(instruction, /No uses una respuesta prefabricada/);
  }
});

test("A3 solicita identificador cuando la cuenta es ambigua y conserva contexto operativo", () => {
  const evidence: ToolExecution[] = [
    { name: "list_pending_reconciliations", label: "Casos de conciliación", args: {}, result: [{ confidence: 0.95, policyDecision: "APPROVAL_REQUIRED", payment: { externalId: "PAY-001", amount: 2500 } }] },
    { name: "list_unmatched_payments", label: "Pagos sin aplicar", args: {}, result: [{ externalId: "PAY-002", amount: 1000 }] }
  ];
  const answer = buildExpertAnswer("A3", "¿Cómo va mi cuenta?", evidence);
  assert.match(answer, /RUC o razón social/i);
  assert.match(answer, /PAY-001/);
  assert.match(answer, /95\.00%/);
});

test("A4 diferencia benchmark de confianza operativa", () => {
  const evidence: ToolExecution[] = [
    { name: "get_matching_metrics", label: "Métricas", args: {}, result: { benchmark: { top1: 0.8638, top3: 0.9954, verifiedRelations: 3474 }, live: { cases: 10, averageConfidence: 0.91, manualReview: 2 } } },
    { name: "get_risk_indicators", label: "Riesgo", args: {}, result: { agingPEN: { over90: 5000 }, unmatchedPayments: 3, unmatchedAmount: 1200 } }
  ];
  const answer = buildExpertAnswer("A4", "Explica las métricas", evidence);
  assert.match(answer, /86\.38%/);
  assert.match(answer, /99\.54%/);
  assert.match(answer, /no debe presentarse como precisión real/i);
});
