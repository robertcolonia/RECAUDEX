import { useEffect, useState, type FormEvent } from "react";
import { ShieldAlert, UserPlus, Users } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { dateTime, roleLabels } from "../data";

type ManagedUser = { id: string; email: string; fullName: string; role: string; jobTitle: string | null; phone: string | null; active: boolean; createdAt: string; lastLoginAt: string | null };
const roles = Object.entries(roleLabels);
const empty = { fullName: "", email: "", role: "BILLING", password: "", jobTitle: "", phone: "" };

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ error?: boolean; text: string } | null>(null);
  const allowed = !!user && ["ADMIN", "DIRECTION"].includes(user.role);

  async function load() { setLoading(true); try { setUsers((await api<{ users: ManagedUser[] }>("/api/users")).users); } catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : "No fue posible cargar usuarios." }); } finally { setLoading(false); } }
  useEffect(() => { if (allowed) void load(); else setLoading(false); }, [allowed]);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy("create"); setMessage(null);
    try { await api("/api/users", { method: "POST", body: JSON.stringify({ ...form, jobTitle: form.jobTitle || undefined, phone: form.phone || undefined }) }); setForm(empty); setMessage({ text: "Usuario creado y listo para iniciar sesión." }); await load(); }
    catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : "No fue posible crear el usuario." }); }
    finally { setBusy(""); }
  }
  async function update(id: string, change: Partial<ManagedUser>) {
    setBusy(id); setMessage(null);
    try { await api(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(change) }); await load(); }
    catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : "No fue posible actualizar el usuario." }); }
    finally { setBusy(""); }
  }
  if (!allowed) return <div className="fatal-state"><span><ShieldAlert /></span><h1>Acceso restringido</h1><p>Solo Dirección y Administración pueden gestionar usuarios.</p></div>;

  return <>
    <header className="page-heading heading-row"><div><span className="overline dark">ADMINISTRACIÓN</span><h1>Usuarios y permisos</h1><p>Crea accesos por área y controla quién puede operar cada módulo.</p></div><span className="count-pill"><Users size={16} />{users.filter((item) => item.active).length} activos</span></header>
    {message && <div className={`notice ${message.error ? "error" : "success"}`}>{message.text}</div>}
    <div className="management-layout">
      <form className="panel management-form" onSubmit={create}>
        <div className="settings-title"><UserPlus /><div><h2>Nuevo usuario</h2><p>Asigna credenciales y permisos iniciales.</p></div></div>
        <label>Nombre completo<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required /></label>
        <label>Correo corporativo<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
        <label>Área o rol<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Cargo<input value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} placeholder="Opcional" /></label>
        <label>Teléfono<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Opcional" /></label>
        <label>Contraseña temporal<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label>
        <small className="field-help">Debe contener 8 caracteres, mayúscula, minúscula y número.</small>
        <button className="button primary" disabled={busy === "create"}><UserPlus size={16} />{busy === "create" ? "Creando…" : "Crear usuario"}</button>
      </form>
      <section className="table-panel management-table">
        {loading ? <div className="empty-state">Cargando usuarios…</div> : <table><thead><tr><th>Usuario</th><th>Rol</th><th>Último acceso</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{users.map((item) => <tr key={item.id}>
          <td><div className="cell-main"><strong>{item.fullName}</strong><span>{item.email}{item.jobTitle ? ` · ${item.jobTitle}` : ""}</span></div></td>
          <td><select className="table-select" value={item.role} disabled={busy === item.id} onChange={(event) => void update(item.id, { role: event.target.value })}>{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
          <td>{item.lastLoginAt ? dateTime(item.lastLoginAt) : "Sin ingreso"}</td>
          <td><span className={`status ${item.active ? "status-approved" : "status-rejected"}`}>{item.active ? "Activo" : "Inactivo"}</span></td>
          <td><button className="text-button" disabled={busy === item.id || item.id === user.id} onClick={() => void update(item.id, { active: !item.active })}>{busy === item.id ? "Guardando…" : item.active ? "Desactivar" : "Activar"}</button></td>
        </tr>)}</tbody></table>}
      </section>
    </div>
  </>;
}
