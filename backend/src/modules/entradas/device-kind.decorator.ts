import { SetMetadata } from '@nestjs/common';

export const DEVICE_KIND_KEY = 'deviceKind';

/** Alcance por tipo de terminal, en minúsculas por convención de ruta. */
export type DeviceKind = 'entradas' | 'pos';

export const DeviceKind = (kind: DeviceKind) => SetMetadata(DEVICE_KIND_KEY, kind);
