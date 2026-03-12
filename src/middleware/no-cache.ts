import { createMiddleware } from 'hono/factory';

export const noCacheMiddleware = createMiddleware(async (c, next) => {
  await next();

  if (c.req.path.startsWith('/static/')) {
    return;
  }

  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
});
