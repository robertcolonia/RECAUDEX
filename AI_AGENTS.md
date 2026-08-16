# Agentes especializados de RECAUDEX

## Arquitectura elegida

```text
Pregunta del usuario
        │
        ▼
Memoria corta + instrucciones del agente
        │
        ├── herramientas autorizadas ──► API RECAUDEX ──► PostgreSQL
        │
        ├── modo rápido ───────────────► Gemini 3.7 Flash
        │                                      │ cuota o indisponibilidad
        │                                      ▼
        │                              Gemini 3.5 Flash-Lite
        │
        └── modo profundo A0/A4 ──────► Gemini 3.1 Pro Preview
                                            │
                error o presupuesto agotado ├──► Gemini 3.7 Flash
                                             └──► RECAUDEX Expert Engine
```

El backend conserva el control. El modelo nunca recibe la cadena de conexión, no genera SQL, no accede a otra organización y no ejecuta operaciones financieras. Sus herramientas llaman funciones limitadas por agente y organización; políticas determinísticas, roles y aprobaciones gobiernan cualquier cambio financiero.

## Especialización real

| Agente | Responsabilidad | Herramientas principales |
|---|---|---|
| A0 | Supervisión transversal y priorización | Indicadores, pipeline, riesgo y auditoría |
| A1 | Aseguramiento de facturación | Anomalías, vencimientos, búsqueda de factura y cliente |
| A2 | Gestión de cobranza | Priorización de cartera, vencimientos, cliente y Payment Twin |
| A3 | Identificación y conciliación | Pagos sin aplicar, casos, evidencia y Payment Twin |
| A4 | Analítica e impacto | Top-1/Top-3, confianza viva, aging y pipeline |
| A5 | Aplicación controlada | Casos aprobados, detalle, ledger y auditoría |

## Activación de Gemini

1. En Google AI Studio utiliza un único proyecto y una única clave para el backend; no debes crear seis agentes allí.
2. Si el proyecto aparece en **Nivel gratuito**, selecciona **Configurar la facturación**. La suscripción personal Google AI Pro no activa por sí sola la facturación de la API.
3. En desarrollo, coloca una clave nueva en `backend/.env` como `GEMINI_API_KEY`.
4. En Render, guárdala en el servicio `recaudex-api` como variable secreta con el mismo nombre.
5. Reinicia el backend. El centro de trabajo mostrará **Google Gemini**.

Nunca guardes la clave en React, GitHub, capturas ni conversaciones. Si una clave fue compartida públicamente, revócala y genera otra antes de publicar.

No actives Google Search para responder sobre facturas, pagos o clientes. La fuente de verdad de esos datos son las herramientas de PostgreSQL. AI Studio sirve para administrar la clave y probar el modelo; la especialización, permisos y herramientas viven en el backend de RECAUDEX.

## Preguntas recomendadas para el pitch

1. A0: “¿Cuál es el estado general del ciclo de ingresos y qué debemos priorizar?”
2. A1: “¿Qué facturas requieren revisión inmediata?”
3. A2: “¿A qué clientes debemos contactar primero y cómo evitamos una cobranza improcedente?”
4. A3: “¿Cómo usa A3 el Payment Twin?” y luego consulta un pago o caso visible.
5. A4: “Explica Top-1, Top-3 y confianza operativa sin confundirlos.”
6. A5: “¿Qué casos están aprobados y cuáles ya figuran en el ledger?”

Debajo de cada respuesta se muestran proveedor, modelo, nivel de sustento, herramientas consultadas, consumo de tokens y latencia. **Datos verificados** significa que se consultó PostgreSQL. **Confianza del caso** es la puntuación calculada por el motor de conciliación, no una probabilidad inventada por el modelo. **Evidencia limitada** advierte que la consulta no devolvió información suficiente.

En A0 y A4 aparece el selector **Rápido / Análisis profundo**. El modo profundo se reserva para decisiones complejas; A1, A2, A3 y A5 permanecen en Flash porque sus operaciones requieren respuestas rápidas y controles determinísticos.

## Control de consumo

Los valores se configuran como variables del backend:

```text
AI_MAX_OUTPUT_TOKENS=900
AI_THINKING_BUDGET=256
AI_HISTORY_MESSAGES=10
AI_DAILY_TOKEN_BUDGET=250000
AI_REQUEST_TIMEOUT_MS=30000
GEMINI_PRO_MODEL=gemini-3.1-pro-preview
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
AI_DEEP_MAX_OUTPUT_TOKENS=1800
AI_DEEP_THINKING_BUDGET=2048
AI_DEEP_DAILY_TOKEN_BUDGET=50000
```

Al alcanzar el presupuesto profundo, A0/A4 bajan primero a Flash. Si el modelo principal alcanza su cuota, el backend lo bloquea temporalmente para evitar reintentos inútiles y utiliza Flash-Lite. Si tampoco está disponible, cambia al motor experto y mantiene las consultas operativas con funciones locales.

## Evaluaciones repetibles

El banco incluye 12 consultas de facturación, cobranza, conciliación, analítica, aplicación y coordinación. Verifica cobertura, permisos y selección de herramientas sin consumir tokens:

```powershell
npm run eval:agents
```

Antes del pitch conviene añadir una evaluación en vivo, con datos sintéticos autorizados, que mida: respuesta correcta, herramienta esperada, evidencia citada, ausencia de identificadores inventados, latencia y consumo. No se debe aprobar una versión si el modelo responde cifras operativas sin consultar una herramienta.
