import { PaymentStatus, Prisma, SaleStatus } from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const toJsonValue = (value: unknown): Prisma.InputJsonValue => {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }
  if (isRecord(value)) {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined || typeof entry === 'function') {
        continue;
      }
      result[key] = toJsonValue(entry);
    }
    return result;
  }
  return String(value);
};

export const parseSignatureHeader = (signature: string) => {
  const parts = signature.split(',').map((part) => part.trim());
  const result: Record<string, string> = {};
  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    if (!key || rest.length === 0) {
      continue;
    }
    result[key.trim()] = rest.join('=').trim();
  }
  return result;
};

const parseResourceIdFromUrl = (resource: string) => {
  const trimmed = resource.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments.at(-1);
    if (last && /^\d+$/.test(last)) {
      return last;
    }
  } catch {
    // Not a URL, fall through.
  }
  const match = trimmed.match(/(\d+)(?:\D*)$/);
  return match?.[1] ?? null;
};

const normalizeResourceId = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
};

export const getResourceId = (req: {
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}) => {
  const query = req.query ?? {};
  const body = req.body ?? {};
  const dataIdFromQuery = query['data.id'];
  if (dataIdFromQuery) {
    return normalizeResourceId(dataIdFromQuery);
  }
  if (query.id) {
    return normalizeResourceId(query.id);
  }
  const dataIdFromBody = normalizeResourceId(body?.data && isRecord(body.data) ? body.data.id : null);
  if (dataIdFromBody) {
    return dataIdFromBody;
  }
  if (typeof body?.resource === 'string') {
    return parseResourceIdFromUrl(body.resource);
  }
  return null;
};

const resolveHeaderValue = (
  headers: Record<string, string | string[] | undefined>,
  name: string,
) => {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
};

export const buildManifest = (resourceId: string, requestId: string, ts: string) =>
  `id:${resourceId};request-id:${requestId};ts:${ts};`;

export const verifySignature = (
  req: { headers: Record<string, string | string[] | undefined> },
  resourceId: string,
  secret: string,
) => {
  const signatureHeader = resolveHeaderValue(req.headers, 'x-signature');
  const requestId = resolveHeaderValue(req.headers, 'x-request-id');
  if (!signatureHeader || !requestId) {
    return {
      isValid: false,
      reason: 'missing_headers',
    };
  }
  const parsed = parseSignatureHeader(signatureHeader);
  const ts = parsed['ts'];
  const v1 = parsed['v1'];
  if (!ts || !v1) {
    return {
      isValid: false,
      reason: 'missing_signature_parts',
      requestId,
      ts,
      v1,
    };
  }
  const manifest = buildManifest(resourceId, requestId, ts);
  const digest = createHmac('sha256', secret).update(manifest).digest('hex');
  const manifestHash = createHash('sha256').update(manifest).digest('hex');
  if (!/^[0-9a-f]+$/i.test(v1) || v1.length % 2 !== 0) {
    return {
      isValid: false,
      reason: 'invalid_signature_format',
      requestId,
      ts,
      v1,
      manifest,
      digest,
      manifestHash,
    };
  }
  const digestBuffer = Buffer.from(digest, 'hex');
  const signatureBuffer = Buffer.from(v1, 'hex');
  if (digestBuffer.length !== signatureBuffer.length) {
    return {
      isValid: false,
      reason: 'length_mismatch',
      requestId,
      ts,
      v1,
      manifest,
      digest,
      manifestHash,
    };
  }
  if (!timingSafeEqual(digestBuffer, signatureBuffer)) {
    return {
      isValid: false,
      reason: 'digest_mismatch',
      requestId,
      ts,
      v1,
      manifest,
      digest,
      manifestHash,
    };
  }
  return {
    isValid: true,
    requestId,
    ts,
    v1,
    manifest,
    digest,
    manifestHash,
  };
};

export const extractExternalReference = (payload: Record<string, unknown> | null) => {
  const externalReference = payload?.external_reference;
  return typeof externalReference === 'string' ? externalReference : null;
};

export const normalizeSaleId = (externalReference: string) => {
  const trimmed = externalReference.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.startsWith('sale-') ? trimmed.slice('sale-'.length) : trimmed;
};

export const extractMerchantOrderId = (payload: Record<string, unknown> | null) => {
  const order = payload?.order;
  if (isRecord(order)) {
    const orderId = order.id;
    if (typeof orderId === 'string') {
      return orderId;
    }
    if (typeof orderId === 'number') {
      return String(orderId);
    }
  }
  const merchantOrderId = payload?.merchant_order_id;
  if (typeof merchantOrderId === 'string') {
    return merchantOrderId;
  }
  if (typeof merchantOrderId === 'number') {
    return String(merchantOrderId);
  }
  return null;
};

export const mapPaymentStatus = (status?: string | null) => {
  const normalized = status?.toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'approved') {
    return PaymentStatus.OK;
  }
  if (normalized === 'rejected' || normalized === 'cancelled') {
    return PaymentStatus.FAILED;
  }
  if (normalized === 'pending' || normalized === 'in_process') {
    return PaymentStatus.PENDING;
  }
  return null;
};

export const mapSaleStatus = (status: PaymentStatus | null) => {
  if (!status) {
    return null;
  }
  if (status === PaymentStatus.OK) {
    return SaleStatus.APPROVED;
  }
  if (status === PaymentStatus.FAILED) {
    return SaleStatus.REJECTED;
  }
  return SaleStatus.PENDING;
};
