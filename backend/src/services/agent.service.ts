import { FunctionCallingConfigMode, GoogleGenAI, ThinkingLevel, type Content, type GenerateContentResponse } from "@google/genai";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { agentProfiles, buildSystemInstruction, type AgentCode, type AgentToolName } from "./agent-config.js";
import { executeAgentTool, preloadEvidence, toolDefinitions, toolLabels, type ToolExecution } from "./agent-tools.service.js";
import { buildExpertAnswer } from "./expert-engine.service.js";

export { agentProfiles, type AgentCode } from "./agent-config.js";

export type AgentHistoryMessage = { role: string; content: string };
export type AnalysisMode = "STANDARD" | "DEEP";
export type GroundingLevel = "CONCEPTUAL" | "VERIFIED_DATA" | "LIMITED_DATA" | "CASE_CONFIDENCE";
type TokenUsage = { input: number; output: number; total: number; cached: number; thoughts: number };
type AgentToolSummary = { name: AgentToolName; label: string };

export type AgentRunResult = {
  text: string;
  toolCalls: AgentToolSummary[];
  mode: "GEMINI_TOOLS" | "EXPERT_ENGINE" | "EXPERT_FALLBACK" | "BUDGET_FALLBACK";
  provider: string;
  model: string;
  usage: TokenUsage;
  latencyMs: number;
  analysisMode: AnalysisMode;
  requestedAnalysisMode: AnalysisMode;
  groundingLevel: GroundingLevel;
  confidence?: number;
  degradedReason?: string;
};

const emptyUsage = (): TokenUsage => ({ input: 0, output: 0, total: 0, cached: 0, thoughts: 0 });
type ModelFailure = { reason: string; blockedUntil: number };
const modelFailures = new Map<string, ModelFailure>();

function currentModelFailure(model: string) {
  const failure = modelFailures.get(model);
  if (!failure) return undefined;
  if (failure.blockedUntil <= Date.now()) {
    modelFailures.delete(model);
    return undefined;
  }
  return failure;
}

function markModelFailure(model: string, reason: string) {
  const blockingMs = reason === "DAILY_QUOTA" ? 6 * 60 * 60 * 1000 : reason === "RATE_LIMIT" ? 30_000 : 60_000;
  modelFailures.set(model, { reason, blockedUntil: Date.now() + blockingMs });
}

export function supportsDeepAnalysis(code: AgentCode) {
  return code === "A0" || code === "A4";
}

function addUsage(total: TokenUsage, response: GenerateContentResponse) {
  const metadata = response.usageMetadata;
  total.input += metadata?.promptTokenCount ?? 0;
  total.output += metadata?.candidatesTokenCount ?? 0;
  total.total += metadata?.totalTokenCount ?? 0;
  total.cached += metadata?.cachedContentTokenCount ?? 0;
  total.thoughts += metadata?.thoughtsTokenCount ?? 0;
}

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

async function tokenUsageToday(organizationId: string, model?: string) {
  const usage = await prisma.message.aggregate({
    where: { role: "ASSISTANT", createdAt: { gte: startOfToday() }, conversation: { organizationId }, ...(model ? { model } : {}) },
    _sum: { totalTokens: true }
  });
  return usage._sum.totalTokens ?? 0;
}

