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
}) => {
  const hasEstimates = estimates.length > 0;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Estimates</h1>
          <p class="muted">Track open estimates before they become active jobs.</p>
        </div>
        <div class="actions actions-mobile-stack">
          {canCreateEstimates ? <a class="btn btn-primary" href="/estimates/new">New Estimate</a> : null}
        </div>
      </div>

      <div class="grid grid-4 mobile-card-grid" style="margin-bottom:14px;">
        <div class="card mobile-kpi-card">
          <div class="metric-label">Total Estimates</div>
          <div class="metric-value">{totalCount}</div>
        </div>
        <div class="card mobile-kpi-card">
          <div class="metric-label">Pipeline Value</div>
          <div class="metric-value">${formatMoney(totalValue)}</div>
        </div>
        <div class="card mobile-kpi-card">
          <div class="metric-label">Draft + Ready</div>
          <div class="metric-value">{draftCount + readyCount}</div>
        </div>
        <div class="card mobile-kpi-card">
          <div class="metric-label">Approved</div>
          <div class="metric-value">{approvedCount}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div class="actions actions-mobile-stack">
          <a class={`btn ${selectedStatus === '' ? 'btn-primary' : ''}`} href="/estimates">All</a>
          <a class={`btn ${selectedStatus === 'draft' ? 'btn-primary' : ''}`} href="/estimates?status=draft">Draft ({draftCount})</a>
          <a class={`btn ${selectedStatus === 'ready' ? 'btn-primary' : ''}`} href="/estimates?status=ready">Ready ({readyCount})</a>
          <a class={`btn ${selectedStatus === 'sent' ? 'btn-primary' : ''}`} href="/estimates?status=sent">Sent ({sentCount})</a>
          <a class={`btn ${selectedStatus === 'approved' ? 'btn-primary' : ''}`} href="/estimates?status=approved">Approved ({approvedCount})</a>
          <a class={`btn ${selectedStatus === 'rejected' ? 'btn-primary' : ''}`} href="/estimates?status=rejected">Rejected ({rejectedCount})</a>
        </div>
      </div>

      <div class="card">
        {hasEstimates ? (
          <div class="table-wrap table-wrap-tight">
            <table class="table">
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
                      <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                        <a class="btn" href={`/estimate/${estimate.id}`}>View</a>
                        {(estimate.status === 'draft' || estimate.status === 'ready') && canCreateEstimates ? (
                          <a class="btn" href={`/estimate/${estimate.id}/edit`}>Edit</a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style="text-align:center; padding:36px 20px;">
            <div
              style="
                width:64px;
                height:64px;
                margin:0 auto 16px;
                border-radius:18px;
                background:#EFF6FF;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:28px;
              "
            >
              📋
            </div>
            <h2 style="margin:0 0 8px;">No estimates yet</h2>
            <p class="muted" style="max-width:560px; margin:0 auto 16px;">
              Use estimates to capture scope, pricing, and customer details before a job becomes active.
            </p>
            {canCreateEstimates ? <a class="btn btn-primary" href="/estimates/new">Create First Estimate</a> : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default EstimatesListPage;
