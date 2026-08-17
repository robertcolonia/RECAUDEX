import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Download, FileSearch, FileSpreadsheet, History, ShieldCheck, UploadCloud, XCircle } from "lucide-react";
import { api, uploadDataFile } from "../api/client";
import { dateTime } from "../data";

type Dataset = { type: string; label: string; description: string; required: string[]; preview: string[] };
type Issue = { rowNumber: number; severity: "ERROR" | "WARNING"; code: string; message: string };
type PreviewRow = { rowNumber: number; values: Record<string, string>; valid: boolean; issues: Issue[] };
type Preview = { datasetType: string; fileName: string; fileType: string; checksum: string; headers: string[]; totalRows: number; validRows: number; rejectedRows: number; warningRows: number; duplicateImport: boolean; issues: Issue[]; sample: PreviewRow[] };
type ImportRecord = { id: string; datasetType: string; fileName: string; fileType: string; totalRows: number; validRows: number; importedRows: number; rejectedRows: number; status: string; summary: { skippedRows?: number; warnings?: number; errors?: number } | null; createdAt: string; user: { fullName: string; email: string } };

export function DataImportsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [datasetType, setDatasetType] = useState("CLIENTS");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [message, setMessage] = useState<{ error?: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const [config, imported] = await Promise.all([api<{ datasets: Dataset[] }>("/api/imports/config"), api<{ imports: ImportRecord[] }>("/api/imports")]);
      setDatasets(config.datasets); setHistory(imported.imports);
    } catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : "No fue posible cargar el módulo." }); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { setFile(null); setPreview(null); setMessage(null); if (inputRef.current) inputRef.current.value = ""; }, [datasetType]);

  const current = datasets.find((item) => item.type === datasetType);
  const groupedIssues = useMemo(() => {
    const groups = new Map<string, { severity: string; message: string; count: number; rows: number[] }>();
    for (const issue of preview?.issues || []) {
      const key = `${issue.severity}|${issue.code}|${issue.message}`;
      const group = groups.get(key) || { severity: issue.severity, message: issue.message, count: 0, rows: [] };
      group.count += 1; if (issue.rowNumber) group.rows.push(issue.rowNumber); groups.set(key, group);
    }
    return [...groups.values()].slice(0, 12);
  }, [preview]);

  function selectFile(selected: File | null) {
    setPreview(null); setMessage(null);
    if (!selected) return setFile(null);
    if (!/\.(csv|xlsx)$/i.test(selected.name)) { setFile(null); return setMessage({ error: true, text: "Selecciona un archivo CSV o XLSX." }); }
    if (selected.size > 12 * 1024 * 1024) { setFile(null); return setMessage({ error: true, text: "El archivo supera el límite de 12 MB." }); }
    setFile(selected);
  }

  async function analyze() {
    if (!file) return;
    setBusy("preview"); setMessage(null);
    try { setPreview((await uploadDataFile<{ preview: Preview }>("/api/imports/preview", file, datasetType)).preview); }
    catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : "No fue posible analizar el archivo." }); }
    finally { setBusy(null); }
  }

  async function commit() {
    if (!file || !preview || preview.duplicateImport || !preview.validRows) return;
    setBusy("commit"); setMessage(null);
    try {
      const result = await uploadDataFile<{ record: ImportRecord }>("/api/imports/commit", file, datasetType, "POST");
      setMessage({ text: `Importación completada: ${result.record.importedRows.toLocaleString("es-PE")} registros incorporados y ${result.record.rejectedRows.toLocaleString("es-PE")} rechazados.` });
      setFile(null); setPreview(null); if (inputRef.current) inputRef.current.value = ""; await load();
    } catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : "No fue posible confirmar la importación." }); }
    finally { setBusy(null); }
  }

  function template() {
    if (!current) return;
    const blob = new Blob([`${current.required.join("|")}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `plantilla_${current.type.toLowerCase()}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <>
    <header className="page-heading heading-row"><div><span className="overline dark">INTEGRACIÓN CONTROLADA</span><h1>Importación de datos</h1><p>Incorpora archivos CSV o XLSX con validación, vista previa y trazabilidad antes de actualizar PostgreSQL.</p></div><span className="count-pill"><ShieldCheck size={15}/> Máx. 12 MB · 20,000 filas</span></header>
    {message && <div className={`notice ${message.error ? "error" : "success"}`}>{message.error ? <XCircle size={17}/> : <CheckCircle2 size={17}/>} {message.text}</div>}

    <div className="import-layout">
      <section className="panel import-builder">
        <div className="settings-title"><Database/><div><h2>1. Selecciona la fuente</h2><p>Cada formato aplica reglas diferentes antes de permitir su carga.</p></div></div>
        <div className="dataset-picker">{datasets.map((dataset) => <button className={dataset.type === datasetType ? "selected" : ""} key={dataset.type} onClick={() => setDatasetType(dataset.type)}><FileSpreadsheet/><span><strong>{dataset.label}</strong><small>{dataset.description}</small></span></button>)}</div>
        {current && <div className="template-note"><div><strong>Columnas mínimas</strong><span>{current.required.join(" · ")}</span></div><button className="button secondary small" onClick={template}><Download size={14}/> Plantilla CSV</button></div>}
      </section>

      <section className="panel import-uploader">
        <div className="settings-title"><UploadCloud/><div><h2>2. Carga y analiza</h2><p>El archivo no se incorpora hasta que confirmes la vista previa.</p></div></div>
        <label className={`file-drop ${file ? "has-file" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0] || null); }}>
          <input ref={inputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => selectFile(event.target.files?.[0] || null)} />
          <span><FileSpreadsheet/></span><strong>{file ? file.name : "Arrastra el archivo o selecciónalo"}</strong><small>{file ? `${(file.size / 1024).toLocaleString("es-PE", { maximumFractionDigits: 1 })} KB` : "CSV o XLSX · primera hoja · sin macros"}</small>
        </label>
        <button className="button primary import-analyze" disabled={!file || Boolean(busy)} onClick={() => void analyze()}><FileSearch size={16}/>{busy === "preview" ? "Validando estructura…" : "Analizar archivo"}</button>
      </section>
    </div>

    {preview && <section className="import-preview">
      <div className="preview-heading"><div><span className="overline dark">VISTA PREVIA</span><h2>{preview.fileName}</h2><p>{preview.fileType} · huella {preview.checksum.slice(0, 12)} · los registros rechazados nunca se insertan.</p></div>{preview.duplicateImport && <span className="duplicate-warning"><AlertTriangle/> Archivo ya importado</span>}</div>
      <div className="import-metrics"><article><span>Total</span><strong>{preview.totalRows.toLocaleString("es-PE")}</strong></article><article className="valid"><span>Válidos</span><strong>{preview.validRows.toLocaleString("es-PE")}</strong></article><article className="warn"><span>Con advertencia</span><strong>{preview.warningRows.toLocaleString("es-PE")}</strong></article><article className="invalid"><span>Rechazados</span><strong>{preview.rejectedRows.toLocaleString("es-PE")}</strong></article></div>
      {groupedIssues.length > 0 && <div className="issue-list">{groupedIssues.map((issue, index) => <div className={issue.severity === "ERROR" ? "issue-error" : "issue-warning"} key={`${issue.message}-${index}`}>{issue.severity === "ERROR" ? <XCircle/> : <AlertTriangle/>}<span><strong>{issue.message}</strong><small>{issue.rows.length ? `Filas ${issue.rows.slice(0, 6).join(", ")}${issue.rows.length > 6 ? "…" : ""}` : "Estructura del archivo"}</small></span><b>{issue.count}</b></div>)}</div>}
      <div className="table-panel import-table"><table><thead><tr><th>Fila</th><th>Validación</th>{preview.headers.map((header) => <th key={header}>{header.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{preview.sample.map((row) => <tr key={row.rowNumber}><td className="mono">{row.rowNumber}</td><td><span className={`status ${row.valid ? row.issues.length ? "status-pending" : "status-approved" : "status-rejected"}`}>{row.valid ? row.issues.length ? "Advertencia" : "Válido" : "Rechazado"}</span></td>{preview.headers.map((header) => <td key={header}>{row.values[header] || "—"}</td>)}</tr>)}</tbody></table></div>
      <div className="import-confirm"><div><ShieldCheck/><span><strong>Confirmación controlada</strong><small>Se importarán solo filas válidas. Duplicados existentes se omitirán y el resultado quedará en Auditoría.</small></span></div><button className="button primary" disabled={preview.duplicateImport || !preview.validRows || Boolean(busy)} onClick={() => void commit()}>{busy === "commit" ? "Incorporando a PostgreSQL…" : `Confirmar ${preview.validRows.toLocaleString("es-PE")} filas válidas`}</button></div>
    </section>}

    <section className="imports-history">
      <div className="preview-heading"><div><span className="overline dark">TRAZABILIDAD</span><h2>Historial de importaciones</h2><p>Cada ejecución conserva archivo, responsable, volumen y resultado.</p></div><History/></div>
      <div className="table-panel"><table><thead><tr><th>Fecha</th><th>Archivo</th><th>Tipo</th><th>Resultado</th><th>Importados</th><th>Rechazados</th><th>Responsable</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{dateTime(item.createdAt)}</td><td><div className="cell-main"><strong>{item.fileName}</strong><span>{item.fileType}</span></div></td><td>{datasets.find((dataset) => dataset.type === item.datasetType)?.label || item.datasetType}</td><td><span className={`status ${item.status === "COMPLETED" ? "status-approved" : "status-pending"}`}>{item.status === "COMPLETED" ? "Completado" : "Con observaciones"}</span></td><td>{item.importedRows.toLocaleString("es-PE")}</td><td>{item.rejectedRows.toLocaleString("es-PE")}</td><td>{item.user.fullName}</td></tr>)}</tbody></table>{!history.length && <div className="empty-state"><FileSpreadsheet/><p>Aún no se han confirmado importaciones.</p></div>}</div>
    </section>
  </>;
}