export async function getAiProviderStatus(organizationId: string) {
  const cloudConfigured = Boolean(env.GEMINI_API_KEY);
  const [tokensUsedToday, deepTokensUsedToday] = cloudConfigured
    ? await Promise.all([tokenUsageToday(organizationId), tokenUsageToday(organizationId, env.GEMINI_PRO_MODEL)])
    : [0, 0];
  const budgetAvailable = tokensUsedToday < env.AI_DAILY_TOKEN_BUDGET;
  const primaryFailure = currentModelFailure(env.GEMINI_MODEL);
  const fallbackFailure = currentModelFailure(env.GEMINI_FALLBACK_MODEL);
  const activeModel = !primaryFailure ? env.GEMINI_MODEL : !fallbackFailure ? env.GEMINI_FALLBACK_MODEL : "Motor experto v1";
  const cloudReady = cloudConfigured && budgetAvailable && activeModel !== "Motor experto v1";
  return {
    configured: cloudConfigured,
    ready: cloudReady || !cloudConfigured,
    provider: cloudReady ? primaryFailure ? "Google Gemini · respaldo" : "Google Gemini" : "RECAUDEX Expert Engine",
    model: cloudReady ? activeModel : "Motor experto v1",
    mode: cloudReady ? "GEMINI_TOOLS" : cloudConfigured ? "BUDGET_FALLBACK" : "EXPERT_ENGINE",
    primaryModel: { model: env.GEMINI_MODEL, available: !primaryFailure, reason: primaryFailure?.reason },
    fallbackModel: { model: env.GEMINI_FALLBACK_MODEL, available: !fallbackFailure, reason: fallbackFailure?.reason },
    tokensUsedToday,
    dailyTokenBudget: env.AI_DAILY_TOKEN_BUDGET,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    deepAnalysis: {
      enabled: cloudConfigured && budgetAvailable && deepTokensUsedToday < env.AI_DEEP_DAILY_TOKEN_BUDGET && !currentModelFailure(env.GEMINI_PRO_MODEL),
      model: env.GEMINI_PRO_MODEL,
      agents: ["A0", "A4"],
      tokensUsedToday: deepTokensUsedToday,
      dailyTokenBudget: env.AI_DEEP_DAILY_TOKEN_BUDGET,
      maxOutputTokens: env.AI_DEEP_MAX_OUTPUT_TOKENS
    }
  };
}

function compactHistory(history: AgentHistoryMessage[]): Content[] {
  const recent = history.slice(-env.AI_HISTORY_MESSAGES);
  let remaining = 9_000;
  const compacted: Content[] = [];
  for (const item of recent.reverse()) {
    if (remaining <= 0) break;
    const content = item.content.slice(0, Math.min(1_800, remaining));
    remaining -= content.length;
    compacted.unshift({ role: item.role === "ASSISTANT" ? "model" : "user", parts: [{ text: content }] });
  }
  return compacted;
}

function contextBlock(evidence: ToolExecution[]) {
  if (!evidence.length) return "";
  return `\n\nCONTEXTO OPERATIVO PRECARGADO (fuentes autorizadas del backend):\n${evidence.map((item) => `${item.label} [${item.name}]: ${JSON.stringify(item.result)}`).join("\n")}`;
}

function summaries(evidence: ToolExecution[]): AgentToolSummary[] {
  return [...new Map(evidence.map((item) => [item.name, { name: item.name, label: item.label }])).values()];
}

function grounding(evidence: ToolExecution[]): { level: GroundingLevel; confidence?: number } {
  if (!evidence.length) return { level: "CONCEPTUAL" };
  for (const item of evidence) {
    if (item.name !== "get_reconciliation_case" || !item.result || typeof item.result !== "object") continue;
    const result = item.result as { found?: boolean; case?: { confidence?: number } };
    if (result.found && typeof result.case?.confidence === "number") return { level: "CASE_CONFIDENCE", confidence: result.case.confidence };
  }
  const hasUsableData = evidence.some((item) => {
    if (Array.isArray(item.result)) return item.result.length > 0;
    if (!item.result || typeof item.result !== "object") return Boolean(item.result);
    const value = item.result as { error?: unknown; found?: boolean };
    return !value.error && value.found !== false && Object.keys(value).length > 0;
  });
  return { level: hasUsableData ? "VERIFIED_DATA" : "LIMITED_DATA" };
}

function expertResult(code: AgentCode, message: string, evidence: ToolExecution[], mode: AgentRunResult["mode"], startedAt: number, degradedReason?: string, requestedAnalysisMode: AnalysisMode = "STANDARD"): AgentRunResult {
  const support = grounding(evidence);
  return { text: buildExpertAnswer(code, message, evidence), toolCalls: summaries(evidence), mode, provider: "RECAUDEX Expert Engine", model: "Motor experto v1", usage: emptyUsage(), latencyMs: Date.now() - startedAt, analysisMode: "STANDARD", requestedAnalysisMode, groundingLevel: support.level, confidence: support.confidence, ...(degradedReason ? { degradedReason } : {}) };
}

function providerErrorDetails(error: unknown) {
  const value = error as { status?: number; code?: number | string; name?: string; message?: string; cause?: unknown };
  const status = Number(value?.status ?? value?.code ?? 0);
  const cause = value?.cause && typeof value.cause === "object" ? value.cause as { message?: string } : undefined;
  const message = `${String(value?.message ?? "")} ${String(cause?.message ?? "")}`.toLowerCase();
  return { value, status, message };
}

