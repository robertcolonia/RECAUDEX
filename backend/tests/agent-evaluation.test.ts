import assert from "node:assert/strict";
import test from "node:test";
import { agentEvaluationCases } from "../src/services/agent-evaluation-cases.js";
import { agentProfiles } from "../src/services/agent-config.js";
import { supportsDeepAnalysis } from "../src/services/agent.service.js";
import { selectToolsForMessage } from "../src/services/agent-tools.service.js";

test("el banco de evaluación cubre todos los agentes y categorías", () => {
  const agents = new Set(agentEvaluationCases.map((item) => item.agent));
  for (const code of Object.keys(agentProfiles)) assert.ok(agents.has(code as never), `${code} debe tener evaluaciones`);
  assert.ok(agentEvaluationCases.some((item) => item.category === "CONCEPTUAL"));
  assert.ok(agentEvaluationCases.some((item) => item.category === "OPERATIONAL"));
  assert.ok(agentEvaluationCases.some((item) => item.category === "ANALYTICAL"));
  assert.ok(agentEvaluationCases.some((item) => item.category === "DRAFTING"));
});

test("cada consulta de evaluación selecciona sus fuentes esperadas y respeta permisos", () => {
  for (const item of agentEvaluationCases) {
    const selected = selectToolsForMessage(item.agent, item.question);
    const names = selected.map((tool) => tool.name);
    for (const expected of item.expectedTools) assert.ok(names.includes(expected), `${item.id} debe consultar ${expected}`);
    for (const name of names) assert.ok(agentProfiles[item.agent].tools.includes(name as never), `${item.id} no debe usar ${name}`);
    if (!item.expectedTools.length) assert.deepEqual(selected, [], `${item.id} debe responder con conocimiento especializado sin forzar datos`);
  }
});

test("el modo profundo está limitado a supervisor y analítica", () => {
  assert.equal(supportsDeepAnalysis("A0"), true);
  assert.equal(supportsDeepAnalysis("A4"), true);
  for (const code of ["A1", "A2", "A3", "A5"] as const) assert.equal(supportsDeepAnalysis(code), false);
});
