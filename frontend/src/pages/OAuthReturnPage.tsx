import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';

interface DetectionResult {
  status: 'already_configured' | 'no_stores' | 'found_stores';
  stores?: Array<{
    id: string;
    name: string;
    address: string;
    pos: Array<{ id: string; name: string; qrUrl: string }>;
  }>;
}

export const OAuthReturnPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      navigate('/admin/settings?mp=error', { replace: true });
      return;
    }

    apiClient
      .post<{ ok: boolean; detection: DetectionResult }>('/mp-oauth/token', { code })
      .then((response) => {
        const detection = response.data.detection;

        if (!detection) {
          navigate('/admin/settings?mp=error', { replace: true });
          return;
        }

        if (detection.status === 'already_configured') {
          navigate('/admin/settings?mp=connected', { replace: true });
        } else if (detection.status === 'found_stores' && detection.stores) {
          sessionStorage.setItem('mp_detected_stores', JSON.stringify(detection.stores));
          navigate('/admin/settings?mp=select_store', { replace: true });
        } else {
          navigate('/admin/settings?mp=setup_required', { replace: true });
        }
      })
      .catch(() => {
        navigate('/admin/settings?mp=error', { replace: true });
      });
  }, [searchParams, navigate]);

  return null;
};
