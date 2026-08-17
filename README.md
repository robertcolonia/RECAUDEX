# RECAUDEX 

Aplicación web independiente para aseguramiento y conciliación del ciclo de ingresos B2B.

1. Nombre del proyecto: RECAUDEX
2. Descripción de la propuesta: RECAUDEX es una plataforma web para gestionar el ciclo de ingresos B2B de Integratel. Un supervisor de IA coordina cinco agentes especializados que validan facturación, gestionan cobranzas, concilian depósitos, analizan cartera y controlan la aplicación de pagos con trazabilidad integral.
3. Problema identificado: En Integratel, facturación, cobranzas y recaudo dependen de validaciones manuales, archivos, sistemas dispersos y comunicaciones no centralizadas. Esto retrasa la detección de errores, la identificación de depósitos y la actualización de saldos, con riesgo de fuga de ingresos y cobranzas indebidas. La muestra sintética contiene 3,364 facturas y 3,548 pagos: 3,474 relaciones verificables, 160 facturas con pagos múltiples, 57 sin pago verificable y 74 referencias a documentos ausentes. Estas cifras no representan toda la operación.
4. Innovación
RECAUDEX estructura el ciclo E2E con una arquitectura multiagente: A0 supervisa; A1 valida facturación; A2 gestiona cartera y comunicaciones; A3 identifica depósitos y propone facturas; A4 analiza riesgo; y A5 aplica pagos aprobados. Cada agente tiene un chat especializado conectado a funciones autorizadas. A3 compara importe, fecha, cuenta, cliente, deuda y referencias, y muestra candidatos con evidencia y confianza. El modelo contempla Payment Twin, intención previa con facturas, importe y fecha esperada. Reglas, roles, aprobación humana y auditoría controlan las decisiones financieras.
5. Viabilidad
El MVP implementa React, API Node.js/Express, PostgreSQL, roles, auditoría, seis datasets y carga validada de CSV/XLSX. Su flujo demostrable enlaza Control Tower, A3, evidencia, motor de políticas, aprobación, A5, aplicación e indicadores. Al ocultar la relación real para evaluar el matching, alcanzó 86.38% Top-1 y 99.54% Top-3 sobre 3,474 vínculos verificables; los casos ambiguos pasan a revisión humana. Con Recaudo, Facturación, Finanzas y TI, puede integrarse mediante APIs con bancos, correo, SQL Server, Teradata y facturadores.
6. Potencial de impacto
7. Beneficia a Facturación, Cobranzas, Recaudo, Finanzas, Contabilidad, Control de Gestión y clientes B2B. El piloto sobre 1,000 clientes y 3,474 relaciones pago-factura tendrá como metas: Top-3 superior a 95%, 50% menos tiempo de conciliación, 60% menos revisión manual y 100% de acciones financieras trazadas. También medirá pagos pendientes, notas de crédito por error y ratio cobrado/facturado a 30 días.
8. RECAUDEX combina IA generativa, análisis estadístico y matching reproducible. Gemini interpreta consultas mediante funciones autorizadas: A0 coordina; A1 detecta anomalías; A2 clasifica comunicaciones; A3 explica candidatos; A4 analiza cartera; y A5 valida la aplicación. Cada agente conserva su contexto y obtiene cifras de PostgreSQL, no del modelo. Si Gemini falla, responde el motor experto local. La IA recomienda; políticas y aprobación humana autorizan la ejecución.

## Arquitectura

```text
React + Vite (frontend)
        │ HTTPS / JWT
        ▼
Express + TypeScript (backend)
        ├── Prisma ── PostgreSQL
        ├── Gemini API (solo servidor)
        ├── motor determinístico de correspondencia
        └── políticas, aprobaciones y auditoría
```

- `frontend/`: página institucional pública, registro, acceso, perfil, usuarios, clientes, bancos, importación CSV/XLSX, torre de control, chats A0–A5, conciliación, aprobaciones y auditoría.
- `backend/`: API REST multiempresa, autenticación JWT, control por roles, cifrado de datos bancarios, agentes y operaciones financieras.
- `backend/data/raw/`: seis archivos sintéticos SON-IA, importados por la semilla.
- `render.yaml`: frontend, API y PostgreSQL desplegables como un solo Blueprint.

