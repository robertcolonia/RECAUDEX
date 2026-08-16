import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, Pencil, Plus, Search, X } from "lucide-react";
import { api } from "../api/client";

type Customer = { id: string; taxId: string; legalName: string; segment: string | null; status: string | null; department: string | null; province: string | null; district: string | null };
const blank = { taxId: "", legalName: "", segment: "", status: "ACTIVE", department: "", province: "", district: "" };

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error?: boolean; text: string } | null>(null);
  async function load() { try { setCustomers((await api<{ customers: Customer[] }>("/api/customers")).customers); } catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : "No fue posible cargar clientes." }); } }
  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => customers.filter((item) => `${item.taxId} ${item.legalName}`.toLowerCase().includes(search.toLowerCase())), [customers, search]);
  function start(customer?: Customer) {
    setEditing(customer?.id || null); setForm(customer ? { taxId: customer.taxId, legalName: customer.legalName, segment: customer.segment || "", status: customer.status || "ACTIVE", department: customer.department || "", province: customer.province || "", district: customer.district || "" } : blank); setOpen(true); setMessage(null);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try { await api(editing ? `/api/customers/${editing}` : "/api/customers", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) }); setOpen(false); setMessage({ text: editing ? "Cliente actualizado." : "Cliente registrado." }); await load(); }
    catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : "No fue posible guardar el cliente." }); }
    finally { setBusy(false); }
  }
  return <>
    <header className="page-heading heading-row"><div><span className="overline dark">MAESTRO COMERCIAL</span><h1>Clientes B2B</h1><p>Administra pagadores y empresas vinculadas al ciclo de ingresos.</p></div><button className="button primary" onClick={() => start()}><Plus size={17} />Registrar cliente</button></header>
    {message && <div className={`notice ${message.error ? "error" : "success"}`}>{message.text}</div>}
    <section className="panel list-toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por razón social o RUC" /></label><span>{visible.length} clientes</span></section>
    <section className="table-panel"><table><thead><tr><th>Cliente</th><th>RUC</th><th>Segmento</th><th>Ubicación</th><th>Estado</th><th></th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><div className="cell-main"><strong>{item.legalName}</strong><span>Cuenta empresarial</span></div></td><td className="mono">{item.taxId}</td><td>{item.segment || "—"}</td><td>{[item.district, item.province, item.department].filter(Boolean).join(", ") || "—"}</td><td><span className={`status ${item.status === "ACTIVE" || item.status === "ACTIVO" ? "status-approved" : "status-pending"}`}>{item.status || "Sin estado"}</span></td><td><button className="icon-button" onClick={() => start(item)} aria-label={`Editar ${item.legalName}`}><Pencil size={15} /></button></td></tr>)}</tbody></table>{!visible.length && <div className="empty-state"><Building2 size={25} /><p>No se encontraron clientes.</p></div>}</section>
    {open && <div className="modal-backdrop" role="presentation"><form className="modal-card" onSubmit={save}><button type="button" className="modal-close" onClick={() => setOpen(false)}><X /></button><div className="settings-title"><Building2 /><div><h2>{editing ? "Editar cliente" : "Registrar cliente"}</h2><p>Información fiscal y comercial básica.</p></div></div><div className="form-grid two"><label>RUC<input value={form.taxId} onChange={(event) => setForm({ ...form, taxId: event.target.value })} required /></label><label>Estado<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="ACTIVE">Activo</option><option value="PROSPECT">Prospecto</option><option value="BLOCKED">Bloqueado</option><option value="INACTIVE">Inactivo</option></select></label></div><label>Razón social<input value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} required /></label><label>Segmento<input value={form.segment} onChange={(event) => setForm({ ...form, segment: event.target.value })} placeholder="Ej. Corporativo" /></label><div className="form-grid three"><label>Departamento<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label><label>Provincia<input value={form.province} onChange={(event) => setForm({ ...form, province: event.target.value })} /></label><label>Distrito<input value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} /></label></div><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Guardando…" : "Guardar cliente"}</button></div></form></div>}
  </>;
}
