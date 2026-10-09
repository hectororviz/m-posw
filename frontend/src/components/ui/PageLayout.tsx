import './ui.css';

export function PageLayout({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return <div className={`ui-page${narrow ? ' ui-page--narrow' : ''}`}><div className="ui-stack">{children}</div></div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="ui-page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
    </div>
  );
}
