import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';

interface LightboxModalProps {
  url: string;
  onClose: () => void;
}

const LightboxModal: React.FC<LightboxModalProps> = ({ url, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoom((z) => Math.min(6, Math.max(0.5, z + delta)));
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 1 }}>
        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          title="Descargar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Download size={20} />
        </a>
        <button
          type="button"
          onClick={onClose}
          title="Cerrar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>
      </div>
      <div
        onWheel={handleWheel}
        style={{
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '90vw',
          maxHeight: '90vh',
        }}
      >
        <img
          src={url}
          alt="Vista ampliada"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `scale(${zoom})`,
            transition: 'transform 0.15s ease',
            cursor: zoom > 1 ? 'grab' : 'default',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.75rem',
        }}
      >
        Scroll para zoom &middot; Esc para cerrar
      </div>
    </div>
  );
};

export default LightboxModal;
