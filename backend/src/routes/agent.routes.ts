import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { requireAuth } from "../middleware/auth.js";
import { agentProfiles, runAgent, supportsDeepAnalysis, type AgentCode, type AnalysisMode } from "../services/agent.service.js";
import { getAgentWorkspace, getSystemStatus } from "../services/agent-workspace.service.js";
import { audit } from "../services/audit.service.js";
import type { AuthenticatedRequest } from "../types.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const chatSchema = z.object({ message: z.string().trim().min(2).max(4000), conversationId: z.string().optional(), analysisMode: z.enum(["STANDARD", "DEEP"]).default("STANDARD") });

router.get("/", requireAuth, (_req, res) => {
  const agents = Object.entries(agentProfiles).map(([code, profile]) => ({ code, ...profile }));
  res.json({ agents });
});

router.get("/status", requireAuth, asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  return res.json(await getSystemStatus(auth.organizationId));
}));

router.get("/:code/workspace", requireAuth, asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const code = String(req.params.code ?? "").toUpperCase() as AgentCode;
  if (!(code in agentProfiles)) return res.status(404).json({ message: "Agente no encontrado." });
  return res.json(await getAgentWorkspace(code, auth.organizationId));
}));

router.get("/:code/conversations", requireAuth, asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const code = String(req.params.code ?? "").toUpperCase();
  if (!(code in agentProfiles)) return res.status(404).json({ message: "Agente no encontrado." });
  const conversations = await prisma.conversation.findMany({
    where: { organizationId: auth.organizationId, userId: auth.id, agentCode: code },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } }
  });
  return res.json({ conversations });
}));

router.post("/:code/chat", requireAuth, asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const code = String(req.params.code ?? "").toUpperCase() as AgentCode;
  if (!(code in agentProfiles)) return res.status(404).json({ message: "Agente no encontrado." });
  const input = chatSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Escribe una consulta de entre 2 y 4,000 caracteres." });
  if (input.data.analysisMode === "DEEP" && !supportsDeepAnalysis(code)) return res.status(400).json({ message: "El análisis profundo está disponible únicamente para A0 y A4." });

  let conversation = input.data.conversationId
    ? await prisma.conversation.findFirst({ where: { id: input.data.conversationId, organizationId: auth.organizationId, userId: auth.id, agentCode: code } })
    : null;
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { organizationId: auth.organizationId, userId: auth.id, agentCode: code, title: input.data.message.slice(0, 72) }
    });
  }
  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 16,
    select: { role: true, content: true }
  });
  await prisma.message.create({ data: { conversationId: conversation.id, role: "USER", content: input.data.message } });

  const answer = await runAgent(code, input.data.message, auth.organizationId, history.reverse(), input.data.analysisMode as AnalysisMode);
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: answer.text,
      toolCalls: answer.toolCalls,
      provider: answer.provider,
      model: answer.model,
      mode: answer.mode,
      analysisMode: answer.analysisMode,
      groundingLevel: answer.groundingLevel,
      confidence: answer.confidence,
      inputTokens: answer.usage.input,
      outputTokens: answer.usage.output,
      totalTokens: answer.usage.total,
      latencyMs: answer.latencyMs
    }
  });
  await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "AGENT_QUERY", entityType: "CONVERSATION", entityId: conversation.id, detail: { agentCode: code, mode: answer.mode, analysisMode: answer.analysisMode, requestedAnalysisMode: answer.requestedAnalysisMode, groundingLevel: answer.groundingLevel, confidence: answer.confidence, provider: answer.provider, model: answer.model, tools: answer.toolCalls, usage: answer.usage, latencyMs: answer.latencyMs, degradedReason: answer.degradedReason }, ipAddress: req.ip });
  return res.json({ conversationId: conversation.id, message: assistantMessage, mode: answer.mode, analysisMode: answer.analysisMode, requestedAnalysisMode: answer.requestedAnalysisMode, groundingLevel: answer.groundingLevel, confidence: answer.confidence, provider: answer.provider, model: answer.model, tools: answer.toolCalls, usage: answer.usage, latencyMs: answer.latencyMs, degradedReason: answer.degradedReason });
}));

export default router;
