import { useState, type ReactNode } from "react";
import { Activity, Bot, Building2, CheckCircle2, FileSearch, FileSpreadsheet, Landmark, LayoutDashboard, LogOut, Menu, PlayCircle, ShieldCheck, UserCircle, Users, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { agents, roleLabels } from "../data";
import { ProfileAvatar } from "./ProfileAvatar";

const primary = [
  { to: "/dashboard", label: "Torre de control", icon: LayoutDashboard },
  { to: "/demo", label: "Demo MVP", icon: PlayCircle },
  { to: "/conciliacion", label: "Conciliación", icon: FileSearch },
  { to: "/aprobaciones", label: "Aprobaciones", icon: CheckCircle2 },
  { to: "/auditoria", label: "Auditoría", icon: ShieldCheck }
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return <div className="app-shell">
    <button className="mobile-menu" aria-label="Abrir navegación" onClick={() => setOpen(true)}><Menu size={22} /></button>
    {open && <button className="sidebar-backdrop" aria-label="Cerrar navegación" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand-row">
        <img className="brand-symbol" src="/assets/recaudex-icon.png" alt="Símbolo RECAUDEX" />
        <div><strong>RECAUDEX</strong><span>Revenue Assurance</span></div>
        <button className="close-menu" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
      </div>
      <nav className="nav-stack" onClick={() => setOpen(false)}>
        <span className="nav-eyebrow">OPERACIÓN</span>
        {primary.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><Icon size={18} /><span>{label}</span></NavLink>)}
        <span className="nav-eyebrow nav-agents"><Bot size={14} /> AGENTES DE IA</span>
        {agents.map((agent) => <NavLink key={agent.code} to={`/agentes/${agent.code}`} className={({ isActive }) => `nav-item agent-nav ${isActive ? "active" : ""}`}><span className="agent-dot" style={{ background: agent.color }} /> <span><b>{agent.code}</b> {agent.name}</span></NavLink>)}
        <span className="nav-eyebrow nav-agents">GESTIÓN</span>
        {user && ["ADMIN", "DIRECTION", "BILLING", "COLLECTIONS", "RECONCILIATION", "FINANCE"].includes(user.role) && <NavLink to="/importaciones" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><FileSpreadsheet size={18} /><span>Importar datos</span></NavLink>}
        <NavLink to="/clientes" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><Building2 size={18} /><span>Clientes B2B</span></NavLink>
        {user && ["ADMIN", "DIRECTION", "FINANCE", "RECONCILIATION"].includes(user.role) && <NavLink to="/bancos" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><Landmark size={18} /><span>Cuentas bancarias</span></NavLink>}
        {user && ["ADMIN", "DIRECTION"].includes(user.role) && <NavLink to="/usuarios" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><Users size={18} /><span>Usuarios</span></NavLink>}
      </nav>
      <div className="sidebar-user">
        <ProfileAvatar fullName={user?.fullName} updatedAt={user?.avatarUpdatedAt} />
        <NavLink to="/perfil" className="user-copy" title="Abrir mi perfil"><strong>{user?.fullName}</strong><span><UserCircle size={11} /> {roleLabels[user?.role || ""] || user?.role}</span></NavLink>
        <button onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={18} /></button>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><Activity size={17} /><span>Operación conectada</span></div><span className="org-name">{user?.organizationName}</span></header>
      <div className="page-container">{children}</div>
    </main>
  </div>;
}