## Ejecución local en Windows

Requisitos: Node.js 22+, npm y Docker Desktop.

```powershell
Copy-Item .\backend\.env.example .\backend\.env
Copy-Item .\frontend\.env.example .\frontend\.env
docker compose up -d db
npm install
npm run db:generate
npm run prisma:deploy -w backend
npm run db:seed
npm run dev
```

Abrir `http://localhost:5173` para ver la página institucional. Después de iniciar sesión, el workspace privado se abre en `http://localhost:5173/dashboard`. La API responderá en `http://localhost:4000/api/health`.

Acceso local inicial:

- Usuario: `direccion@recaudex.app`
- Contraseña: `recaudex2026`

También se crean cuentas para `facturacion`, `cobranzas`, `recaudo`, `finanzas` y `bi` en el dominio `recaudex.app`. En un entorno real, cambia `SEED_DEFAULT_PASSWORD` y reemplaza estas cuentas por las corporativas.

La opción **Crear cuenta** de la pantalla de acceso registra una organización independiente y a su primer administrador. Dentro del sistema, ese administrador puede crear usuarios por área, editar su perfil, subir o eliminar su foto, cambiar correo y contraseña, mantener clientes B2B y registrar cuentas bancarias. Las fotos admiten JPG, PNG o WebP de hasta 2 MB y se guardan en PostgreSQL, no en el disco temporal del servidor.

## Importación de CSV y XLSX

La ruta `/importaciones` incorpora datos operativos sin conectarse directamente a los sistemas de origen. Admite los seis dominios entregados por SON-IA: clientes, planta fija, planta móvil, pagos, facturas y notas de crédito.

- formatos permitidos: `.csv` y `.xlsx` —primera hoja, sin macros—;
- límite: 12 MB y 20,000 filas por ejecución;
- CSV con delimitador `|`, `;`, `,` o tabulación;
- vista previa con columnas mínimas, registros válidos, advertencias y rechazos;
- validación de RUC, fechas, importes, documentos, duplicados y dependencias con la maestra de clientes;
- confirmación explícita antes de escribir en PostgreSQL;
- omisión de duplicados existentes, huella del archivo e historial por organización;
- evento `DATA_FILE_IMPORTED` en Auditoría.

Los registros rechazados nunca se insertan. Los pagos sin factura o pagador reconocido pueden conservarse con advertencia porque representan precisamente los casos que A3 debe investigar. El formato heredado `.xls` no está permitido.

## Gemini

