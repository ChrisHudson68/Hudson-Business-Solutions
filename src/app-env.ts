export type AppEnv = {
  Variables: {
    tenant: { id: number; name: string; subdomain: string; logo_path: string | null } | null;
    subdomain: string | null;
    user: { id: number; name: string; email: string; role: string; tenant_id: number } | null;
    csrfToken: string;
  };
};
