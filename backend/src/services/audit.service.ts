import { prisma } from "../config/database.js";

type AuditInput = {
  organizationId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  detail?: unknown;
  ipAddress?: string;
};

export async function audit(input: AuditInput) {
  return prisma.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      detail: input.detail as object | undefined,
      ipAddress: input.ipAddress
    }
  });
}

