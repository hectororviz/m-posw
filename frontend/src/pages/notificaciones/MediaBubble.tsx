import type { WhatsAppMessage } from '../../api/types';

interface MediaBubbleProps {
  msg: WhatsAppMessage;
  direction: 'INBOUND' | 'OUTBOUND';
  mediaUrl: string | null;
  onOpenLightbox: (url: string) => void;
}

const bubbleBase: React.CSSProperties = {
  maxWidth: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: '12px',
  fontSize: '0.9rem',
  wordBreak: 'break-word',
  position: 'relative',
};

const MediaBubble: React.FC<MediaBubbleProps> = ({ msg, direction, mediaUrl, onOpenLightbox }) => {
  if (!msg.mediaType) {
    return (
      <div
        style={{
          ...bubbleBase,
          background: direction === 'OUTBOUND' ? 'var(--color-primary)' : 'var(--color-surface)',
          color: direction === 'OUTBOUND' ? '#fff' : 'var(--color-text)',
          border: direction === 'INBOUND' ? '1px solid var(--color-border)' : 'none',
        }}
      >
        <div>{msg.content}</div>
      </div>
    );
  }

  if (msg.mediaType === 'sticker') {
    return (
      <div style={{ position: 'relative' }}>
        {mediaUrl && (
          <img
            src={mediaUrl}
            alt="Sticker"
            style={{
              maxWidth: '128px',
              maxHeight: '128px',
              cursor: 'pointer',
              display: 'block',
            }}
            onClick={() => onOpenLightbox(mediaUrl)}
          />
        )}
      </div>
    );
  }

  if (msg.mediaType === 'audio') {
    return (
      <div
        style={{
          ...bubbleBase,
          background: direction === 'OUTBOUND' ? 'var(--color-primary)' : 'var(--color-surface)',
          color: direction === 'OUTBOUND' ? '#fff' : 'var(--color-text)',
          border: direction === 'INBOUND' ? '1px solid var(--color-border)' : 'none',
          padding: '0.25rem 0.5rem',
        }}
      >
        {mediaUrl ? (
          <audio
            controls
            preload="none"
            style={{
              width: '250px',
              height: '40px',
              ...(direction === 'OUTBOUND'
                ? { filter: 'invert(1) hue-rotate(180deg)' as any }
                : {}),
            }}
          >
            <source src={mediaUrl} type={msg.mediaMimeType || 'audio/ogg'} />
            Tu navegador no soporta audio.
          </audio>
        ) : (
          <div style={{ padding: '0.5rem', fontSize: '0.85rem' }}>[Audio no disponible]</div>
        )}
      </div>
    );
  }

  if (msg.mediaType === 'image') {
    return (
      <div
        style={{
          ...bubbleBase,
          background: direction === 'OUTBOUND' ? 'var(--color-primary)' : 'var(--color-surface)',
          color: direction === 'OUTBOUND' ? '#fff' : 'var(--color-text)',
          border: direction === 'INBOUND' ? '1px solid var(--color-border)' : 'none',
          padding: '0',
          overflow: 'hidden',
        }}
      >
        {mediaUrl ? (
          <img
            src={mediaUrl}
            alt={msg.caption || 'Imagen'}
            style={{
              display: 'block',
              maxWidth: '280px',
              maxHeight: '320px',
              width: '100%',
              cursor: 'pointer',
            }}
            onClick={() => onOpenLightbox(mediaUrl)}
          />
        ) : (
          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>[Imagen no disponible]</div>
        )}
        {msg.caption && (
          <div style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>{msg.caption}</div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        ...bubbleBase,
        background: direction === 'OUTBOUND' ? 'var(--color-primary)' : 'var(--color-surface)',
        color: direction === 'OUTBOUND' ? '#fff' : 'var(--color-text)',
        border: direction === 'INBOUND' ? '1px solid var(--color-border)' : 'none',
      }}
    >
      <div>{msg.content}</div>
    </div>
  );
};

export default MediaBubble;
