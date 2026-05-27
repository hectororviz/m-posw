import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';

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
      .post('/mp-oauth/token', { code })
      .then(() => {
        navigate('/admin/settings?mp=connected', { replace: true });
      })
      .catch(() => {
        navigate('/admin/settings?mp=error', { replace: true });
      });
  }, [searchParams, navigate]);

  return null;
};
