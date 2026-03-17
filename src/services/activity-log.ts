import type { DB } from '../db/connection.js';

export interface ActivityLogInput {
  tenantId: number;
  actorUserId?: number | null;
  eventType: string;
  entityType?: string | null;
  entityId?: number | null;
  description: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

function safeJsonStringify(value: Record<string, unknown> | null | undefined): string | null {
  if (!value) return null;

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function resolveRequestIp(c: any): string | null {
  const direct =
    String(c.req.header('cf-connecting-ip') || '').trim() ||
    String(c.req.header('x-real-ip') || '').trim();

  if (direct) {
    return direct.slice(0, 120);
  }

  const forwarded = String(c.req.header('x-forwarded-for') || '').trim();
  if (!forwarded) return null;

  const first = forwarded.split(',')[0]?.trim() || '';
  return first ? first.slice(0, 120) : null;
}

export function logActivity(db: DB, input: ActivityLogInput): void {
  db.prepare(`
    INSERT INTO activity_logs (
      tenant_id,
      actor_user_id,
      event_type,
      entity_type,
      entity_id,
      description,
      metadata_json,
      ip_address
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.tenantId,
    input.actorUserId ?? null,
    input.eventType,
    input.entityType ?? null,
    input.entityId ?? null,
    input.description,
    safeJsonStringify(input.metadata),
    input.ipAddress ?? null,
  );
}