const explicitUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
const host = import.meta.env.VITE_API_HOST?.replace(/^https?:\/\//, "").replace(/\/$/, "");
export const API_URL = explicitUrl || (host ? `https://${host}` : "http://localhost:4000");

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type ApiOptions = RequestInit & { anonymous?: boolean };

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = sessionStorage.getItem("recaudex_token");
  if (token && !options.anonymous) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.message || "No fue posible completar la solicitud.", response.status);
  return body as T;
}

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const headers = new Headers({ "Content-Type": file.type });
  const token = sessionStorage.getItem("recaudex_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { method: "PUT", headers, body: file });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.message || "No fue posible subir el archivo.", response.status);
  return body as T;
}

export async function uploadDataFile<T>(path: string, file: File, datasetType: string, method: "PUT" | "POST" = "PUT"): Promise<T> {
  const headers = new Headers({
    "Content-Type": file.type || "application/octet-stream",
    "X-File-Name": encodeURIComponent(file.name)
  });
  const token = sessionStorage.getItem("recaudex_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}?datasetType=${encodeURIComponent(datasetType)}`, { method, headers, body: file });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.message || "No fue posible procesar el archivo.", response.status);
  return body as T;
}

export async function authenticatedBlob(path: string): Promise<Blob | null> {
  const headers = new Headers();
  const token = sessionStorage.getItem("recaudex_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.message || "No fue posible obtener el archivo.", response.status);
  }
  return response.blob();
}
