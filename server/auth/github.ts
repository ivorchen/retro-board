/**
 * GitHub OAuth helpers: authorize URL, code→token exchange, profile fetch.
 *
 * Secrets (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET) are read from env only —
 * never hard-coded. Every function that needs them throws a descriptive
 * error when they are missing instead of building a broken request.
 */

export function getAppUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getGithubAuthUrl(state: string): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("GITHUB_CLIENT_ID is not set");
  }
  const redirectUri = `${getAppUrl()}/api/auth/github/callback`;
  return (
    "https://github.com/login/oauth/authorize" +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=read:user%20user:email` +
    `&state=${encodeURIComponent(state)}`
  );
}

/** Exchanges an OAuth authorization code for a user access token. */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GitHub OAuth is not configured (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)"
    );
  }
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      `GitHub token exchange failed: ${
        data.error_description ?? data.error ?? res.statusText
      }`
    );
  }
  return data.access_token;
}

export interface GithubProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

/** Fetches the GitHub profile; falls back to /user/emails for the primary
 *  verified address when the profile's public email is null. */
export async function getGithubProfile(
  accessToken: string
): Promise<GithubProfile> {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const res = await fetch("https://api.github.com/user", { headers });
  if (!res.ok) {
    throw new Error(`GitHub profile fetch failed: ${res.status}`);
  }
  const u = (await res.json()) as {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  };

  let email = u.email;
  if (!email) {
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers,
    });
    if (emailRes.ok) {
      const emails = (await emailRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary =
        emails.find((e) => e.primary && e.verified) ??
        emails.find((e) => e.verified) ??
        emails[0];
      email = primary?.email ?? null;
    }
  }

  return {
    id: u.id,
    login: u.login,
    name: u.name,
    email,
    avatar_url: u.avatar_url,
  };
}
