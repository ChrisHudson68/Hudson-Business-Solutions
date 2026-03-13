export type AppEnv = {
  Variables: {
    tenant:
      | {
          id: number;
          name: string;
          subdomain: string;
          logo_path: string | null;
          billing_exempt: number;
          billing_status: string;
          billing_plan: string | null;
          billing_trial_ends_at: string | null;
          billing_grace_ends_at: string | null;
        }
      | null;
    subdomain: string | null;
    user: { id: number; name: string; email: string; role: string; tenant_id: number } | null;
    platformAdmin: { email: string } | null;
    csrfToken: string;
  };
};