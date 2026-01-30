import { useEffect } from 'react';
import { useSettings } from '../api/queries';
import { AppHeader } from './AppHeader';

interface AppLayoutProps {
  title?: string;
  children: React.ReactNode;
}

const DEFAULT_ACCENT_COLOR = '#f59e0b';

export const AppLayout: React.FC<AppLayoutProps> = ({ title, children }) => {
  const { data: settings, isLoading } = useSettings();

  useEffect(() => {
    const accentColor = settings?.accentColor?.trim();
    if (accentColor) {
      document.documentElement.style.setProperty('--accent-color', accentColor);
      return;
    }
    document.documentElement.style.setProperty('--accent-color', DEFAULT_ACCENT_COLOR);
  }, [settings?.accentColor]);

  return (
    <div className="app-shell">
      <AppHeader settings={settings} isLoading={isLoading} />
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
