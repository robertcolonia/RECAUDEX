import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("RECAUDEX render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <div className="fatal-state">
      <span><AlertTriangle size={24} /></span>
      <h1>No se pudo mostrar esta sección</h1>
      <p>La sesión permanece activa. Recarga la vista para recuperar la interfaz.</p>
      {import.meta.env.DEV && <code>{this.state.error.message}</code>}
      <button className="button primary" onClick={() => window.location.reload()}><RefreshCw size={16} /> Recargar</button>
    </div>;
  }
}

