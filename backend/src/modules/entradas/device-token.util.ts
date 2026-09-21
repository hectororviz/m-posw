import { createHash, randomBytes } from 'crypto';

export const DEVICE_TOKEN_PREFIX = 'ent_';

export function generateDeviceToken(): string {
  return `${DEVICE_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const [scheme, value] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim() || null;
}
