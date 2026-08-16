import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AgentPage } from "./pages/AgentPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { AuditPage } from "./pages/AuditPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProfilePage } from "./pages/ProfilePage";
import { UsersPage } from "./pages/UsersPage";
import { CustomersPage } from "./pages/CustomersPage";
import { BankAccountsPage } from "./pages/BankAccountsPage";
import { ReconciliationPage } from "./pages/ReconciliationPage";
import { PitchDemoPage } from "./pages/PitchDemoPage";
import { LandingPage } from "./pages/LandingPage";

const shell = (page: React.ReactNode) => <ErrorBoundary><AppShell>{page}</AppShell></ErrorBoundary>;

export default function App() {
  return <Routes>
    <Route index element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/registro" element={<RegisterPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="dashboard" element={shell(<DashboardPage />)} />
      <Route path="agentes/:code" element={shell(<AgentPage />)} />
      <Route path="conciliacion" element={shell(<ReconciliationPage />)} />
      <Route path="aprobaciones" element={shell(<ApprovalsPage />)} />
      <Route path="auditoria" element={shell(<AuditPage />)} />
      <Route path="demo" element={shell(<PitchDemoPage />)} />
      <Route path="perfil" element={shell(<ProfilePage />)} />
      <Route path="usuarios" element={shell(<UsersPage />)} />
      <Route path="clientes" element={shell(<CustomersPage />)} />
      <Route path="bancos" element={shell(<BankAccountsPage />)} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
