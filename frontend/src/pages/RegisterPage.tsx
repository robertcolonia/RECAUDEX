import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const initial = { organizationName: "", organizationTaxId: "", fullName: "", email: "", phone: "", password: "", confirmPassword: "" };

export function RegisterPage() {
  const { user, register } = useAuth();
  const [form, setForm] = useState(initial);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const strength = useMemo(() => [form.password.length >= 8, /[A-Z]/.test(form.password), /[a-z]/.test(form.password), /\d/.test(form.password)].filter(Boolean).length, [form.password]);
  if (user) return <Navigate to="/dashboard" replace />;

  function change(name: keyof typeof form, value: string) { setForm((current) => ({ ...current, [name]: value })); setError(""); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (form.password !== form.confirmPassword) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try { await register({ ...form, organizationTaxId: form.organizationTaxId || undefined, phone: form.phone || undefined }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible crear la cuenta."); }
    finally { setBusy(false); }
  }

  return <div className="login-screen register-screen">
    <section className="login-story register-story">
      <div className="story-glow" />
      <Link className="back-link" to="/login"><ArrowLeft size={16} /> Volver al acceso</Link>
      <div className="story-content">
        <span className="overline"><Building2 size={15} /> ALTA DE EMPRESA</span>
        <h1>Tu operación de recaudo,<br/><em>en un espacio propio.</em></h1>
        <p>La cuenta crea un entorno aislado para tu organización. Desde allí podrás incorporar usuarios, clientes B2B, bancos y agentes especializados.</p>
        <div className="story-points">
          <div><ShieldCheck /><span><strong>Datos separados por empresa</strong>Cada organización accede únicamente a sus registros</span></div>
          <div><Check /><span><strong>Administrador inicial</strong>Podrás asignar áreas, roles y permisos a tu equipo</span></div>
        </div>
      </div>
      <small>RECAUDEX · Registro empresarial</small>
    </section>
    <section className="login-form-side register-form-side">
      <form className="login-card register-card" onSubmit={submit}>
        <img className="login-primary-logo" src="/assets/recaudex-logo.png" alt="RECAUDEX" />
        <span className="overline dark">CREAR CUENTA</span>
        <h2>Registrar organización</h2>
        <p>Configura la empresa y al primer administrador.</p>
        <div className="form-section-title">Datos de la empresa</div>
        <div className="form-grid two">
          <label>Razón social<input value={form.organizationName} onChange={(event) => change("organizationName", event.target.value)} required /></label>
          <label>RUC <span className="optional">opcional</span><input inputMode="numeric" value={form.organizationTaxId} onChange={(event) => change("organizationTaxId", event.target.value)} /></label>
        </div>
        <div className="form-section-title">Administrador de la cuenta</div>
        <label>Nombre completo<input value={form.fullName} onChange={(event) => change("fullName", event.target.value)} autoComplete="name" required /></label>
        <div className="form-grid two">
          <label>Correo corporativo<input type="email" value={form.email} onChange={(event) => change("email", event.target.value)} autoComplete="email" required /></label>
          <label>Teléfono <span className="optional">opcional</span><input value={form.phone} onChange={(event) => change("phone", event.target.value)} autoComplete="tel" /></label>
        </div>
        <div className="form-grid two">
          <label>Contraseña<div className="password-field"><input type={show ? "text" : "password"} value={form.password} onChange={(event) => change("password", event.target.value)} autoComplete="new-password" required /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          <label>Confirmar contraseña<input type={show ? "text" : "password"} value={form.confirmPassword} onChange={(event) => change("confirmPassword", event.target.value)} autoComplete="new-password" required /></label>
        </div>
        <div className="password-strength"><i style={{ width: `${strength * 25}%` }} /><span>8 caracteres, mayúscula, minúscula y número</span></div>
        {error && <div className="form-error">{error}</div>}
        <button className="button primary login-button" disabled={busy}>{busy ? "Creando espacio…" : "Crear cuenta empresarial"}<ArrowRight size={18} /></button>
        <p className="auth-switch">¿Ya tienes una cuenta? <Link to="/login">Iniciar sesión</Link></p>
      </form>
    </section>
  </div>;
}