function providerErrorCategory(error: unknown) {
  const { value, status, message } = providerErrorDetails(error);
  if (status === 401 || status === 403 || /api key|permission|unauth/.test(message)) return "AUTH_OR_PERMISSION";
  if (status === 404 || /model.*not found|not found.*model/.test(message)) return "MODEL_NOT_AVAILABLE";
  if ((status === 429 || /quota|resource exhausted/.test(message)) && /(per.?day|requests.?per.?day|free_tier_requests|generateRequestsPerDay)/i.test(message)) return "DAILY_QUOTA";
  if (status === 429 || /quota|rate limit|resource exhausted/.test(message)) return "RATE_LIMIT";
  if ([500, 502, 503, 504].includes(status) || /unavailable|overloaded/.test(message)) return "PROVIDER_UNAVAILABLE";
  if (value?.name === "TimeoutError" || /timeout|timed out|abort/.test(message)) return "TIMEOUT";
  return "PROVIDER_ERROR";
}

function retryableProviderError(error: unknown) {
  return ["RATE_LIMIT", "PROVIDER_UNAVAILABLE", "TIMEOUT"].includes(providerErrorCategory(error));
}

async function generateWithRetry(ai: GoogleGenAI, request: Parameters<GoogleGenAI["models"]["generateContent"]>[0]) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await ai.models.generateContent({
        ...request,
        config: { ...request.config, abortSignal: AbortSignal.timeout(env.AI_REQUEST_TIMEOUT_MS) }
      });
    } catch (error) {
      lastError = error;
      if (!retryableProviderError(error) || attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }
  }
  throw lastError;
}

type GeminiRunOptions = {
  model: string;
  analysisMode: AnalysisMode;
  requestedAnalysisMode: AnalysisMode;
  maxOutputTokens: number;
  thinkingLevel: ThinkingLevel;
  degradedReason?: string;
};

async function callGemini(code: AgentCode, message: string, organizationId: string, history: AgentHistoryMessage[], preloaded: ToolExecution[], startedAt: number, options: GeminiRunOptions): Promise<AgentRunResult> {
  const profile = agentProfiles[code];
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const contents: Content[] = compactHistory(history);
  contents.push({ role: "user", parts: [{ text: `${message}${contextBlock(preloaded)}` }] });
  const evidence = [...preloaded];
  const usage = emptyUsage();
  const baseConfig = {
    systemInstruction: buildSystemInstruction(code),
    maxOutputTokens: options.maxOutputTokens,
    thinkingConfig: { thinkingLevel: options.thinkingLevel, includeThoughts: false }
  };
  const config = preloaded.length ? baseConfig : {
    ...baseConfig,
    tools: [{ functionDeclarations: profile.tools.map((name) => toolDefinitions[name]) }],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } }
  };

  for (let turn = 0; turn < env.AI_MAX_TOOL_TURNS; turn += 1) {
    const response = await generateWithRetry(ai, { model: options.model, contents, config });
    addUsage(usage, response);
    const calls = (response.functionCalls ?? []).slice(0, 4);
    if (!calls.length) {
      const text = response.text?.trim();
      if (!text) return expertResult(code, message, evidence, "EXPERT_FALLBACK", startedAt, "EMPTY_RESPONSE", options.requestedAnalysisMode);
      const support = grounding(evidence);
      return { text, toolCalls: summaries(evidence), mode: "GEMINI_TOOLS", provider: "Google Gemini", model: response.modelVersion || options.model, usage, latencyMs: Date.now() - startedAt, analysisMode: options.analysisMode, requestedAnalysisMode: options.requestedAnalysisMode, groundingLevel: support.level, confidence: support.confidence, degradedReason: options.degradedReason };
    }

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);
    const results = await Promise.all(calls.map(async (call) => {
      const name = call.name as AgentToolName;
      if (!profile.tools.includes(name as never)) return { id: call.id, name: call.name || "unauthorized_tool", response: { error: "Función no autorizada para este agente." } };
      const args = call.args && typeof call.args === "object" ? call.args as Record<string, unknown> : {};
      const result = await executeAgentTool(name, args, organizationId);
      evidence.push({ name, label: toolLabels[name], args, result });
      return { id: call.id, name, response: { result } };
    }));
    contents.push({ role: "user", parts: results.map((result) => ({ functionResponse: result })) });
  }

  const finalResponse = await generateWithRetry(ai, { model: options.model, contents, config: baseConfig });
  addUsage(usage, finalResponse);
  const finalText = finalResponse.text?.trim();
  if (!finalText) return expertResult(code, message, evidence, "EXPERT_FALLBACK", startedAt, "TOOL_LOOP_LIMIT", options.requestedAnalysisMode);
  const support = grounding(evidence);
  return { text: finalText, toolCalls: summaries(evidence), mode: "GEMINI_TOOLS", provider: "Google Gemini", model: finalResponse.modelVersion || options.model, usage, latencyMs: Date.now() - startedAt, analysisMode: options.analysisMode, requestedAnalysisMode: options.requestedAnalysisMode, groundingLevel: support.level, confidence: support.confidence, degradedReason: options.degradedReason };
}

