// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { agents } from "../data";
import { AgentPage } from "./AgentPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("rutas de agentes", () => {
  for (const agent of agents) {
    it(`renderiza ${agent.code} sin dejar la aplicación en blanco`, async () => {
      vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        const body = url.includes("/workspace") ? {
          provider: { configured: false, ready: true, provider: "RECAUDEX Expert Engine", model: "Motor experto v1", mode: "EXPERT_ENGINE", tokensUsedToday: 0, dailyTokenBudget: 250000, maxOutputTokens: 900 },
          generatedAt: new Date().toISOString(),
          title: "Centro operativo",
          insight: "Datos listos para análisis.",
          kpis: [{ label: "Casos", value: "12", detail: "En PostgreSQL", tone: "blue" }],
          items: [], actions: []
        } : { conversations: [] };
        return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
      }));
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[`/agentes/${agent.code}`]}>
            <Routes><Route path="/agentes/:code" element={<AgentPage />} /></Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => expect(screen.getByRole("heading", { name: agent.name })).toBeTruthy());
      expect(screen.getByText("Centro de trabajo")).toBeTruthy();
      await waitFor(() => expect(screen.getByText("Motor experto RECAUDEX activo")).toBeTruthy());
      client.clear();
    });
  }
});
