import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Network, ShieldCheck, Sparkles } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState(import.meta.env.DEV ? "direccion@recaudex.app" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "recaudex2026" : "");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setBusy(true);
    try { await login(email, password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible ingresar."); }
    finally { setBusy(false); }
  }

  return <div className="login-screen">
    <section className="login-story">
      <div className="story-glow" />
      <Link className="back-link" to="/"><ArrowLeft size={16} /> Volver al sitio público</Link>
      <div className="login-brand"><img className="brand-symbol logo-large" src="/assets/recaudex-icon.png" alt="Símbolo RECAUDEX" /><span>RECAUDEX</span></div>
      <div className="story-content">
        <span className="overline"><Sparkles size={15} /> ASEGURAMIENTO DE INGRESOS B2B</span>
        <h1>Cada depósito,<br/><em>correctamente aplicado.</em></h1>
        <p>Una arquitectura coordinada de agentes de IA conecta facturación, cobranzas, recaudo y finanzas con decisiones explicables y trazables.</p>
        <div className="story-points">
          <div><Network /><span><strong>Seis agentes coordinados</strong>Especializados en todo el ciclo de ingresos</span></div>
          <div><ShieldCheck /><span><strong>Control financiero</strong>Políticas, aprobación humana y auditoría</span></div>
          <div><CheckCircle2 /><span><strong>Conciliación sustentada</strong>Evidencia visible para cada recomendación</span></div>
        </div>
      </div>
      <small>RECAUDEX · Integratel</small>
    </section>
    <section className="login-form-side">
      <form className="login-card" onSubmit={submit}>
        <img className="login-primary-logo" src="/assets/recaudex-logo.png" alt="RECAUDEX" />
        <span className="overline dark">ACCESO SEGURO</span>
        <h2>Ingresar al workspace</h2>
        <p>Accede a tu empresa o crea un espacio de trabajo nuevo.</p>
        <label>Correo corporativo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
        <label>Contraseña<div className="password-field"><input type={show ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        {error && <div className="form-error">{error}</div>}
        <button className="button primary login-button" disabled={busy}>{busy ? "Validando…" : "Ingresar"}<ArrowRight size={18} /></button>
        <p className="auth-switch">¿Tu empresa aún no usa RECAUDEX? <Link to="/registro">Crear cuenta</Link></p>
        {import.meta.env.DEV && <div className="local-access"><strong>Acceso local inicial</strong><span>direccion@recaudex.app · recaudex2026</span></div>}
      </form>
    </section>
  </div>;
}
