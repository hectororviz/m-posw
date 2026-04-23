"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapSaleStatus = exports.mapMpPaymentToPaymentStatus = exports.extractMerchantOrderId = exports.normalizeSaleId = exports.extractExternalReference = exports.verifySignature = exports.buildManifest = exports.getResourceId = exports.getManifestId = exports.parseSignatureHeader = exports.toJsonValue = exports.isRecord = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const isRecord = (value) => typeof value === 'object' && value !== null;
exports.isRecord = isRecord;
const toJsonValue = (value) => {
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
        return value.map((item) => (0, exports.toJsonValue)(item));
    }
    if ((0, exports.isRecord)(value)) {
        const result = {};
        for (const [key, entry] of Object.entries(value)) {
            if (entry === undefined || typeof entry === 'function') {
                continue;
            }
            result[key] = (0, exports.toJsonValue)(entry);
        }
        return result;
    }
    return String(value);
};
exports.toJsonValue = toJsonValue;
const parseSignatureHeader = (signature) => {
    const parts = signature.split(',').map((part) => part.trim());
    const result = {};
    for (const part of parts) {
        const [key, ...rest] = part.split('=');
        if (!key || rest.length === 0) {
            continue;
        }
        result[key.trim()] = rest.join('=').trim();
    }
    return result;
};
exports.parseSignatureHeader = parseSignatureHeader;
const parseResourceIdFromUrl = (resource) => {
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
    }
    catch {
    }
    const match = trimmed.match(/(\d+)(?:\D*)$/);
    return match?.[1] ?? null;
};
const normalizeResourceId = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || null;
    }
    if (typeof value === 'number') {
        return String(value);
    }
    return null;
};
const getManifestId = (input) => {
    const body = input.body ?? {};
    const query = input.query ?? {};
    if (input.topic === 'merchant_order') {
        return typeof body?.resource === 'string' ? body.resource : null;
    }
    const dataIdFromBody = normalizeResourceId(body?.data && (0, exports.isRecord)(body.data) ? body.data.id : null);
    return (dataIdFromBody ??
        normalizeResourceId(query['data.id']) ??
        normalizeResourceId(query.id));
};
exports.getManifestId = getManifestId;
const getResourceId = (req) => {
    const query = req.query ?? {};
    const body = req.body ?? {};
    const dataIdFromQuery = query['data.id'];
    if (dataIdFromQuery) {
        return normalizeResourceId(dataIdFromQuery);
    }
    if (query.id) {
        return normalizeResourceId(query.id);
    }
    const dataIdFromBody = normalizeResourceId(body?.data && (0, exports.isRecord)(body.data) ? body.data.id : null);
    if (dataIdFromBody) {
        return dataIdFromBody;
    }
    if (typeof body?.resource === 'string') {
        return parseResourceIdFromUrl(body.resource);
    }
    return null;
};
exports.getResourceId = getResourceId;
const resolveHeaderValue = (headers, name) => {
    const value = headers[name];
    if (Array.isArray(value)) {
        return value[0];
    }
    if (typeof value === 'string') {
        return value;
    }
    return undefined;
};
const buildManifest = (resourceId, requestId, ts) => `id:${resourceId};request-id:${requestId};ts:${ts};`;
exports.buildManifest = buildManifest;
const verifySignature = (req, manifestId, secret) => {
    const signatureHeader = resolveHeaderValue(req.headers, 'x-signature');
    const requestId = resolveHeaderValue(req.headers, 'x-request-id');
    if (!signatureHeader || !requestId) {
        return {
            isValid: false,
            reason: 'missing_headers',
        };
    }
    if (!manifestId) {
        return {
            isValid: false,
            reason: 'missing_manifest_id',
            requestId,
        };
    }
    const parsed = (0, exports.parseSignatureHeader)(signatureHeader);
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
    const manifest = (0, exports.buildManifest)(manifestId, requestId, ts);
    const digest = (0, crypto_1.createHmac)('sha256', secret).update(manifest).digest('hex');
    const manifestHash = (0, crypto_1.createHash)('sha256').update(manifest).digest('hex');
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
    if (!(0, crypto_1.timingSafeEqual)(digestBuffer, signatureBuffer)) {
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
exports.verifySignature = verifySignature;
const extractExternalReference = (payload) => {
    const externalReference = payload?.external_reference;
    return typeof externalReference === 'string' ? externalReference : null;
};
exports.extractExternalReference = extractExternalReference;
const normalizeSaleId = (externalReference) => {
    const trimmed = externalReference.trim();
    if (!trimmed) {
        return null;
    }
    return trimmed.startsWith('sale-') ? trimmed.slice('sale-'.length) : trimmed;
};
exports.normalizeSaleId = normalizeSaleId;
const extractMerchantOrderId = (payload) => {
    const order = payload?.order;
    if ((0, exports.isRecord)(order)) {
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
exports.extractMerchantOrderId = extractMerchantOrderId;
const mapMpPaymentToPaymentStatus = (status, statusDetail, onUnknown) => {
    const normalizedStatus = status?.toLowerCase() ?? null;
    const normalizedDetail = statusDetail?.toLowerCase() ?? null;
    if (!normalizedStatus && !normalizedDetail) {
        onUnknown?.(normalizedStatus, normalizedDetail);
        return client_1.PaymentStatus.PENDING;
    }
    if (normalizedStatus === 'approved' ||
        normalizedStatus === 'accredited' ||
        normalizedDetail === 'accredited') {
        return client_1.PaymentStatus.APPROVED;
    }
    if (normalizedStatus === 'pending' || normalizedStatus === 'in_process') {
        return client_1.PaymentStatus.PENDING;
    }
    if (normalizedStatus === 'rejected' ||
        normalizedStatus === 'cancelled' ||
        normalizedStatus === 'refunded' ||
        normalizedStatus === 'charged_back') {
        return client_1.PaymentStatus.REJECTED;
    }
    if (normalizedStatus === 'expired') {
        return client_1.PaymentStatus.EXPIRED;
    }
    onUnknown?.(normalizedStatus, normalizedDetail);
    return client_1.PaymentStatus.PENDING;
};
exports.mapMpPaymentToPaymentStatus = mapMpPaymentToPaymentStatus;
const mapSaleStatus = (status) => {
    if (status === client_1.PaymentStatus.APPROVED) {
        return client_1.SaleStatus.APPROVED;
    }
    if (status === client_1.PaymentStatus.REJECTED) {
        return client_1.SaleStatus.REJECTED;
    }
    if (status === client_1.PaymentStatus.EXPIRED) {
        return client_1.SaleStatus.EXPIRED;
    }
    return client_1.SaleStatus.PENDING;
};
exports.mapSaleStatus = mapSaleStatus;
