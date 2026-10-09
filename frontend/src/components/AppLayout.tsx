import { useEffect } from 'react';
import { useSettings } from '../api/queries';
import { AppHeader } from './AppHeader';
import { applyAccent } from '../utils/accent';

interface AppLayoutProps {
  title?: string;
  children: React.ReactNode;
  showMenuButton?: boolean;
  onMenuClick?: () => void;
  hideBrand?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ title, children, showMenuButton, onMenuClick, hideBrand }) => {
  const { data: settings, isLoading } = useSettings();

  useEffect(() => {
    applyAccent(settings?.accentColor?.trim() ?? '');
  }, [settings?.accentColor]);

  return (
    <div className="app-shell">
      <AppHeader settings={settings} isLoading={isLoading} showMenuButton={showMenuButton} onMenuClick={onMenuClick} hideBrand={hideBrand} />
      <main className="app-main">
        {title && (
          <div className="page-title">
            <h2>{title}</h2>
          </div>
        )}
        {children}
      </main>
    </div>
  );
};
