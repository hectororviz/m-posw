import type { AssetEventType } from '../../../api/types';

interface Props {
  name: string;
  isSystem?: boolean;
}

export const AssetStatusBadge: React.FC<Props> = ({ name }) => {
  if (name === 'Activo') return <span className="badge badge-success">{name}</span>;
  if (name === 'De Baja') return <span className="badge badge-neutral">{name}</span>;
  return <span className="badge badge-warning">{name}</span>;
};

const EVENT_LABELS: Record<AssetEventType, string> = {
  ALTA: 'Alta',
  MODIFICACION: 'Modificación',
  CAMBIO_ESTADO: 'Cambio estado',
  BAJA: 'Baja',
};

const EVENT_CLASSES: Record<AssetEventType, string> = {
  ALTA: 'badge badge-success',
  MODIFICACION: 'badge badge-info',
  CAMBIO_ESTADO: 'badge badge-warning',
  BAJA: 'badge badge-danger',
};

interface EventBadgeProps {
  type: AssetEventType;
}

export const EventTypeBadge: React.FC<EventBadgeProps> = ({ type }) => {
  return (
    <span className={EVENT_CLASSES[type] || 'badge badge-neutral'}>
      {EVENT_LABELS[type] || type}
    </span>
  );
};
