export const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/data/uploads';

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export const CATEGORY_IMAGE_SUBDIR = 'categories';
export const PRODUCT_IMAGE_SUBDIR = 'products';
export const SETTINGS_IMAGE_SUBDIR = 'settings';

export const IMAGE_MAX_DIMENSION = 768;
export const IMAGE_QUALITY = 80;
