import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import jsQR from 'jsqr';
import { apiClient } from '../api/client';

interface BeneficioInfo {
  id: string;
  categoriaId: string;
  categoriaNombre: string;
  porcentaje: number;
  descuentoMaximo: number | null;
  disponible: boolean;
  motivoNoDisponible: string | null;
}

interface SocioQrData {
  socio: { nombre: string; nroSocio: number; tipo: string; id?: number };
  estado: string;
  beneficios: BeneficioInfo[];
}

interface Props {
  onApplyDiscounts: (data: SocioQrData) => void;
  onClose: () => void;
}

const estadoBadge = (estado: string) => {
  if (estado === 'AL_DIA') return <span className="badge badge-success">AL DIA</span>;
  if (estado === 'ATRASADO') return <span className="badge badge-danger">ATRASADO</span>;
  return <span className="badge badge-neutral">{estado}</span>;
};

export const SocioQrModal: React.FC<Props> = ({ onApplyDiscounts, onClose }) => {
  const [data, setData] = useState<SocioQrData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scannedRef = useRef(false);

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    scannedRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      scanIntervalRef.current = setInterval(() => {
        if (scannedRef.current || data) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        if (code && code.data) {
          scannedRef.current = true;
          stopCamera();
          lookupQr(code.data);
        }
      }, 300);
    } catch (err: any) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Permiso de camara denegado. Concedelo en la configuracion del navegador.'
          : 'No se pudo acceder a la camara.',
      );
    }
  };

  const lookupQr = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<SocioQrData & { socio: { id: number } }>(`/socios/qr/${code.trim()}`);
      setData(res.data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('QR no reconocido.');
      } else {
        setError('Error al consultar el QR.');
      }
      stopCamera();
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (data) onApplyDiscounts(data);
  };

  const handleRetry = () => {
    setError(null);
    setCameraError(null);
    setData(null);
    startCamera();
  };

  // Scan result view
  if (data) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal user-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
          <div className="modal-header">
            <h3>Socio: {data.socio.nombre}</h3>
            <button className="icon-button" onClick={onClose}>{<X size={16} />}</button>
          </div>
          <div className="modal-body">
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.25rem' }}><strong>Nombre:</strong> {data.socio.nombre}</p>
              <p style={{ margin: '0 0 0.25rem' }}><strong>Nº Socio:</strong> #{data.socio.nroSocio}</p>
              <p style={{ margin: '0 0 0.5rem' }}><strong>Tipo:</strong> {data.socio.tipo}</p>
              {estadoBadge(data.estado)}
            </div>

            {data.estado !== 'AL_DIA' || data.beneficios.length === 0 ? (
              <p style={{ color: 'var(--color-text-faint)' }}>Sin beneficios disponibles.</p>
            ) : (
              <div className="settings-section">
                <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Beneficios disponibles</h4>
                {data.beneficios.filter(b => b.disponible).map((b) => (
                  <div key={b.id} style={{ marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600 }}>{b.categoriaNombre}</span>: {b.porcentaje}%
                    {b.descuentoMaximo && <span> (tope: ${b.descuentoMaximo})</span>}
                  </div>
                ))}
                {data.beneficios.filter(b => !b.disponible).length > 0 && (
                  <>
                    <h4 style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>No disponibles</h4>
                    {data.beneficios.filter(b => !b.disponible).map((b) => (
                      <div key={b.id} style={{ marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                        {b.categoriaNombre}: {b.porcentaje}% — {b.motivoNoDisponible}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleApply}
                disabled={data.estado !== 'AL_DIA' || !data.beneficios.some(b => b.disponible)}
              >
                Aplicar descuentos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Camera view or error
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal user-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3>{loading ? 'Consultando...' : 'Escanear QR'}</h3>
          <button className="icon-button" onClick={() => { stopCamera(); onClose(); }}>{<X size={16} />}</button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center' }}>
          {cameraError ? (
            <>
              <p className="error-text" style={{ marginBottom: '0.75rem' }}>{cameraError}</p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handleRetry}>Reintentar</button>
              </div>
            </>
          ) : error ? (
            <>
              <p className="error-text" style={{ marginBottom: '0.75rem' }}>{error}</p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handleRetry}>Reintentar</button>
              </div>
            </>
          ) : (
            <div style={{ position: 'relative', background: '#000', borderRadius: '6px', overflow: 'hidden', minHeight: 200 }}>
              <video ref={videoRef} style={{ width: '100%', display: 'block' }} playsInline muted autoPlay />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {loading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
                  <div className="spinner" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
