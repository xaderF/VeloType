import { normalizeEmail } from './auth.js';
import { env } from './env.js';

type OAuthProvider = 'google' | 'discord' | 'github';

type VerifyOAuthInput = {
  idToken?: string;
  accessToken?: string;
};

export type VerifiedOAuthIdentity = {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  usernameHint?: string;
};

function asProvider(raw: string): OAuthProvider | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'google' || normalized === 'discord' || normalized === 'github') {
    return normalized;
  }
  return null;
}

async function verifyGoogle(input: VerifyOAuthInput): Promise<VerifiedOAuthIdentity | null> {
  if (!input.idToken) return null;

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(input.idToken)}`);
  if (!res.ok) return null;

  const data = await res.json() as {
    sub?: string;
    email?: string;
    email_verified?: string | boolean;
    aud?: string;
    name?: string;
    given_name?: string;
  };

  const verified = data.email_verified === true || data.email_verified === 'true';
  if (!data.sub || !data.email || !verified) return null;
  // Require app audience match when configured (always enforced in production by env validation).
  if (env.OAUTH_GOOGLE_CLIENT_ID && data.aud !== env.OAUTH_GOOGLE_CLIENT_ID) return null;

  return {
    provider: 'google',
    providerUserId: data.sub,
    email: normalizeEmail(data.email),
    usernameHint: data.given_name ?? data.name,
  };
}

async function verifyDiscord(input: VerifyOAuthInput): Promise<VerifiedOAuthIdentity | null> {
  if (!input.accessToken) return null;

  const res = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;

  const data = await res.json() as {
    id?: string;
    email?: string;
    verified?: boolean;
    global_name?: string | null;
    username?: string;
  };

  if (!data.id || !data.email || !data.verified) return null;

  return {
    provider: 'discord',
    providerUserId: data.id,
    email: normalizeEmail(data.email),
    usernameHint: data.global_name ?? data.username,
  };
}

async function verifyGithub(input: VerifyOAuthInput): Promise<VerifiedOAuthIdentity | null> {
  if (!input.accessToken) return null;

  const commonHeaders = {
    Authorization: `Bearer ${input.accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'velotype-server',
  };

  const profileRes = await fetch('https://api.github.com/user', { headers: commonHeaders });
  if (!profileRes.ok) return null;

  const profile = await profileRes.json() as {
    id?: number;
    login?: string;
    name?: string | null;
    email?: string | null;
  };
  if (!profile.id) return null;

  let email = profile.email ? normalizeEmail(profile.email) : null;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', { headers: commonHeaders });
    if (!emailsRes.ok) return null;
    const emails = await emailsRes.json() as Array<{
      email?: string;
      verified?: boolean;
      primary?: boolean;
    }>;
    const primaryVerified = emails.find((item) => item.primary && item.verified && item.email);
    const anyVerified = emails.find((item) => item.verified && item.email);
    email = normalizeEmail((primaryVerified?.email ?? anyVerified?.email) ?? '');
  }

  if (!email) return null;

  return {
    provider: 'github',
    providerUserId: String(profile.id),
    email,
    usernameHint: profile.login ?? profile.name ?? undefined,
  };
}

export async function verifyOAuthIdentity(
  providerRaw: string,
  input: VerifyOAuthInput,
): Promise<VerifiedOAuthIdentity | null> {
  const provider = asProvider(providerRaw);
  if (!provider) return null;

  try {
    if (provider === 'google') return await verifyGoogle(input);
    if (provider === 'discord') return await verifyDiscord(input);
    return await verifyGithub(input);
  } catch {
    return null;
  }
}
