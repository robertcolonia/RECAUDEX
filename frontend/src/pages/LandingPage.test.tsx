// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { LandingPage } from "./LandingPage";

afterEach(() => { cleanup(); sessionStorage.clear(); });

it("explica públicamente qué es RECAUDEX antes del login", () => {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><MemoryRouter><AuthProvider><LandingPage /></AuthProvider></MemoryRouter></QueryClientProvider>);
  expect(screen.getByRole("heading", { name: /Cada depósito/i })).toBeTruthy();
  expect(screen.getByText("NUESTRA MISIÓN")).toBeTruthy();
  expect(screen.getByText("NUESTRA VISIÓN")).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Iniciar sesión" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("link", { name: "Crear cuenta" }).length).toBeGreaterThan(0);
  client.clear();
});
