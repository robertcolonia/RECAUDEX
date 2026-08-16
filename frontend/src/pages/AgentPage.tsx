import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, Bot, BrainCircuit, CheckCircle2, Database, Gauge, MessageSquareText, Send, Sparkles, UserRound, Wrench } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { agents } from "../data";

type ToolCall = { name: string; label?: string } | string;
type AnalysisMode = "STANDARD" | "DEEP";
type Message = { id: string; role: "USER" | "ASSISTANT"; content: string; createdAt: string; toolCalls?: ToolCall[] | null; provider?: string | null; model?: string | null; mode?: string | null; analysisMode?: AnalysisMode | null; groundingLevel?: string | null; confidence?: number | null; inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null; latencyMs?: number | null };
type Conversation = { id: string; messages: Message[] };
type Workspace = {
  provider: { configured: boolean; ready: boolean; provider: string; model: string; mode: string; primaryModel?: { model: string; available: boolean; reason?: string }; fallbackModel?: { model: string; available: boolean; reason?: string }; tokensUsedToday: number; dailyTokenBudget: number; maxOutputTokens: number; deepAnalysis?: { enabled: boolean; model: string; agents: string[]; tokensUsedToday: number; dailyTokenBudget: number; maxOutputTokens: number } };
  generatedAt: string;
  title: string;
  insight: string;
  kpis: Array<{ label: string; value: string; detail: string; tone: string }>;
  items: Array<{ id: string; title: string; subtitle: string; value: string; status: string }>;
  actions: Array<{ label: string; to: string }>;
};

function groundingLabel(message: Message) {
  if (message.groundingLevel === "CASE_CONFIDENCE" && typeof message.confidence === "number") return `Confianza del caso ${Math.round(message.confidence * 100)}%`;
  if (message.groundingLevel === "VERIFIED_DATA") return "Datos verificados";
  if (message.groundingLevel === "LIMITED_DATA") return "Evidencia limitada";
  if (!message.groundingLevel && (message.toolCalls || []).length) return "Fuentes operativas";
  return "Respuesta conceptual";
}

function diagnosticLabel(value: string) {
  if (value.includes("DAILY_QUOTA")) return "Cuota del modelo principal agotada · respaldo automático activo";
  if (value.includes("RATE_LIMIT")) return "Límite temporal del proveedor · respaldo automático activo";
  if (value.includes("AUTH_OR_PERMISSION")) return "Revisa la clave o los permisos de Gemini";
  if (value.includes("PROVIDER_ERROR")) return "Proveedor no disponible · motor local activo";
  return value.replaceAll("_", " ");
}

