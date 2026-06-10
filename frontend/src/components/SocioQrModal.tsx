import { useEffect, useRef, useState } from 'react';
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
  const [uuid, setUuid] = useState('');
  const [data, setData] = useState<SocioQrData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      scanIntervalRef.current = setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        if (code && code.data) {
          stopCamera();
          setUuid(code.data);
          handleScan(code.data);
        }
      }, 300);
    } catch (err: any) {
      setCameraError('No se pudo acceder a la camara. Ingresa el codigo manualmente.');
    }
  };

  const handleScan = async (value?: string) => {
    const code = (value || uuid).trim();
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<SocioQrData & { socio: { id: number } }>(`/socios/qr/${code}`);
      setData(res.data);
      stopCamera();
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('QR no reconocido.');
      } else {
        setError('Error al consultar el QR.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (data) onApplyDiscounts(data);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal user-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3>{data ? `Socio: ${data.socio.nombre}` : 'Escanear QR'}</h3>
          <button className="icon-button" onClick={() => { stopCamera(); onClose(); }}>✕</button>
        </div>
        <div className="modal-body">
          {!data ? (
            <>
              {error && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{error}</p>}

              {cameraActive ? (
                <div style={{ position: 'relative', marginBottom: '0.75rem', background: '#000', borderRadius: '6px', overflow: 'hidden' }}>
                  <video ref={videoRef} style={{ width: '100%', display: 'block' }} playsInline muted />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.8rem' }}
                    onClick={stopCamera}
                  >
                    Detener camara
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: '100%', marginBottom: '0.75rem' }}
                  onClick={startCamera}
                >
                  Abrir camara
                </button>
              )}

              {cameraError && <p style={{ color: 'var(--color-warning, #f59e0b)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{cameraError}</p>}

              <div className="settings-field">
                <label>O ingresar codigo manualmente</label>
                <input
                  type="text"
                  value={uuid}
                  onChange={(e) => setUuid(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                  placeholder="UUID del QR..."
                />
              </div>
              <div className="modal-footer" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => { stopCamera(); onClose(); }}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={() => handleScan()} disabled={loading || !uuid.trim()}>
                  {loading ? 'Consultando...' : 'Consultar'}
                </button>
              </div>
            </>
          ) : (
            <>
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
                          <span>{b.categoriaNombre}</span>: {b.porcentaje}% — {b.motivoNoDisponible}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
