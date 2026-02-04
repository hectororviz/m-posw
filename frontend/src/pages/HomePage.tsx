import { useEffect } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient, buildImageUrl } from '../api/client';
import { useCategories } from '../api/queries';
import type { Category } from '../api/types';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';

const prefetchCategories = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.prefetchQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiClient.get<Category[]>('/categories');
      return response.data;
    },
  });
};

export const HomePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: categories, isLoading } = useCategories();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    void prefetchCategories(queryClient);
  }, [queryClient]);

  useEffect(() => {
    if (!user || user.role === 'ADMIN') {
      return;
    }
    let isActive = true;
    const checkCashSession = async () => {
      try {
        await apiClient.get('/cash-sessions/current');
      } catch (error) {
        if (!isActive) {
          return;
        }
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          navigate('/cash/closed', { replace: true });
        }
      }
    };
    void checkCashSession();
    return () => {
      isActive = false;
    };
  }, [navigate, user]);

  return (
    <AppLayout title="Categorías">
      {isLoading && <p>Cargando categorías...</p>}
      <div className="grid">
        {categories?.map((category) => {
          const imageUrl = buildImageUrl(category.imagePath, category.imageUpdatedAt);
          return (
            <Link key={category.id} to={`/category/${category.id}`} className="card category-card">
              <div className="card-header" style={{ background: category.colorHex || '#111827' }}>
                {imageUrl ? <img src={imageUrl} alt={category.name} /> : null}
              </div>
            </Link>
          );
        })}
      </div>
      <div className="home-actions">
        <Link to="/cash/movements" className="primary-button home-action">
          Caja · Movimientos
        </Link>
      </div>
    </AppLayout>
  );
};