export function AgentPage() {
  const { code = "A0" } = useParams();
  const agent = useMemo(() => agents.find((item) => item.code === code.toUpperCase()) || agents[0], [code]);
  const [tab, setTab] = useState<"workspace" | "chat">("workspace");
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [lastMode, setLastMode] = useState("");
  const [lastDiagnostic, setLastDiagnostic] = useState("");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("STANDARD");
  const messagesContainer = useRef<HTMLDivElement>(null);
  const hydratedAgent = useRef<string | null>(null);
  const workspace = useQuery({ queryKey: ["agent-workspace", agent.code], queryFn: () => api<Workspace>(`/api/agents/${agent.code}/workspace`) });
  const history = useQuery({ queryKey: ["conversations", agent.code], queryFn: () => api<{ conversations: Conversation[] }>(`/api/agents/${agent.code}/conversations`) });

  useEffect(() => { if (hydratedAgent.current === agent.code) return; setConversationId(undefined); setMessages([]); setInput(""); setTab("workspace"); setLastMode(""); setLastDiagnostic(""); setAnalysisMode("STANDARD"); hydratedAgent.current = null; }, [agent.code]);
  useEffect(() => { if (!history.data || hydratedAgent.current === agent.code) return; const current = history.data.conversations[0]; setConversationId(current?.id); setMessages(current?.messages || []); hydratedAgent.current = agent.code; }, [history.data, agent.code]);
  useEffect(() => { const container = messagesContainer.current; if (container) container.scrollTop = container.scrollHeight; }, [messages.length, tab]);

  const mutation = useMutation({
    mutationFn: (message: string) => api<{ conversationId: string; message: Message; mode: string; tools: ToolCall[]; degradedReason?: string }>(`/api/agents/${agent.code}/chat`, { method: "POST", body: JSON.stringify({ message, conversationId, analysisMode }) }),
    onSuccess(response) { setConversationId(response.conversationId); setMessages((current) => [...current, response.message]); setLastMode(response.mode); setLastDiagnostic(response.degradedReason || ""); void workspace.refetch(); }
  });
  function submit(event: FormEvent) { event.preventDefault(); const message = input.trim(); if (!message || mutation.isPending) return; setMessages((current) => [...current, { id: `local-${Date.now()}`, role: "USER", content: message, createdAt: new Date().toISOString() }]); setInput(""); mutation.mutate(message); }
  function newConversation() { setConversationId(undefined); setMessages([]); setInput(""); setLastMode(""); setLastDiagnostic(""); hydratedAgent.current = agent.code; setTab("chat"); }

  return <div className="agent-workspace agent-workspace-wide">
    <div className="agent-header">
      <div className="agent-identity"><span className="agent-avatar" style={{ background: `${agent.color}18`, color: agent.color, borderColor: `${agent.color}55` }}><Bot /></span><div><span className="overline dark">{agent.code} · {agent.domain}</span><h1>{agent.name}</h1><p>{agent.code === "A0" ? "Coordina decisiones y el recorrido integral del ciclo de ingresos." : "Combina datos operativos, controles y análisis especializado para su dominio."}</p></div></div>
      <button className="button secondary" onClick={newConversation}>Nueva conversación</button>
    </div>
    <div className="agent-tabs" role="tablist"><button className={tab === "workspace" ? "active" : ""} onClick={() => setTab("workspace")}><Activity size={16} /> Centro de trabajo</button><button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}><MessageSquareText size={16} /> Chat especializado</button></div>

    {tab === "workspace" && <section className="agent-workbench">
      {workspace.isLoading && <div className="page-state compact"><div className="spinner" /><span>Preparando el centro de trabajo…</span></div>}
      {workspace.isError && <div className="inline-error">No se pudo consultar el centro de trabajo. Verifica la API.</div>}
      {workspace.data && <>
        <div className="provider-banner connected"><span><BrainCircuit /></span><div><strong>{workspace.data.provider.provider.startsWith("Google Gemini") ? `${workspace.data.provider.provider} conectado · ${workspace.data.provider.model}` : "Motor experto RECAUDEX activo"}</strong><p>{workspace.data.provider.provider.startsWith("Google Gemini") ? `Interpreta la consulta con herramientas de PostgreSQL. Respaldo configurado: ${workspace.data.provider.fallbackModel?.model || "modelo alternativo"}.` : workspace.data.provider.configured ? "Los modelos generativos están temporalmente limitados; el motor local mantiene las consultas operativas." : "Respaldo especializado sin consumo de tokens. Al configurar Gemini, conservará las mismas herramientas y añadirá comprensión generativa abierta."}</p><div className="provider-usage"><Gauge size={12} /><span>{workspace.data.provider.tokensUsedToday.toLocaleString("es-PE")} / {workspace.data.provider.dailyTokenBudget.toLocaleString("es-PE")} tokens diarios</span><b>máx. {workspace.data.provider.maxOutputTokens} por respuesta</b></div></div><CheckCircle2 /></div>
        <div className="agent-kpi-grid">{workspace.data.kpis.map((kpi) => <article className={`agent-kpi tone-${kpi.tone}`} key={kpi.label}><span>{kpi.label}</span><strong>{kpi.value}</strong><small>{kpi.detail}</small></article>)}</div>
        <div className="workbench-grid">
          <section className="panel agent-focus"><div className="panel-heading"><div><h2>{workspace.data.title}</h2><p>{workspace.data.insight}</p></div><Database size={19} /></div><div className="focus-list">{workspace.data.items.length ? workspace.data.items.map((item) => <div className="focus-row" key={item.id}><span className="focus-status" style={{ background: agent.color }} /><div><strong>{item.title}</strong><small>{item.subtitle}</small></div><b>{item.value}</b><em>{item.status.replaceAll("_", " ")}</em></div>) : <div className="empty-state">No hay elementos pendientes para este agente.</div>}</div></section>
          <aside className="panel agent-actions"><div className="panel-heading"><div><h2>Acciones disponibles</h2><p>Operaciones gobernadas por permisos.</p></div></div>{workspace.data.actions.map((action) => <Link className="workbench-action" to={action.to} key={action.to}><span>{action.label}</span><ArrowRight size={16} /></Link>)}<button className="workbench-action" onClick={() => setTab("chat")}><span>Consultar al agente</span><MessageSquareText size={16} /></button><div className="data-guard"><Database size={15} /> Actualizado desde PostgreSQL. Ninguna acción financiera se ejecuta desde el modelo.</div></aside>
        </div>
      </>}
    </section>}

    {tab === "chat" && <div className="chat-area">
      {(agent.code === "A0" || agent.code === "A4") && <div className="analysis-mode-picker" aria-label="Modo de análisis"><div><strong>Profundidad de análisis</strong><small>Flash para operación diaria; Pro para decisiones complejas.</small></div><div><button className={analysisMode === "STANDARD" ? "active" : ""} disabled={mutation.isPending} onClick={() => setAnalysisMode("STANDARD")}>Rápido</button><button className={analysisMode === "DEEP" ? "active deep" : ""} disabled={mutation.isPending || workspace.data?.provider.deepAnalysis?.enabled === false} onClick={() => setAnalysisMode("DEEP")}><Sparkles size={13} /> Análisis profundo</button></div></div>}
      <div className="chat-mode-strip"><span className="online" />{workspace.data ? `${workspace.data.provider.provider} · ${analysisMode === "DEEP" && workspace.data.provider.deepAnalysis?.enabled ? workspace.data.provider.deepAnalysis.model : workspace.data.provider.model}` : "Preparando agente"}{lastMode && <b>Última respuesta: {lastMode.replaceAll("_", " ")}{lastDiagnostic ? ` · ${diagnosticLabel(lastDiagnostic)}` : ""}</b>}</div>
      <div className="chat-shell">
        <div className="chat-messages" ref={messagesContainer}>
          {!messages.length && <div className="chat-welcome"><span style={{ color: agent.color }}><Sparkles /></span><h2>¿Qué necesitas analizar?</h2><p>{agent.prompt}</p><div className="chat-suggestions">{agent.suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}</div><div className="data-guard"><Database size={15} /> Cada respuesta se fundamenta en herramientas autorizadas y datos aislados por organización.</div></div>}
          {messages.map((message) => <div className={`message ${message.role === "USER" ? "message-user" : "message-agent"}`} key={message.id}><div className="message-icon">{message.role === "USER" ? <UserRound size={17} /> : <Bot size={17} />}</div><div className="message-body"><strong>{message.role === "USER" ? "Tú" : `${agent.code} · ${agent.name}`}</strong><p>{message.content}</p>{message.role === "ASSISTANT" && <div className="message-evidence"><span><BrainCircuit size={12} />{message.provider || (message.mode?.includes("GEMINI") ? "Google Gemini" : "Motor experto")}</span>{message.model && <span><Sparkles size={11} />{message.model}</span>}<span><Database size={11} />{groundingLabel(message)}</span>{(message.toolCalls || []).map((tool) => { const name = typeof tool === "string" ? tool : tool.name; const label = typeof tool === "string" ? tool : tool.label || tool.name; return <span key={name}><Wrench size={11} />{label}</span>; })}{Boolean(message.totalTokens) && <span><Gauge size={11} />{message.totalTokens?.toLocaleString("es-PE")} tokens</span>}{Boolean(message.latencyMs) && <span>{(Number(message.latencyMs) / 1000).toFixed(1)} s</span>}</div>}</div></div>)}
          {mutation.isPending && <div className="message message-agent"><div className="message-icon"><Bot size={17} /></div><div className="message-body"><strong>{agent.code} está analizando</strong><div className="typing"><i/><i/><i/></div></div></div>}
          {history.isLoading && !messages.length && <div className="chat-loading">Recuperando conversaciones…</div>}
          {history.isError && <div className="chat-error">No se pudo recuperar el historial. Puedes iniciar una conversación nueva.</div>}
          {mutation.isError && <div className="chat-error">{mutation.error instanceof Error ? mutation.error.message : "No se pudo procesar la consulta."}</div>}
        </div>
        <form className="chat-composer" onSubmit={submit}><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Consulta a ${agent.code} sobre ${agent.domain.toLowerCase()}…`} rows={2} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button aria-label="Enviar consulta" disabled={!input.trim() || mutation.isPending} style={{ background: agent.color }}><Send size={18} /></button><small>Enter para enviar · Shift + Enter para nueva línea</small></form>
      </div>
    </div>}
  </div>;
}
