/**
 * Public origin of this app. Docker binds HOSTNAME=0.0.0.0 so Next's
 * `req.url` is http://0.0.0.0:3000 — unusable as a browser redirect.
 */
export function getAppUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function appUrl(path: string): URL {
  return new URL(path, `${getAppUrl()}/`);
}
