# Publicación de RECAUDEX con GitHub y Render

## Qué publica cada servicio

| Componente | Dónde se publica | Resultado |
|---|---|---|
| Código fuente | GitHub | Repositorio y control de versiones. |
| Frontend React | Render Static Site | URL pública para los usuarios. |
| Backend Express | Render Web Service | API pública y ejecución de los agentes. |
| Base de datos | Render PostgreSQL | Datos persistentes accesibles únicamente por el backend. |
| Gemini | Google AI API | Respuestas generativas solicitadas por el backend. |

GitHub por sí solo no puede ejecutar Express ni PostgreSQL. GitHub Pages solamente aloja archivos estáticos; por eso la opción recomendada es guardar el código en GitHub y dejar que Render publique los tres componentes definidos en `render.yaml`.

## Arranque local completo

1. Abre Docker Desktop y espera a que indique que el motor está activo.
2. Desde la raíz `RECAUDEX_FULLSTACK`, ejecuta:

```powershell
npm run dev:local
```

Ese comando levanta PostgreSQL, aplica las migraciones, conserva o carga los datos iniciales y arranca API + React. Las direcciones esperadas son `http://localhost:4000/api/health` y `http://localhost:5173`. Si el puerto 5173 ya está ocupado, Vite mostrará otro puerto; cierra procesos antiguos para mantener una sola instancia.

## 1. Subir el proyecto a GitHub

1. En GitHub crea un repositorio vacío, por ejemplo `recaudex-fullstack`.
2. Abre PowerShell dentro de `RECAUDEX_FULLSTACK`.
3. Ejecuta:

```powershell
git init -b main
git add .
git commit -m "feat: plataforma RECAUDEX full stack"
git remote add origin https://github.com/TU-USUARIO/recaudex-fullstack.git
git push -u origin main
```

El archivo `.gitignore` impide que se publiquen `.env`, contraseñas, claves de Gemini, dependencias y compilaciones locales.

## 2. Crear una clave de Gemini

1. Abre [Google AI Studio](https://ai.google.dev/aistudio).
2. Crea o copia una API key.
3. No la escribas en React, GitHub ni en un archivo versionado. Se guardará como secreto de Render bajo el nombre `GEMINI_API_KEY`.

Una sola clave activa A0–A5. La especialización no requiere seis claves ni seis aplicaciones Dify: se define mediante instrucciones y herramientas distintas dentro del backend. Flash atiende la operación normal, Flash-Lite actúa como respaldo de cuota y el modo Pro aparece únicamente en A0 y A4.

Si AI Studio muestra **Nivel gratuito**, pulsa **Configurar la facturación** en el proyecto antes del pitch y define alertas de gasto. Esta operación puede implicar cobros y debe hacerla el propietario de la cuenta. Después revoca cualquier clave que se haya compartido y crea una nueva; nunca copies la nueva en el frontend ni en el repositorio.

## 3. Desplegar con un Blueprint de Render

1. Inicia sesión en [Render](https://dashboard.render.com/).
2. Conecta tu cuenta de GitHub y autoriza el repositorio `recaudex-fullstack`.
3. Selecciona **New → Blueprint**.
4. Elige el repositorio y deja la ruta del Blueprint como `render.yaml`.
5. Render mostrará:
   - `recaudex-web`: frontend React.
   - `recaudex-api`: backend Express.
   - `recaudex-postgres`: PostgreSQL.
6. Ingresa estos valores cuando Render los solicite:

| Variable | Valor |
|---|---|
| `GEMINI_API_KEY` | La clave obtenida de Google AI Studio. |
| `SEED_DEFAULT_PASSWORD` | Una contraseña robusta para los usuarios iniciales. |
| `CORS_ORIGINS` | Inicialmente `https://recaudex-web.onrender.com`; corrígela si Render asigna un sufijo diferente. |

`DATABASE_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY` y `VITE_API_HOST` se crean o enlazan automáticamente. No tienes que copiar la contraseña de PostgreSQL ni secretos de cifrado al frontend.

## 4. Qué sucede durante el primer despliegue

1. Render instala y compila el backend.
2. Al iniciar la API, Prisma aplica todas las migraciones, incluida la ampliación de perfiles, empresas y cuentas bancarias. Esto está incluido en `startCommand` porque el comando previo al despliegue no está disponible para servicios web gratuitos.
3. Se importan los seis archivos SON-IA una sola vez.
4. La API comienza a responder en una URL similar a `https://recaudex-api.onrender.com`.
5. React se compila con el hostname real de esa API.
6. El frontend queda disponible en una URL similar a `https://recaudex-web.onrender.com`.

La migración también crea el historial de importaciones. Después del despliegue, los usuarios autorizados pueden cargar nuevos CSV/XLSX desde `/importaciones`; los archivos se validan en memoria y solo los registros confirmados se incorporan a PostgreSQL.

> Para una demostración temporal, el plan gratuito es suficiente. Render suspende los servicios web gratuitos cuando no reciben tráfico y su PostgreSQL gratuito vence a los 30 días; para conservar el MVP de forma permanente debes migrar la base a un plan de pago o a otro PostgreSQL administrado y actualizar `DATABASE_URL`.

## 5. Verificación después de publicar

Abre primero:

```text
https://TU-API.onrender.com/api/health
```

Debe devolver:

```json
{"status":"ok","service":"recaudex-api"}
```

Después abre el frontend y utiliza:

- Correo: `direccion@recaudex.app`
- Contraseña: el valor configurado en `SEED_DEFAULT_PASSWORD`.

Comprueba en este orden:

1. Torre de control con clientes, facturas y pagos.
2. Apertura de A0–A5.
3. Envío de una consulta en un chat.
   - El encabezado debe mostrar **Google Gemini** cuando la clave esté activa.
   - Debajo de la respuesta deben aparecer modelo, sustento, fuentes consultadas y tokens utilizados.
   - En A0 y A4, prueba una vez **Análisis profundo** y confirma que se muestra el modelo Pro.
4. Creación de candidatos en Conciliación.
5. Solicitud y decisión en Aprobaciones.
6. Registro correspondiente en Auditoría.
7. Registro de una organización desde **Crear cuenta**, edición de perfil y altas de usuario, cliente y cuenta bancaria.
8. Importación de un CSV o XLSX: vista previa, validación, confirmación e historial en Auditoría.

## 6. Actualizaciones posteriores

Cada vez que hagas cambios:

```powershell
git add .
git commit -m "describe el cambio"
git push
```

Render detectará el `push`, recompilará los componentes modificados y mantendrá PostgreSQL. No vuelvas a ejecutar la carga de datos manualmente salvo que realmente quieras importar un nuevo conjunto.

## ¿Se puede usar una URL `github.io`?

Sí, pero solamente para React. El backend y PostgreSQL seguirían en Render y habría que configurar GitHub Pages, la ruta base de Vite y `VITE_API_URL`. Para este proyecto es más estable publicar también el frontend en Render: el usuario seguirá accediendo mediante una URL pública normal y todo se administrará desde el mismo Blueprint.