1. Crea una clave en [Google AI Studio](https://ai.google.dev/aistudio).
2. Guarda la clave únicamente como `GEMINI_API_KEY` en `backend/.env` o en las variables secretas de Render.
3. El modo rápido usa `gemini-3.7-flash`; si su cuota se agota, cambia automáticamente a `gemini-3.5-flash-lite`. A0 y A4 ofrecen además **Análisis profundo** con `gemini-3.1-pro-preview`.

Los seis agentes comparten el proveedor, pero no el comportamiento: cada uno tiene instrucciones, capacidades y herramientas de PostgreSQL diferentes. A0 coordina; A1 inspecciona facturación; A2 prioriza cobranza; A3 consulta pagos, conciliaciones y Payment Twin; A4 interpreta matching y riesgo; A5 verifica aprobaciones y ledger.

El modelo no recibe credenciales, no ejecuta SQL y no aplica pagos. La API conserva una memoria corta y registra proveedor, modelo, nivel de sustento, confianza del caso, herramientas, tokens y latencia. Las cifras operativas se obtienen mediante funciones autorizadas de PostgreSQL. La degradación sigue esta cadena: Pro —solo A0/A4— → Flash → Flash-Lite → **RECAUDEX Expert Engine**. Un límite diario no se reintenta repetidamente y el estado visible indica qué respaldo atendió la consulta.

Para controlar consumo se incluyen:

- máximo de 900 tokens de salida por respuesta;
- 10 mensajes recientes de memoria;
- presupuesto diario de 250,000 tokens por organización;
- resultados de herramientas limitados y contexto operacional seleccionado antes de llamar al modelo;
- Gemini 3.7 Flash como modelo predeterminado, validado con la clave configurada.
- Gemini 3.1 Pro Preview solo bajo demanda en A0 y A4, con presupuesto diario independiente.


Consulta [AI_AGENTS.md](./AI_AGENTS.md) para ver la matriz completa y el guion de prueba.

La ruta `/demo` ejecuta el recorrido completo del pitch: A0 prioriza, se selecciona un pago, A3 genera candidatos, el Policy Engine registra seis controles, un responsable aprueba, A5 aplica en el ledger, A4 recalcula indicadores y Auditoría muestra la evidencia.

`
## Variables de entorno

| Variable | Ubicación | Uso |
|---|---|---|
| `DATABASE_URL` | backend | Conexión PostgreSQL; Render la inyecta desde la base creada. |
| `JWT_SECRET` | backend | Firma de sesiones; Render genera un valor seguro. |
| `FIELD_ENCRYPTION_KEY` | backend | Cifra números de cuenta; Render genera un secreto independiente. |
| `GEMINI_API_KEY` | backend | Credencial privada para los agentes. |
| `GEMINI_MODEL` | backend | Modelo Gemini configurable. |
| `GEMINI_FALLBACK_MODEL` | backend | Modelo generativo alternativo cuando el principal alcanza su cuota o falla. |
| `GEMINI_PRO_MODEL` | backend | Modelo utilizado por el análisis profundo de A0 y A4. |
| `AI_MAX_OUTPUT_TOKENS` | backend | Límite de salida por respuesta. |
| `AI_THINKING_BUDGET` | backend | Presupuesto de razonamiento por solicitud. |
| `AI_DEEP_MAX_OUTPUT_TOKENS` | backend | Límite de salida de una respuesta profunda. |
| `AI_DEEP_THINKING_BUDGET` | backend | Presupuesto de razonamiento del modo profundo. |
| `AI_HISTORY_MESSAGES` | backend | Cantidad máxima de mensajes usados como memoria. |
| `AI_DAILY_TOKEN_BUDGET` | backend | Límite diario por organización antes del respaldo experto. |
| `AI_DEEP_DAILY_TOKEN_BUDGET` | backend | Límite diario independiente para el modo profundo. |
| `AI_REQUEST_TIMEOUT_MS` | backend | Tiempo máximo de espera del proveedor. |
| `CORS_ORIGINS` | backend | Orígenes web permitidos, separados por coma. |
| `SEED_DEFAULT_PASSWORD` | backend | Clave inicial al crear usuarios. |
| `VITE_API_URL` | frontend local | URL completa de la API local. |
| `VITE_API_HOST` | frontend Render | Host de la API enlazado por el Blueprint. |

## Controles implementados

- Contraseñas con bcrypt y sesiones JWT de ocho horas.
- Registro público aislado por organización y limitado por dirección IP.
- Cambio de correo y contraseña sujeto a validación de la clave actual.
- Foto de perfil privada por usuario, validada por tipo, firma binaria y límite de 2 MB.
- Números bancarios cifrados con AES-256-GCM; la API solo entrega los últimos cuatro dígitos.
- Consultas siempre limitadas por `organizationId`.
- Roles para generar casos, aprobar y ejecutar aplicaciones.
- A5 solo ejecuta casos previamente aprobados.
- Operaciones de aplicación dentro de una transacción PostgreSQL.
- Registro de auditoría de accesos, consultas, decisiones y aplicaciones.
- Clave de Gemini exclusivamente en el backend.
- Gemini con llamadas a funciones autorizadas y degradación segura si el proveedor no responde.
- Herramientas diferentes por agente, memoria acotada y trazabilidad de consumo por respuesta.
- Rate limiting, Helmet, CORS y validación Zod.



