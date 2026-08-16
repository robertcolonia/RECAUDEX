import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Building2, Camera, Image as ImageIcon, KeyRound, Mail, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { api, uploadFile } from "../api/client";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { useAuth, type User } from "../context/AuthContext";
import { roleLabels } from "../data";

type Notice = { tone: "success" | "error"; text: string } | null;

export function ProfilePage() {
  const { user, updateSession } = useAuth();
  const [profile, setProfile] = useState({ fullName: user?.fullName || "", jobTitle: user?.jobTitle || "", phone: user?.phone || "" });
  const [email, setEmail] = useState({ newEmail: "", confirmEmail: "", currentPassword: "" });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);
  if (!user) return null;

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key); setNotice(null);
    try { await action(); setNotice({ tone: "success", text: "Cambios guardados correctamente." }); }
    catch (cause) { setNotice({ tone: "error", text: cause instanceof Error ? cause.message : "No fue posible guardar los cambios." }); }
    finally { setBusy(""); }
  }

  function saveProfile(event: FormEvent) { event.preventDefault(); return run("profile", async () => {
    const response = await api<{ user: User }>("/api/auth/profile", { method: "PATCH", body: JSON.stringify({ fullName: profile.fullName, jobTitle: profile.jobTitle || null, phone: profile.phone || null }) });
    updateSession(response.user);
  }); }
  function saveEmail(event: FormEvent) { event.preventDefault(); return run("email", async () => {
    const response = await api<{ user: User; token: string }>("/api/auth/email", { method: "PATCH", body: JSON.stringify(email) });
    updateSession(response.user, response.token); setEmail({ newEmail: "", confirmEmail: "", currentPassword: "" });
  }); }
  function savePassword(event: FormEvent) { event.preventDefault(); return run("password", async () => {
    await api("/api/auth/password", { method: "PATCH", body: JSON.stringify(password) }); setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }); }
  function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setNotice({ tone: "error", text: "Selecciona una imagen JPG, PNG o WebP de hasta 2 MB." });
      return;
    }
    return run("avatar", async () => {
      const response = await uploadFile<{ user: User }>("/api/auth/avatar", file);
      updateSession(response.user);
    });
  }
  function removeAvatar() { return run("avatar", async () => {
    const response = await api<{ user: User }>("/api/auth/avatar", { method: "DELETE" });
    updateSession(response.user);
  }); }

  return <>
    <header className="page-heading"><span className="overline dark">CUENTA PERSONAL</span><h1>Mi perfil</h1><p>Administra tus datos de contacto y credenciales de acceso.</p></header>
    <section className="profile-hero panel">
      <ProfileAvatar fullName={user.fullName} updatedAt={user.avatarUpdatedAt} className="profile-avatar" />
      <div><h2>{user.fullName}</h2><p>{user.email}</p><span className="status status-approved">{roleLabels[user.role] || user.role}</span></div>
      <div className="profile-org"><Building2 size={18} /><span><small>Organización</small><strong>{user.organizationName}</strong>{user.organizationTaxId && <small>RUC {user.organizationTaxId}</small>}</span></div>
    </section>
    {notice && <div className={`notice ${notice.tone}`}>{notice.tone === "success" ? <ShieldCheck size={17} /> : null}{notice.text}</div>}
    <div className="settings-grid">
      <section className="panel settings-card avatar-card">
        <div className="settings-title"><ImageIcon /><div><h2>Foto de perfil</h2><p>Se mostrará en tu cuenta y menú lateral.</p></div></div>
        <div className="avatar-card-preview"><ProfileAvatar fullName={user.fullName} updatedAt={user.avatarUpdatedAt} className="profile-avatar profile-avatar-large" /></div>
        <input ref={avatarInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} />
        <button type="button" className="button secondary" disabled={busy === "avatar"} onClick={() => avatarInput.current?.click()}><Camera size={16} />{busy === "avatar" ? "Procesando…" : user.avatarUpdatedAt ? "Cambiar foto" : "Subir foto"}</button>
        {user.avatarUpdatedAt && <button type="button" className="button danger-outline" disabled={busy === "avatar"} onClick={removeAvatar}><Trash2 size={16} />Eliminar foto</button>}
        <small className="field-help">JPG, PNG o WebP · máximo 2 MB. La imagen queda protegida en tu cuenta.</small>
      </section>
      <form className="panel settings-card" onSubmit={saveProfile}>
        <div className="settings-title"><UserRound /><div><h2>Información personal</h2><p>Datos visibles para tu equipo.</p></div></div>
        <label>Nombre completo<input value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} required /></label>
        <label>Cargo o función<input value={profile.jobTitle} onChange={(event) => setProfile({ ...profile, jobTitle: event.target.value })} placeholder="Ej. Analista de recaudo" /></label>
        <label>Teléfono<input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="Ej. +51 999 999 999" /></label>
        <button className="button primary" disabled={busy === "profile"}><Save size={16} />{busy === "profile" ? "Guardando…" : "Guardar perfil"}</button>
      </form>
      <form className="panel settings-card" onSubmit={saveEmail}>
        <div className="settings-title"><Mail /><div><h2>Cambiar correo</h2><p>Requiere confirmar tu contraseña.</p></div></div>
        <div className="current-value">Correo actual <strong>{user.email}</strong></div>
        <label>Nuevo correo<input type="email" value={email.newEmail} onChange={(event) => setEmail({ ...email, newEmail: event.target.value })} required /></label>
        <label>Confirmar nuevo correo<input type="email" value={email.confirmEmail} onChange={(event) => setEmail({ ...email, confirmEmail: event.target.value })} required /></label>
        <label>Contraseña actual<input type="password" value={email.currentPassword} onChange={(event) => setEmail({ ...email, currentPassword: event.target.value })} autoComplete="current-password" required /></label>
        <button className="button secondary" disabled={busy === "email"}><Mail size={16} />{busy === "email" ? "Actualizando…" : "Actualizar correo"}</button>
      </form>
      <form className="panel settings-card" onSubmit={savePassword}>
        <div className="settings-title"><KeyRound /><div><h2>Cambiar contraseña</h2><p>Protege el acceso a tu cuenta.</p></div></div>
        <label>Contraseña actual<input type="password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} autoComplete="current-password" required /></label>
        <label>Nueva contraseña<input type="password" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} autoComplete="new-password" required /></label>
        <label>Confirmar nueva contraseña<input type="password" value={password.confirmPassword} onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })} autoComplete="new-password" required /></label>
        <small className="field-help">Mínimo 8 caracteres, una mayúscula, una minúscula y un número.</small>
        <button className="button secondary" disabled={busy === "password"}><KeyRound size={16} />{busy === "password" ? "Actualizando…" : "Actualizar contraseña"}</button>
      </form>
    </div>
  </>;
}
