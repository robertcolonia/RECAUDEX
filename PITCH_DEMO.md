# Guion de demostración del MVP RECAUDEX

Duración recomendada: 3 a 4 minutos.

## Preparación

1. Inicia sesión con `direccion@recaudex.app`.
2. Abre **Demo MVP** desde el menú.
3. Verifica la barra superior: API y PostgreSQL deben aparecer en línea.
4. Si Gemini muestra **Clave pendiente**, el flujo financiero seguirá funcionando, pero el chat usará el motor analítico local. Para presentar IA generativa, configura `GEMINI_API_KEY` antes del pitch.

Como evidencia adicional de viabilidad, abre brevemente **Importar datos**, selecciona **Pagos y recaudo** y muestra la vista previa de un CSV/XLSX. Explica que RECAUDEX valida el archivo antes de incorporarlo y que esta capa funciona como puente con reportes bancarios, SQL Server, Teradata y facturadores mientras se construyen integraciones API. No dediques más de 20 segundos a esta pantalla.

## Recorrido que debe mostrarse

1. **A0 / Control Tower:** presenta cartera abierta, pagos pendientes y tasa aplicada.
2. **Pago:** selecciona un movimiento bancario real del dataset sintético.
3. **A3 / Matching:** pulsa **Generar candidatos reales**.
4. **Evidencia:** muestra Top-1, Top-2, Top-3, confianza y señales utilizadas.
5. **Policy Engine:** explica los seis controles almacenados en PostgreSQL. Ningún pago se aplica automáticamente.
6. **Aprobación humana:** solicita y aprueba el caso como Dirección.
7. **A5 / Ledger:** aplica el pago y muestra la referencia `APL-*` generada.
8. **A4:** compara pagos pendientes, cartera y tasa aplicada antes y después.
9. **Auditoría:** muestra los eventos `MATCH_CANDIDATES_GENERATED`, `POLICY_EVALUATED`, `APPROVAL_REQUESTED`, `APPROVAL_APPROVED`, `PAYMENT_SETTLED` e `INDICATORS_RECALCULATED`.

## Frase para el pitch

“No estamos mostrando pantallas simuladas. Este pago fue seleccionado del dataset, A3 generó candidatos, las políticas quedaron persistidas, una persona autorizó la decisión, A5 modificó el ledger y A4 recalculó los indicadores; toda la secuencia quedó auditada en PostgreSQL.”

## Indicadores defendibles

- Benchmark Top-1: **86.38%** sobre 3,474 relaciones verificables.
- Benchmark Top-3: **99.54%**.
- Intervención humana: medible por casos `MANUAL_REVIEW` frente al total.
- Tiempo hasta aplicación: diferencia entre creación del caso y ejecución del settlement.
- Pagos pendientes: contador antes y después de la aplicación.
- Tasa aplicada: settlements sobre casos generados.

El benchmark debe explicarse indicando que la factura asociada se oculta durante el ranking y se usa únicamente para validar el resultado.
