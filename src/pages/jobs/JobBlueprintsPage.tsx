import type { FC } from 'hono/jsx';

interface JobRow {
  id: number;
  job_name: string | null;
  job_code: string | null;
  client_name: string | null;
  status: string | null;
  blueprint_count: number;
}

interface BlueprintRow {
  id: number;
  title: string;
  notes: string | null;
  original_filename: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

interface SelectedJob {
  id: number;
  job_name: string | null;
  job_code: string | null;
  client_name: string | null;
  job_description: string | null;
  status: string | null;
}

interface JobBlueprintsPageProps {
  jobs: JobRow[];
  search: string;
  selectedJob: SelectedJob | null;
  documents: BlueprintRow[];
  canManage: boolean;
  csrfToken: string;
  error?: string;
  success?: string;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const JobBlueprintsPage: FC<JobBlueprintsPageProps> = ({
  jobs,
  search,
  selectedJob,
  documents,
  canManage,
  csrfToken,
  error,
  success,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Job Blueprints</h1>
          <p>Employees can open job blueprints by job name without seeing job financials.</p>
        </div>
        {selectedJob ? <a class="btn" href="/job-blueprints">Clear Selection</a> : null}
      </div>

      {error ? <div class="card" style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;">{error}</div> : null}
      {success ? <div class="card" style="margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;">{success}</div> : null}

      <div class="card" style="margin-bottom:14px;">
        <form method="get" action="/job-blueprints" class="mobile-stack" style="display:flex; gap:10px; align-items:end; flex-wrap:wrap;">
          <div style="flex:1 1 280px; min-width:240px;">
            <label>Find Job</label>
            <input type="text" name="search" value={search} placeholder="Search by job name, code, or client" />
          </div>
          {selectedJob ? <input type="hidden" name="job_id" value={String(selectedJob.id)} /> : null}
          <button class="btn btn-primary" type="submit">Search</button>
          {search ? <a class="btn" href={selectedJob ? `/job-blueprints?job_id=${selectedJob.id}` : '/job-blueprints'}>Reset</a> : null}
        </form>
      </div>

      <div class="grid grid-2" style="align-items:start;">
        <div class="card">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;">
            <b>Choose Job</b>
            <span class="badge">{jobs.length}</span>
          </div>

          {jobs.length > 0 ? (
            <div style="display:flex; flex-direction:column; gap:10px;">
              {jobs.map((job) => {
                const isActive = selectedJob?.id === job.id;
                const href = search ? `/job-blueprints?job_id=${job.id}&search=${encodeURIComponent(search)}` : `/job-blueprints?job_id=${job.id}`;
                return (
                  <a
                    href={href}
                    class="card"
                    style={`padding:14px; border:${isActive ? '2px solid #1E3A5F' : '1px solid var(--border)'}; background:${isActive ? '#EFF6FF' : '#fff'}; text-decoration:none;`}
                  >
                    <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                      <div>
                        <div style="font-weight:800;">{job.job_name || 'Unnamed Job'}</div>
                        <div class="muted small" style="margin-top:4px;">{job.client_name || 'No client'} • {job.job_code || 'No job code'}</div>
                        <div class="muted small" style="margin-top:4px;">Status: {job.status || 'Unknown'}</div>
                      </div>
                      <span class="badge">{job.blueprint_count}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div class="muted">No jobs matched your search.</div>
          )}
        </div>

        <div style="display:flex; flex-direction:column; gap:14px;">
          <div class="card">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div>
                <b>{selectedJob ? selectedJob.job_name || 'Unnamed Job' : 'Select a job'}</b>
                <div class="muted" style="margin-top:6px;">
                  {selectedJob ? `${selectedJob.client_name || 'No client'} • ${selectedJob.job_code || 'No job code'} • ${selectedJob.status || 'Unknown status'}` : 'Pick a job from the list to see blueprint files.'}
                </div>
              </div>
              {selectedJob ? <span class="badge">{documents.length} blueprint{documents.length === 1 ? '' : 's'}</span> : null}
            </div>
            {selectedJob?.job_description ? (
              <div class="muted" style="margin-top:12px; white-space:pre-wrap;">{selectedJob.job_description}</div>
            ) : selectedJob ? (
              <div class="muted" style="margin-top:12px;">No job description entered.</div>
            ) : null}
          </div>

          {selectedJob ? (
            <div class="card">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;">
                <b>Blueprint Files</b>
              </div>

              {documents.length > 0 ? (
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Uploaded</th>
                        <th>File</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((document) => (
                        <tr>
                          <td>
                            <div><b>{document.title}</b></div>
                            {document.notes ? <div class="muted small" style="margin-top:4px; white-space:pre-wrap;">{document.notes}</div> : null}
                          </td>
                          <td>
                            <div>{formatDateTime(document.created_at)}</div>
                            <div class="muted small" style="margin-top:4px;">{document.uploaded_by_name || 'Unknown user'}</div>
                          </td>
                          <td>
                            <div>{document.original_filename || 'Blueprint file'}</div>
                          </td>
                          <td style="white-space:nowrap;">
                            <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                              <a class="btn" href={`/job-blueprints/files/${document.id}`}>Open</a>
                              {canManage ? (
                                <form method="post" action={`/job-blueprints/${document.id}/archive`} class="inline-form" onsubmit={`return confirm(${JSON.stringify('Archive this blueprint file? It will stay in history but no longer show to employees.')});`}>
                                  <input type="hidden" name="csrf_token" value={csrfToken} />
                                  <button class="btn" type="submit">Archive</button>
                                </form>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div class="muted">No blueprint files have been uploaded for this job yet.</div>
              )}
            </div>
          ) : null}

          {selectedJob && canManage ? (
            <div class="card">
              <b>Upload Blueprint</b>
              <form method="post" action="/job-blueprints/upload" enctype="multipart/form-data" style="margin-top:14px;">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <input type="hidden" name="job_id" value={String(selectedJob.id)} />
                <div class="grid grid-2">
                  <div>
                    <label>Title</label>
                    <input type="text" name="title" maxlength={120} required placeholder="Main plan set" />
                  </div>
                  <div>
                    <label>Blueprint File</label>
                    <input type="file" name="document" accept=".pdf,.png,.jpg,.jpeg,.webp" required />
                  </div>
                </div>
                <div style="margin-top:12px;">
                  <label>Notes</label>
                  <textarea name="notes" rows={4} maxlength={2000} placeholder="Optional notes, revision info, or install reminders"></textarea>
                </div>
                <div class="muted small" style="margin-top:10px;">Admins and managers can upload or archive blueprint files. Employees can open them by job name only.</div>
                <div style="margin-top:14px; display:flex; justify-content:flex-end;">
                  <button class="btn btn-primary" type="submit">Upload Blueprint</button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
