import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useUnreadCount } from '../api/queries';
import { useModuleAccess } from '../hooks/useModuleAccess';

const WhatsAppBubble: React.FC = () => {
  const { data } = useUnreadCount();
  const access = useModuleAccess('NOTIFICACIONES');
  const hasAccess = access !== 'HIDDEN';
  const navigate = useNavigate();
  const total = data?.total ?? 0;

  return (
    <button
      type="button"
      onClick={() => { if (hasAccess) navigate('/admin/notificaciones?tab=conversaciones'); }}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 50,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: total > 0 && hasAccess ? '#25D366' : '#94a3b8',
        border: 'none',
        cursor: hasAccess ? 'pointer' : 'default',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.15s, background 0.3s',
        opacity: hasAccess ? 1 : 0.5,
      }}
      onMouseEnter={(e) => { if (hasAccess) e.currentTarget.style.transform = 'scale(1.1)'; }}
      onMouseLeave={(e) => { if (hasAccess) e.currentTarget.style.transform = 'scale(1)'; }}
      title={hasAccess ? 'Conversaciones WhatsApp' : 'Sin acceso a notificaciones'}
    >
      <MessageCircle size={28} color="#fff" fill="#fff" />
      {total > 0 && (
        <span style={{
          position: 'absolute',
          top: -4,
          right: -4,
          background: '#ef4444',
          color: '#fff',
          borderRadius: '50%',
          minWidth: 22,
          height: 22,
          fontSize: '0.75rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid #fff',
          padding: '0 5px',
          boxSizing: 'border-box',
        }}>
          {total > 99 ? '99+' : total}
        </span>
      )}
    </button>
  );
};

export default WhatsAppBubble;
