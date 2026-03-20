import type { DB } from '../db/connection.js';
import * as estimates from '../db/queries/estimates.js';
import * as jobs from '../db/queries/jobs.js';
import { logActivity } from './activity-log.js';

function buildJobName(customerName: string, siteAddress?: string | null): string {
  const customer = String(customerName || '').trim() || 'New Job';
  const site = String(siteAddress || '').trim();

  const raw = site ? `${customer} - ${site}` : customer;
  return raw.slice(0, 120);
}

export function convertApprovedEstimateToJob(
  db: DB,
  estimateId: number,
  tenantId: number,
  options?: {
    approvalNotes?: string | null;
    ipAddress?: string | null;
  },
): { jobId: number } {
  const estimate = estimates.findWithLineItemsById(db, estimateId, tenantId);

  if (!estimate) {
    throw new Error('Estimate not found.');
  }

  if (estimate.converted_job_id) {
    return { jobId: estimate.converted_job_id };
  }

  const convertTxn = db.transaction(() => {
    const respondedAt = new Date().toISOString();

    const jobId = jobs.create(db, tenantId, {
      job_name: buildJobName(estimate.customer_name, estimate.site_address),
      client_name: estimate.customer_name,
      contract_amount: Number(estimate.total || 0),
      retainage_percent: 0,
      start_date: null,
      status: 'Active',
      source_estimate_id: estimate.id,
    });

    estimates.update(db, estimate.id, tenantId, {
      status: 'converted',
      responded_at: estimate.responded_at || respondedAt,
      approval_notes: options?.approvalNotes ?? estimate.approval_notes ?? null,
      converted_job_id: jobId,
    });

    logActivity(db, {
      tenantId,
      actorUserId: null,
      eventType: 'estimate.approved',
      entityType: 'estimate',
      entityId: estimate.id,
      description: `Customer approved estimate ${estimate.estimate_number}.`,
      metadata: {
        estimate_number: estimate.estimate_number,
        response_type: 'approved',
        approval_notes: options?.approvalNotes ?? estimate.approval_notes ?? null,
      },
      ipAddress: options?.ipAddress ?? null,
    });

    logActivity(db, {
      tenantId,
      actorUserId: null,
      eventType: 'job.created_from_estimate',
      entityType: 'job',
      entityId: jobId,
      description: `Job created automatically from estimate ${estimate.estimate_number}.`,
      metadata: {
        estimate_id: estimate.id,
        estimate_number: estimate.estimate_number,
        customer_name: estimate.customer_name,
        contract_amount: Number(estimate.total || 0),
      },
      ipAddress: options?.ipAddress ?? null,
    });

    logActivity(db, {
      tenantId,
      actorUserId: null,
      eventType: 'estimate.converted',
      entityType: 'estimate',
      entityId: estimate.id,
      description: `Estimate ${estimate.estimate_number} was converted into job #${jobId}.`,
      metadata: {
        estimate_id: estimate.id,
        estimate_number: estimate.estimate_number,
        converted_job_id: jobId,
      },
      ipAddress: options?.ipAddress ?? null,
    });

    return jobId;
  });

  return { jobId: convertTxn() };
}

export default {
  convertApprovedEstimateToJob,
};