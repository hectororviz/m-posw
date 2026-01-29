import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient, buildImageUrl } from '../api/client';
import { useCategories } from '../api/queries';
import type { Category } from '../api/types';
import { Layout } from '../components/Layout';

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

  useEffect(() => {
    void prefetchCategories(queryClient);
  }, [queryClient]);

  return (
    <Layout title="Categorías">
      {isLoading && <p>Cargando categorías...</p>}
      <div className="grid">
        {categories?.map((category) => {
          const imageUrl = buildImageUrl(category.imagePath, category.imageUpdatedAt);
          return (
            <Link key={category.id} to={`/category/${category.id}`} className="card category-card">
              <div className="card-header" style={{ background: category.colorHex || '#111827' }}>
                {imageUrl ? (
                  <img src={imageUrl} alt={category.name} />
                ) : (
                  <span className="emoji">{category.iconName || '🧾'}</span>
                )}
              </div>
              <div className="card-body">
                <h3>{category.name}</h3>
              </div>
            </Link>
          );
        })}
      </div>
    </Layout>
  );
};
