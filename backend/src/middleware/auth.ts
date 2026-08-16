import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthUser, AuthenticatedRequest } from "../types.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const value = req.headers.authorization;
  if (!value?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Sesión requerida." });
  }

  try {
    const payload = jwt.verify(value.slice(7), env.JWT_SECRET) as AuthUser;
    (req as AuthenticatedRequest).auth = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "La sesión no es válida o expiró." });
  }
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).auth;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Tu rol no autoriza esta operación." });
    }
    return next();
  };
}

