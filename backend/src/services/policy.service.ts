import type { MatchCandidate } from "../types.js";

export type PolicyCheck = { code: string; label: string; passed: boolean; detail: string };

export function evaluateReconciliationPolicy(input: { paymentAmount: number; candidates: MatchCandidate[] }) {
  const top = input.candidates[0];
  const second = input.candidates[1];
  const lead = top ? top.score - (second?.score ?? 0) : 0;
  const checks: PolicyCheck[] = [
    { code: "POSITIVE_AMOUNT", label: "Monto de pago válido", passed: input.paymentAmount > 0, detail: input.paymentAmount > 0 ? "Mayor que cero" : "Monto no válido" },
    { code: "CANDIDATE_FOUND", label: "Factura candidata disponible", passed: !!top, detail: top?.externalId || "Sin candidato" },
    { code: "MIN_CONFIDENCE", label: "Confianza mínima del 60%", passed: (top?.score ?? 0) >= 0.6, detail: `${Math.round((top?.score ?? 0) * 100)}%` },
    { code: "EVIDENCE_COUNT", label: "Evidencia suficiente", passed: (top?.signals.length ?? 0) >= 2, detail: `${top?.signals.length ?? 0} señales` },
    { code: "LEAD_MARGIN", label: "Separación frente al segundo candidato", passed: !second || lead >= 0.1, detail: second ? `${Math.round(lead * 100)} puntos` : "Candidato único" },
    { code: "HUMAN_APPROVAL", label: "Aprobación humana obligatoria", passed: true, detail: "Control activo" }
  ];
  const blocking = checks.slice(0, 2).some((check) => !check.passed);
  const highConfidence = !!top && top.score >= 0.85 && checks[3]!.passed && checks[4]!.passed;
  return {
    decision: blocking ? "BLOCKED" : highConfidence ? "APPROVAL_REQUIRED" : "MANUAL_REVIEW",
    checks,
    passed: !blocking,
    summary: blocking ? "El caso quedó bloqueado por una validación crítica." : highConfidence ? "El caso supera las políticas y requiere aprobación humana antes de aplicar." : "El caso requiere revisión humana por evidencia insuficiente o ambigua."
  } as const;
}
