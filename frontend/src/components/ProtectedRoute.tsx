import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loader"><div className="logo-mark">RX</div><span>Validando acceso…</span></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

