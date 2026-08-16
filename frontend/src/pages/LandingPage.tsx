import { ArrowRight, BarChart3, Bot, Building2, CheckCircle2, CircleDollarSign, Database, Eye, FileCheck2, Landmark, Menu, Network, Scale, ShieldCheck, Target, TrendingDown, Users, Workflow, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { agents } from "../data";

export function LandingPage() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="public-site">
    <header className="public-nav">
      <Link className="public-brand" to="/"><img src="/assets/recaudex-logo.png" alt="RECAUDEX" /></Link>
      <button className="public-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir navegación">{menuOpen ? <X /> : <Menu />}</button>
      <nav className={menuOpen ? "open" : ""} onClick={() => setMenuOpen(false)}><a href="#solucion">Solución</a><a href="#mision">Nosotros</a><a href="#agentes">Agentes</a><a href="#impacto">Impacto</a></nav>
      <div className="public-access">{user ? <Link className="button primary" to="/dashboard">Abrir workspace <ArrowRight size={16} /></Link> : <><Link className="public-login" to="/login">Iniciar sesión</Link><Link className="button primary" to="/registro">Crear cuenta</Link></>}</div>
    </header>
    <main>
      <section className="public-hero">
        <div className="hero-orbit one" /><div className="hero-orbit two" />
        <div className="public-hero-copy"><span className="public-eyebrow"><ShieldCheck size={14} /> REVENUE ASSURANCE PARA TELECOMUNICACIONES B2B</span><h1>Cada depósito,<br/><em>correctamente aplicado.</em></h1><p>RECAUDEX conecta pagos, clientes y facturas mediante agentes especializados, controles financieros y decisiones explicables que reducen la conciliación manual.</p><div className="hero-actions">{user ? <Link className="button public-primary" to="/dashboard">Ir a la torre de control <ArrowRight /></Link> : <><Link className="button public-primary" to="/registro">Implementar RECAUDEX <ArrowRight /></Link><a className="button public-secondary" href="#solucion">Conocer la solución</a></>}</div><div className="hero-trust"><span><CheckCircle2 /> Datos aislados por empresa</span><span><CheckCircle2 /> Aprobación humana</span><span><CheckCircle2 /> Auditoría completa</span></div></div>
        <div className="hero-product-card"><div className="product-card-head"><span>RECAUDEX · OPERACIÓN EN VIVO</span><i /></div><div className="product-flow"><div><b>A0</b><span>Supervisor</span><strong>Prioridad definida</strong></div><ArrowRight/><div><b>A3</b><span>Conciliación</span><strong>95% confianza</strong></div><ArrowRight/><div><b>A5</b><span>Aplicación</span><strong>Control pendiente</strong></div></div><div className="product-evidence"><span>Pago B2B</span><strong>S/ 18,450.00</strong><div><em>monto exacto</em><em>cliente coincidente</em><em>factura referenciada</em></div></div><div className="product-policy"><ShieldCheck /><span><strong>Policy Engine</strong><small>6 controles · aprobación obligatoria</small></span><b>LISTO</b></div></div>
      </section>

      <section className="public-stats" aria-label="Resultados de validación"><div><strong>3,548</strong><span>pagos analizados</span></div><div><strong>3,364</strong><span>facturas del dataset</span></div><div><strong>86.38%</strong><span>precisión Top-1</span></div><div><strong>99.54%</strong><span>cobertura Top-3</span></div></section>

      <section className="public-section public-problem" id="solucion">
        <div className="section-intro"><span className="public-section-label">EL PROBLEMA</span><h2>Un depósito puede llegar antes que su explicación.</h2><p>En operaciones B2B, el movimiento bancario puede contener únicamente monto, fecha y número de operación. Sin una relación clara con el pagador y sus facturas, comienza una investigación manual que retrasa la aplicación y puede mantener cobranzas sobre deudas ya pagadas.</p></div>
        <div className="problem-grid"><article><span><TrendingDown /></span><strong>Investigación manual</strong><p>Los equipos buscan coincidencias entre sistemas, extractos, correos y documentos.</p></article><article><span><CircleDollarSign /></span><strong>Ingresos sin aplicar</strong><p>El dinero ya fue recibido, pero la deuda continúa abierta hasta identificar su destino.</p></article><article><span><Users /></span><strong>Experiencia deteriorada</strong><p>Un cliente puede recibir cobranza aun cuando ya realizó el pago correspondiente.</p></article></div>
      </section>

      <section className="public-section public-solution">
        <div className="solution-copy"><span className="public-section-label light">LA SOLUCIÓN</span><h2>Una capa inteligente entre el depósito y la aplicación financiera.</h2><p>RECAUDEX organiza el ciclo de ingresos sin reemplazar los sistemas existentes. Un supervisor coordina agentes especializados, A3 genera candidatos explicables y el Policy Engine mantiene la ejecución bajo control humano.</p><ul><li><CheckCircle2 /> Matching probabilístico con señales visibles.</li><li><CheckCircle2 /> Separación de datos y permisos por organización.</li><li><CheckCircle2 /> Aplicaciones transaccionales sobre PostgreSQL.</li><li><CheckCircle2 /> Evidencia cronológica en cada decisión.</li></ul></div>
        <div className="solution-architecture"><div className="architecture-node source"><Landmark /><span><small>ENTRADA</small><strong>Pago B2B</strong></span></div><ArrowRight/><div className="architecture-core"><Network /><span><small>ORQUESTACIÓN</small><strong>A0 + agentes</strong></span></div><ArrowRight/><div className="architecture-node"><FileCheck2 /><span><small>CONTROL</small><strong>Policy Engine</strong></span></div><ArrowRight/><div className="architecture-node result"><Database /><span><small>SALIDA</small><strong>Ledger + auditoría</strong></span></div></div>
      </section>

      <section className="public-section public-how">
        <div className="section-heading centered"><span className="public-section-label">CÓMO FUNCIONA</span><h2>Del movimiento bancario a una decisión trazable.</h2><p>El proceso combina automatización, evidencia y responsabilidad humana.</p></div>
        <div className="how-grid">{[
          ["01","Priorizar", "A0 interpreta indicadores y determina qué pagos necesitan atención."],
          ["02","Identificar", "A3 compara monto, cliente, cuenta, fecha y documentos pendientes."],
          ["03","Explicar", "El sistema presenta candidatos, confianza y señales utilizadas."],
          ["04","Controlar", "El Policy Engine evalúa reglas y bloquea casos que no cumplen."],
          ["05","Autorizar", "Un responsable aprueba o rechaza la recomendación financiera."],
          ["06","Aplicar y medir", "A5 registra la aplicación; A4 recalcula indicadores y Auditoría conserva la evidencia."]
        ].map(([number,title,text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="public-purpose" id="mision">
        <div className="purpose-intro"><span className="public-section-label light">NUESTRO PROPÓSITO</span><h2>Tecnología financiera que protege ingresos y relaciones comerciales.</h2><p>RECAUDEX nace para convertir procesos fragmentados en una operación coordinada, medible y responsable.</p></div>
        <div className="purpose-cards"><article><span><Target /></span><div><small>NUESTRA MISIÓN</small><h3>Asegurar que cada ingreso B2B sea identificado, conciliado y aplicado con rapidez, evidencia y control.</h3><p>Reducimos tareas manuales y prevenimos cobranzas improcedentes mediante colaboración entre personas, datos y agentes especializados.</p></div></article><article><span><Eye /></span><div><small>NUESTRA VISIÓN</small><h3>Ser la referencia latinoamericana en aseguramiento autónomo y responsable de ingresos para telecomunicaciones.</h3><p>Impulsamos operaciones financieras explicables, interoperables y gobernadas, capaces de aprender sin perder trazabilidad.</p></div></article></div>
      </section>

      <section className="public-section public-agents" id="agentes">
        <div className="section-heading"><span className="public-section-label">ARQUITECTURA MULTIAGENTE</span><h2>Seis responsabilidades, una sola operación.</h2><p>Cada agente tiene un centro de trabajo, un chat especializado y funciones limitadas por su dominio y permisos.</p></div>
        <div className="public-agent-grid">{agents.map((agent) => <article key={agent.code} style={{ "--agent-color": agent.color } as React.CSSProperties}><span>{agent.code}</span><Bot/><h3>{agent.name}</h3><p>{agent.domain}</p></article>)}</div>
      </section>

      <section className="public-section public-impact" id="impacto">
        <div className="impact-panel"><div><span className="public-section-label light">IMPACTO MEDIBLE</span><h2>No basta con automatizar: hay que demostrar el resultado.</h2><p>RECAUDEX mide la precisión de identificación, la intervención manual, el tiempo hasta la aplicación, los pagos pendientes y las cobranzas detenidas por una verificación.</p><Link className="button public-primary" to={user ? "/demo" : "/login"}>Explorar el MVP <ArrowRight size={17} /></Link></div><div className="impact-metrics"><article><BarChart3/><span><strong>Top-1 / Top-3</strong>Precisión del motor de candidatos</span></article><article><Workflow/><span><strong>Tiempo de ciclo</strong>Desde recepción hasta aplicación</span></article><article><Scale/><span><strong>Intervención humana</strong>Casos automáticos frente a revisión</span></article><article><CircleDollarSign/><span><strong>Ingresos aplicados</strong>Reducción de pagos pendientes</span></article></div></div>
      </section>

      <section className="public-security"><div className="security-seal"><ShieldCheck /></div><div><span className="public-section-label">SEGURIDAD Y GOBIERNO</span><h2>La IA recomienda; las políticas y las personas conservan el control.</h2><p>Contraseñas cifradas, sesiones firmadas, datos aislados por empresa, cuentas bancarias protegidas, funciones autorizadas y auditoría de cada operación financiera.</p></div><div className="security-list"><span><CheckCircle2 /> Control de acceso por roles</span><span><CheckCircle2 /> Cifrado AES-256-GCM</span><span><CheckCircle2 /> Aprobación antes de aplicar</span><span><CheckCircle2 /> Gemini exclusivamente en backend</span></div></section>

      <section className="public-cta"><div><span className="public-section-label light">EMPIEZA AHORA</span><h2>Convierte cada pago en una decisión verificable.</h2><p>Crea un espacio independiente para tu empresa o ingresa a la demostración de RECAUDEX.</p></div><div>{user ? <Link className="button public-primary" to="/dashboard">Abrir mi workspace <ArrowRight /></Link> : <><Link className="button public-primary" to="/registro">Crear cuenta empresarial <ArrowRight /></Link><Link className="button public-secondary" to="/login">Iniciar sesión</Link></>}</div></section>
    </main>
    <footer className="public-footer"><div><img src="/assets/recaudex-logo.png" alt="RECAUDEX" /><p>Aseguramiento y conciliación del ciclo de ingresos B2B.</p></div><nav><a href="#solucion">Solución</a><a href="#mision">Misión y visión</a><a href="#agentes">Agentes</a><a href="#impacto">Impacto</a></nav><div><strong>RECAUDEX</strong><span>Hackathon AI Telecom 2026</span></div></footer>
  </div>;
}
