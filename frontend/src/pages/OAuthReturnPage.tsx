import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient, normalizeApiError } from '../api/client';

export const OAuthReturnPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      setStatus('error');
      setErrorMsg('No se recibio el codigo de autorizacion');
      return;
    }

    apiClient
      .post('/mp-oauth/token', { code })
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/admin/settings', { replace: true }), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(normalizeApiError(err));
      });
  }, [searchParams, navigate]);

  return (
    <div className="oauth-return-page" style={{ padding: '2rem', textAlign: 'center' }}>
      {status === 'loading' && (
        <div>
          <h2>Vinculando cuenta de Mercado Pago...</h2>
          <p>Por favor espera un momento.</p>
        </div>
      )}
      {status === 'success' && (
        <div>
          <h2 style={{ color: '#16a34a' }}>Cuenta vinculada correctamente</h2>
          <p>Redirigiendo a la configuracion...</p>
        </div>
      )}
      {status === 'error' && (
        <div>
          <h2 style={{ color: '#dc2626' }}>Error al vincular la cuenta</h2>
          <p>{errorMsg}</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate('/admin/settings', { replace: true })}
          >
            Volver a configuracion
          </button>
        </div>
      )}
    </div>
  );
};
