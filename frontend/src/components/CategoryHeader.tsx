import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CategoryHeaderProps {
  title: string;
}

export const CategoryHeader: React.FC<CategoryHeaderProps> = ({ title }) => {
  const navigate = useNavigate();

  return (
    <div className="category-header">
      <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Volver">
        <ArrowLeft size={20} />
      </button>
      <h2 title={title}>{title}</h2>
    </div>
  );
};
