import type { Request } from "express";

export type AuthUser = {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: string;
};

export type AuthenticatedRequest = Request & { auth: AuthUser };

export type MatchCandidate = {
  invoiceId: string;
  externalId: string;
  customerId: string;
  totalAmount: number;
  openAmount: number;
  score: number;
  signals: string[];
};

