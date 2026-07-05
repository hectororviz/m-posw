/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_UPLOADS_BASE_URL?: string;
  readonly VITE_WS_BASE_URL?: string;
  readonly VITE_QR_PAYMENT_TIMEOUT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
