import { CategoryManager } from './config/CategoryManager';
import { StatusManager } from './config/StatusManager';

export const ConfigPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <CategoryManager />
      <StatusManager />
    </div>
  );
};
