import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { corsOrigins } from "./config/env.js";
import agentRoutes from "./routes/agent.routes.js";
import approvalRoutes from "./routes/approval.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import authRoutes from "./routes/auth.routes.js";
import bankAccountRoutes from "./routes/bank-account.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import reconciliationRoutes from "./routes/reconciliation.routes.js";
import settlementRoutes from "./routes/settlement.routes.js";
import userRoutes from "./routes/user.routes.js";

export const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin)) return callback(null, true);
    return callback(new Error("Origen no autorizado por CORS."));
  },
  credentials: false
}));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "recaudex-api" }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/bank-accounts", bankAccountRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/reconciliations", reconciliationRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/settlements", settlementRoutes);
app.use("/api/audit", auditRoutes);

app.use((_req, res) => res.status(404).json({ message: "Recurso no encontrado." }));
app.use((error: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  const corsError = error.message.includes("Origen no autorizado");
  const tooLarge = error.status === 413 || error.type === "entity.too.large";
  const status = corsError ? 403 : tooLarge ? 413 : 500;
  const message = corsError ? error.message : tooLarge ? "La foto supera el límite de 2 MB." : "No fue posible completar la operación.";
  res.status(status).json({ message });
});