export async function runAgent(code: AgentCode, message: string, organizationId: string, history: AgentHistoryMessage[] = [], requestedAnalysisMode: AnalysisMode = "STANDARD"): Promise<AgentRunResult> {
  const startedAt = Date.now();
  const evidence = await preloadEvidence(code, message, organizationId);
  if (!env.GEMINI_API_KEY) return expertResult(code, message, evidence, "EXPERT_ENGINE", startedAt, undefined, requestedAnalysisMode);

  const usedToday = await tokenUsageToday(organizationId);
  if (usedToday >= env.AI_DAILY_TOKEN_BUDGET) return expertResult(code, message, evidence, "BUDGET_FALLBACK", startedAt, "DAILY_BUDGET", requestedAnalysisMode);

  const deepRequested = requestedAnalysisMode === "DEEP" && supportsDeepAnalysis(code);
  const deepUsedToday = deepRequested ? await tokenUsageToday(organizationId, env.GEMINI_PRO_MODEL) : 0;
  const deepAvailable = deepRequested && deepUsedToday < env.AI_DEEP_DAILY_TOKEN_BUDGET;
  const candidates: GeminiRunOptions[] = [];
  const skippedReasons: string[] = [];
  const addCandidate = (candidate: GeminiRunOptions) => {
    if (!candidates.some((item) => item.model === candidate.model) && !currentModelFailure(candidate.model)) candidates.push(candidate);
    else {
      const failure = currentModelFailure(candidate.model);
      if (failure) skippedReasons.push(`${candidate.model}:${failure.reason}`);
    }
  };

  if (deepAvailable) addCandidate({ model: env.GEMINI_PRO_MODEL, analysisMode: "DEEP", requestedAnalysisMode, maxOutputTokens: env.AI_DEEP_MAX_OUTPUT_TOKENS, thinkingLevel: ThinkingLevel.HIGH });
  else if (deepRequested) skippedReasons.push("DEEP_BUDGET_FALLBACK");
  addCandidate({ model: env.GEMINI_MODEL, analysisMode: "STANDARD", requestedAnalysisMode, maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS, thinkingLevel: ThinkingLevel.LOW });
  addCandidate({ model: env.GEMINI_FALLBACK_MODEL, analysisMode: "STANDARD", requestedAnalysisMode, maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS, thinkingLevel: ThinkingLevel.MINIMAL });

  for (const candidate of candidates) {
    const options = { ...candidate, ...(skippedReasons.length ? { degradedReason: skippedReasons.join(" | ") } : {}) };
    try {
      const result = await callGemini(code, message, organizationId, history, evidence, startedAt, options);
      modelFailures.delete(candidate.model);
      return result;
    } catch (error) {
      const reason = providerErrorCategory(error);
      markModelFailure(candidate.model, reason);
      skippedReasons.push(`${candidate.model}:${reason}`);
      console.warn(`[AI] ${candidate.model} no disponible (${reason}); probando el siguiente respaldo.`);
      if (reason === "AUTH_OR_PERMISSION") break;
    }
  }

  const finalReason = skippedReasons.join(" | ") || "PROVIDER_ERROR";
  console.warn(`[AI] Los modelos Gemini no están disponibles; se activó el motor experto (${finalReason}).`);
  return expertResult(code, message, evidence, "EXPERT_FALLBACK", startedAt, finalReason, requestedAnalysisMode);
}
