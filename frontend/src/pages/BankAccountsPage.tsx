import { useEffect, useState, type FormEvent } from "react";
import { CreditCard, Landmark, LockKeyhole, Plus, ShieldCheck, X } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type BankAccount = { id: string; bankName: string; accountAlias: string; accountHolder: string; accountType: string; currency: string; accountNumberLast4: string; maskedAccountNumber: string; active: boolean };
const initial = { bankName: "", accountAlias: "", accountHolder: "", accountType: "CURRENT", currency: "PEN", accountNumber: "" };
const accountTypes: Record<string, string> = { CURRENT: "Cuenta corriente", SAVINGS: "Cuenta de ahorros", COLLECTION: "Cuenta recaudadora" };

export function BankAccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [form, setForm] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ error?: boolean; text: string } | null>(null);
  const allowed = !!user && ["ADMIN", "DIRECTION", "FINANCE", "RECONCILIATION"].includes(user.role);
  async function load() { try { setAccounts((await api<{ accounts: BankAccount[] }>("/api/bank-accounts")).accounts); } catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : "No fue posible cargar las cuentas." }); } }
  useEffect(() => { if (allowed) void load(); }, [allowed]);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy("create"); setMessage(null);
    try { await api("/api/bank-accounts", { method: "POST", body: JSON.stringify(form) }); setForm(initial); setOpen(false); setMessage({ text: "Cuenta bancaria registrada de forma segura." }); await load(); }
    catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : "No fue posible guardar la cuenta." }); }
    finally { setBusy(""); }
  }
  async function toggle(account: BankAccount) {
    setBusy(account.id); setMessage(null);
    try { await api(`/api/bank-accounts/${account.id}`, { method: "PATCH", body: JSON.stringify({ active: !account.active }) }); await load(); }
    catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : "No fue posible actualizar la cuenta." }); }
    finally { setBusy(""); }
  }
  if (!allowed) return <div className="fatal-state"><span><LockKeyhole /></span><h1>Acceso restringido</h1><p>Esta información está reservada para Recaudo, Finanzas y Administración.</p></div>;
  return <>
    <header className="page-heading heading-row"><div><span className="overline dark">CONFIGURACIÓN FINANCIERA</span><h1>Cuentas bancarias</h1><p>Registra las cuentas receptoras utilizadas para identificar y conciliar depósitos.</p></div><button className="button primary" onClick={() => setOpen(true)}><Plus size={17} />Agregar cuenta</button></header>
    <div className="security-banner"><ShieldCheck size={20} /><div><strong>Información financiera protegida</strong><span>El número completo se cifra antes de almacenarse y nunca se devuelve al navegador.</span></div></div>
    {message && <div className={`notice ${message.error ? "error" : "success"}`}>{message.text}</div>}
    <div className="bank-grid">{accounts.map((account) => <article className={`bank-card ${account.active ? "" : "disabled"}`} key={account.id}><div className="bank-card-top"><span><Landmark /></span><div><small>{account.bankName}</small><h2>{account.accountAlias}</h2></div><span className={`status ${account.active ? "status-approved" : "status-rejected"}`}>{account.active ? "Activa" : "Inactiva"}</span></div><div className="masked-number"><CreditCard size={18} /><strong>{account.maskedAccountNumber}</strong></div><dl><div><dt>Titular</dt><dd>{account.accountHolder}</dd></div><div><dt>Tipo</dt><dd>{accountTypes[account.accountType] || account.accountType}</dd></div><div><dt>Moneda</dt><dd>{account.currency}</dd></div></dl><button className="text-button" disabled={busy === account.id} onClick={() => void toggle(account)}>{busy === account.id ? "Guardando…" : account.active ? "Desactivar cuenta" : "Activar cuenta"}</button></article>)}</div>
    {!accounts.length && <div className="panel empty-state"><Landmark size={28} /><p>Aún no hay cuentas bancarias registradas.</p><button className="button secondary" onClick={() => setOpen(true)}>Registrar la primera</button></div>}
    {open && <div className="modal-backdrop"><form className="modal-card" onSubmit={save}><button type="button" className="modal-close" onClick={() => setOpen(false)}><X /></button><div className="settings-title"><Landmark /><div><h2>Nueva cuenta bancaria</h2><p>Solo se mostrará la terminación de la cuenta.</p></div></div><div className="form-grid two"><label>Banco<input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} placeholder="Ej. BCP" required /></label><label>Alias<input value={form.accountAlias} onChange={(event) => setForm({ ...form, accountAlias: event.target.value })} placeholder="Ej. Recaudación soles" required /></label></div><label>Titular<input value={form.accountHolder} onChange={(event) => setForm({ ...form, accountHolder: event.target.value })} required /></label><label>Número de cuenta<input value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} autoComplete="off" required /></label><div className="form-grid two"><label>Tipo<select value={form.accountType} onChange={(event) => setForm({ ...form, accountType: event.target.value })}><option value="CURRENT">Cuenta corriente</option><option value="SAVINGS">Cuenta de ahorros</option><option value="COLLECTION">Cuenta recaudadora</option></select></label><label>Moneda<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option value="PEN">PEN · Soles</option><option value="USD">USD · Dólares</option><option value="EUR">EUR · Euros</option></select></label></div><p className="encryption-note"><LockKeyhole size={15} /> Se almacenará cifrado con AES-256-GCM.</p><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancelar</button><button className="button primary" disabled={busy === "create"}>{busy === "create" ? "Cifrando y guardando…" : "Guardar cuenta"}</button></div></form></div>}
  </>;
}
