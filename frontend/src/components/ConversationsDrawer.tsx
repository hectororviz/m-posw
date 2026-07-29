import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { useConversations, useConversationMessages, useMarkConversationRead, useSendConversationMessage } from '../api/queries';
import { useSocketContext } from '../socket/SocketProvider';
import { useSettings } from '../api/queries';

export const ConversationsDrawer: React.FC = () => {
  const { data: settings } = useSettings();
  const notificationsEnabled = settings?.enableNotificationsModule ?? false;

  if (!notificationsEnabled) return null;

  return <ConversationsDrawerInner />;
};

const ConversationsDrawerInner: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [selectedConvoId, setSelectedConvoId] = useState<number | null>(null);
  const { data: convosData, refetch: refetchConvos } = useConversations();
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket) return;
    socket.emit('conversations.subscribe');

    const handler = () => {
      refetchConvos();
    };

    socket.on('conversation.new_message', handler);

    return () => {
      socket.off('conversation.new_message', handler);
    };
  }, [socket, refetchConvos]);

  const conversations = convosData?.conversations ?? [];
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  return (
    <>
      <button
        type="button"
        className="conversations-fab"
        onClick={() => setOpen(true)}
        title="Conversaciones"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary, #0ea5e9)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000,
        }}
      >
        <MessageSquare size={20} />
        {totalUnread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-0.25rem',
              right: '-0.25rem',
              backgroundColor: 'var(--color-danger, #ef4444)',
              color: '#fff',
              borderRadius: '50%',
              width: '1.4rem',
              height: '1.4rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)} style={{ zIndex: 1001 }}>
          <div
            className="conversations-drawer"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: '400px',
              maxWidth: '90vw',
              height: '100vh',
              backgroundColor: 'var(--color-surface, #fff)',
              boxShadow: '-4px 0 12px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1002,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--color-border, #e5e7eb)',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                Conversaciones
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-faint, #6b7280)',
                  padding: '0.25rem',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {selectedConvoId ? (
              <ConversationView
                conversationId={selectedConvoId}
                onBack={() => setSelectedConvoId(null)}
              />
            ) : (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {conversations.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '3rem 1rem',
                      color: 'var(--color-text-faint, #6b7280)',
                    }}
                  >
                    <MessageSquare size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                    <p>Sin conversaciones</p>
                    <p style={{ fontSize: '0.85rem' }}>
                      Las respuestas de los socios aparecerán aquí.
                    </p>
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => {
                        setSelectedConvoId(conv.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        width: '100%',
                        padding: '0.85rem 1.25rem',
                        border: 'none',
                        borderBottom: '1px solid var(--color-border, #e5e7eb)',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          width: '2.5rem',
                          height: '2.5rem',
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-primary, #0ea5e9)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          flexShrink: 0,
                        }}
                      >
                        {(conv.memberName || '#')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '0.2rem',
                          }}
                        >
                          <strong style={{ fontSize: '0.9rem' }}>
                            {conv.memberName}
                          </strong>
                          {conv.lastMessageAt && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--color-text-faint, #6b7280)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {new Date(conv.lastMessageAt).toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            color: 'var(--color-text-faint, #6b7280)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {conv.lastMessage?.content || 'Sin mensajes'}
                        </div>
                        {conv.unreadCount > 0 && (
                          <span
                            style={{
                              display: 'inline-block',
                              backgroundColor: 'var(--color-primary, #0ea5e9)',
                              color: '#fff',
                              borderRadius: '999px',
                              padding: '0.1rem 0.4rem',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              marginTop: '0.25rem',
                            }}
                          >
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const ConversationView: React.FC<{
  conversationId: number;
  onBack: () => void;
}> = ({ conversationId, onBack }) => {
  const { data: msgsData, refetch: refetchMsgs } = useConversationMessages(conversationId);
  const markRead = useMarkConversationRead();
  const sendMsg = useSendConversationMessage();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocketContext();

  useEffect(() => {
    markRead.mutate(conversationId);
    if (!socket) return;

    socket.emit('conversation.join', { conversationId });

    const handler = () => {
      refetchMsgs();
    };

    socket.on('conversation.new_message', handler);

    return () => {
      socket.off('conversation.new_message', handler);
    };
  }, [socket, conversationId, markRead, refetchMsgs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgsData?.messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      const result = await sendMsg.mutateAsync({ conversationId, text: text.trim() });
      if (result?.smsLink) {
        window.open(result.smsLink, '_blank');
      }
      setText('');
      refetchMsgs();
    } catch {
      // ignore
    }
  };

  const messages = msgsData?.messages ?? [];
  const memberName = msgsData?.memberName || 'Desconocido';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border, #e5e7eb)',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-primary, #0ea5e9)',
            fontWeight: 500,
            fontSize: '0.85rem',
          }}
        >
          &larr;
        </button>
        <div
          style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary, #0ea5e9)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.75rem',
          }}
        >
          {(memberName || '#')[0].toUpperCase()}
        </div>
        <strong style={{ fontSize: '0.9rem' }}>{memberName}</strong>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.direction === 'OUTBOUND' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '75%',
                padding: '0.65rem 0.9rem',
                borderRadius: '1rem',
                backgroundColor:
                  msg.direction === 'OUTBOUND'
                    ? 'var(--color-primary, #0ea5e9)'
                    : 'var(--color-surface-alt, #f3f4f6)',
                color:
                  msg.direction === 'OUTBOUND'
                    ? '#fff'
                    : 'var(--color-text, #111827)',
                fontSize: '0.85rem',
                lineHeight: 1.4,
                wordBreak: 'break-word',
                borderBottomRightRadius: msg.direction === 'OUTBOUND' ? '0.25rem' : undefined,
                borderBottomLeftRadius: msg.direction === 'INBOUND' ? '0.25rem' : undefined,
              }}
            >
              <div>{msg.content}</div>
              <div
                style={{
                  fontSize: '0.65rem',
                  marginTop: '0.3rem',
                  opacity: 0.7,
                  textAlign: 'right',
                }}
              >
                {new Date(msg.createdAt).toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderTop: '1px solid var(--color-border, #e5e7eb)',
        }}
      >
        <input
          type="text"
          className="input"
          placeholder="Escribí un mensaje..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="button primary"
          onClick={handleSend}
          disabled={sendMsg.isPending || !text.trim()}
          style={{
            padding: '0.5rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
