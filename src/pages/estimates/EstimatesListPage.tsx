import type { FC } from 'hono/jsx';
import type { Estimate } from '../../db/types.js';

interface EstimatesListPageProps {
  estimates: Estimate[];
  selectedStatus: string;
  totalCount: number;
  totalValue: number;
  draftCount: number;
  readyCount: number;
  sentCount: number;
  approvedCount: number;
  rejectedCount: number;
  canCreateEstimates?: boolean;
  showArchived?: boolean;
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusBadgeClass(status: string): string {
  if (status === 'approved' || status === 'converted') return 'badge badge-good';
  if (status === 'rejected' || status === 'expired') return 'badge badge-bad';
  if (status === 'ready' || status === 'sent') return 'badge badge-warn';
  return 'badge';
}

export const EstimatesListPage: FC<EstimatesListPageProps> = ({
  estimates,
  selectedStatus,
  totalCount,
  totalValue,
  draftCount,
  readyCount,
  sentCount,
  approvedCount,
  rejectedCount,
  canCreateEstimates,
  showArchived = false,
}) => {
  const hasEstimates = estimates.length > 0;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>{showArchived ? 'Archived Estimates' : 'Estimates'}</h1>
          <p class="muted">{showArchived ? 'Review and restore archived estimates.' : 'Track open estimates before they become active jobs.'}</p>
        </div>
        <div class="actions actions-mobile-stack">
          {showArchived ? <a class="btn" href="/estimates">Back to Active</a> : null}
          {!showArchived && canCreateEstimates ? <a class="btn" href="/estimates/archived">Archived Estimates</a> : null}
          {canCreateEstimates && !showArchived ? <a class="btn btn-primary" href="/estimates/new">New Estimate</a> : null}
        </div>
      </div>

      <div class="stat-grid stat-grid-4" style="margin-bottom:16px;">
        <div class="stat-card stat-card-navy">
          <div class="stat-label">Total Estimates</div>
          <div class="stat-value">{totalCount}</div>
        </div>
        <div class="stat-card stat-card-accent">
          <div class="stat-label">Pipeline Value</div>
          <div class="stat-value">${formatMoney(totalValue)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Draft + Ready</div>
          <div class="stat-value">{draftCount + readyCount}</div>
        </div>
        <div class="stat-card stat-card-green">
          <div class="stat-label">Approved</div>
          <div class="stat-value">{approvedCount}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-head">
          <h3>Filter by Status</h3>
        </div>
        <div class="actions" style="flex-wrap:wrap; gap:6px;">
          <a class={`btn btn-sm ${selectedStatus === '' ? 'btn-navy' : ''}`} href={showArchived ? '/estimates/archived' : '/estimates'}>All ({totalCount})</a>
          <a class={`btn btn-sm ${selectedStatus === 'draft' ? 'btn-navy' : ''}`} href={showArchived ? '/estimates/archived?status=draft' : '/estimates?status=draft'}>Draft ({draftCount})</a>
          <a class={`btn btn-sm ${selectedStatus === 'ready' ? 'btn-navy' : ''}`} href={showArchived ? '/estimates/archived?status=ready' : '/estimates?status=ready'}>Ready ({readyCount})</a>
          <a class={`btn btn-sm ${selectedStatus === 'sent' ? 'btn-navy' : ''}`} href={showArchived ? '/estimates/archived?status=sent' : '/estimates?status=sent'}>Sent ({sentCount})</a>
          <a class={`btn btn-sm ${selectedStatus === 'approved' ? 'btn-navy' : ''}`} href={showArchived ? '/estimates/archived?status=approved' : '/estimates?status=approved'}>Approved ({approvedCount})</a>
          <a class={`btn btn-sm ${selectedStatus === 'rejected' ? 'btn-navy' : ''}`} href={showArchived ? '/estimates/archived?status=rejected' : '/estimates?status=rejected'}>Rejected ({rejectedCount})</a>
        </div>
      </div>

      <div class="card">
        {hasEstimates ? (
          <>
          <div class="card-head">
            <h2>{showArchived ? 'Archived Estimates' : 'Estimates'}</h2>
          </div>
          <div class="table-wrap" style="margin:0 -18px -16px;">
            <table>
              <thead>
                <tr>
                  <th>Estimate</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th class="right">Total</th>
                  <th>Updated</th>
                  <th class="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((estimate) => (
                  <tr>
                    <td>
                      <div><b>{estimate.estimate_number}</b></div>
                      <div class="muted small">{estimate.site_address || 'No site address yet'}</div>
                    </td>
                    <td>
                      <div>{estimate.customer_name}</div>
                      <div class="muted small">{estimate.customer_email || estimate.customer_phone || 'No contact details'}</div>
                    </td>
                    <td>
                      <span class={statusBadgeClass(estimate.status)}>{statusLabel(estimate.status)}</span>
                    </td>
                    <td class="right">${formatMoney(estimate.total)}</td>
                    <td>{estimate.updated_at?.slice(0, 10) || '—'}</td>
                    <td class="right">
                      <div class="actions" style="justify-content:flex-end; gap:6px;">
                        <a class="btn btn-sm" href={`/estimate/${estimate.id}`}>View</a>
                        {(estimate.status === 'draft' || estimate.status === 'ready') && canCreateEstimates ? (
                          <a class="btn btn-sm" href={`/estimate/${estimate.id}/edit`}>Edit</a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <h3>No estimates yet</h3>
            <p>Use estimates to capture scope, pricing, and customer details before a job becomes active.</p>
            {canCreateEstimates ? <a class="btn btn-primary" href="/estimates/new">+ Create First Estimate</a> : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default EstimatesListPage;
