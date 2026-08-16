ALTER TABLE "ReconciliationCase" ADD COLUMN "policyDecision" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ReconciliationCase" ADD COLUMN "policyChecks" JSONB;
ALTER TABLE "ReconciliationCase" ADD COLUMN "policyEvaluatedAt" TIMESTAMP(3);

UPDATE "ReconciliationCase"
SET "policyDecision" = CASE WHEN "confidence" >= 0.85 THEN 'APPROVAL_REQUIRED' ELSE 'MANUAL_REVIEW' END,
    "policyChecks" = jsonb_build_array(
      jsonb_build_object('code', 'LEGACY_CONFIDENCE', 'label', 'Confianza mínima', 'passed', "confidence" >= 0.60, 'detail', CONCAT(ROUND(("confidence" * 100)::numeric, 0), '%')),
      jsonb_build_object('code', 'HUMAN_APPROVAL', 'label', 'Aprobación humana obligatoria', 'passed', true, 'detail', 'Control activo')
    ),
    "policyEvaluatedAt" = "createdAt";
