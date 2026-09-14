import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { WhatsAppMessage } from '../../api/types';
import MediaBubble from './MediaBubble';

interface Props {
  msg: WhatsAppMessage;
  direction: 'INBOUND' | 'OUTBOUND';
  onOpenLightbox: (url: string) => void;
}

export const AuthenticatedMediaBubble: React.FC<Props> = ({ msg, direction, onOpenLightbox }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!msg.mediaType) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    apiClient
      .get(`/notificaciones/media/${msg.id}`, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [msg.id, msg.mediaType]);

  return <MediaBubble msg={msg} direction={direction} mediaUrl={url} onOpenLightbox={onOpenLightbox} />;
};

export default AuthenticatedMediaBubble;
