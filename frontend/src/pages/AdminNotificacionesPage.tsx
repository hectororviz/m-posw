import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader, Send, MessageSquare } from 'lucide-react';
import { apiClient, normalizeApiError } from '../api/client';
import { useConversationMessages, useConversations, useNotificacionesHistory, useNotificacionesConfig, useSendConversationMessage, useTestNotificacionesConnection, useSettings } from '../api/queries';
import type { NotificacionesJob, WhatsAppMessage } from '../api/types';
import { useToast } from '../components/ToastProvider';

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--';

const formatTime = (value: string) => {
  const d = new Date(value);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const getNotifBadge = (status: string) => {
  switch (status) {
    case 'SENT': return <span className="badge badge-success">Enviado</span>;
    case 'FAILED': return <span className="badge badge-error">Falló</span>;
    case 'QUEUED': return <span className="badge badge-warning">En cola</span>;
    case 'PROCESSING': return <span className="badge badge-info">Enviando...</span>;
    case 'CANCELLED': return <span className="badge badge-neutral">Cancelado</span>;
    default: return <span className="badge badge-neutral">{status}</span>;
  }
};

type Tab = 'config' | 'history' | 'conversations';

export const AdminNotificacionesPage: React.FC = () => {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { data: config } = useNotificacionesConfig();
  const testMutation = useTestNotificacionesConnection();
  const [tab, setTab] = useState<Tab>('config');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    whatsappPhoneNumberId: '',
    whatsappAccessToken: '',
    whatsappBusinessAccountId: '',
    whatsappWebhookVerifyToken: '',
    whatsappTemplateName: '',
    whatsappAppSecret: '',
    clubAlias: '',
    whatsappVariableOrder: {} as Record<string, number>,
  });

  const [phoneInfo, setPhoneInfo] = useState<{ displayName: string; verifiedName: string; qualityRating: string } | null>(null);
  const [phoneInfoLoading, setPhoneInfoLoading] = useState(false);
  const [templates, setTemplates] = useState<Array<{ name: string; language: string; status: string }>>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        whatsappPhoneNumberId: settings.whatsappPhoneNumberId ?? '',
        whatsappAccessToken: settings.whatsappAccessToken ?? '',
        whatsappBusinessAccountId: settings.whatsappBusinessAccountId ?? '',
        whatsappWebhookVerifyToken: settings.whatsappWebhookVerifyToken ?? '',
        whatsappTemplateName: settings.whatsappTemplateName ?? '',
        whatsappAppSecret: settings.whatsappAppSecret ?? '',
        clubAlias: settings.clubAlias ?? '',
        whatsappVariableOrder: settings.whatsappVariableOrder || {},
      });
    }
  }, [settings]);

  const handleFetchPhoneInfo = async () => {
    if (!form.whatsappPhoneNumberId || !form.whatsappAccessToken) {
      pushToast('Ingresá Phone Number ID y Access Token primero', 'error');
      return;
    }
    try {
      await apiClient.patch('/settings', {
        whatsappPhoneNumberId: form.whatsappPhoneNumberId,
        whatsappAccessToken: form.whatsappAccessToken,
      });
    } catch { /* ignore */ }

    setPhoneInfoLoading(true);
    try {
      const res = await apiClient.get<{ displayName: string; verifiedName: string; phoneNumber: string; qualityRating: string }>('/notificaciones/phone-info');
      setPhoneInfo(res.data);
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setPhoneInfoLoading(false);
    }
  };

  const handleFetchTemplates = async () => {
    if (!form.whatsappAccessToken) {
      pushToast('Ingresá el Access Token primero', 'error');
      return;
    }
    if (!form.whatsappBusinessAccountId) {
      pushToast('Ingresá el Business Account ID para listar templates', 'error');
      return;
    }
    try {
      await apiClient.patch('/settings', {
        whatsappAccessToken: form.whatsappAccessToken,
        whatsappBusinessAccountId: form.whatsappBusinessAccountId,
      });
    } catch { /* ignore */ }

    setTemplatesLoading(true);
    try {
      const res = await apiClient.get<Array<{ name: string; language: string; status: string; category: string }>>('/notificaciones/templates');
      setTemplates(res.data.filter(t => t.status === 'APPROVED'));
      if (res.data.length === 0) pushToast('No se encontraron templates en esta cuenta', 'error');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch('/settings', form);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await queryClient.invalidateQueries({ queryKey: ['notificaciones-config'] });
      pushToast('Configuración guardada', 'success');
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      const result = await testMutation.mutateAsync();
      pushToast(result.message || 'Conexión exitosa', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  // History
  const [historyPage, setHistoryPage] = useState(1);
  const { data: history } = useNotificacionesHistory(historyPage, 20);

  // Conversations
  const { data: conversationsData } = useConversations(1, 20);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const { data: convMessages, refetch: refetchMessages } = useConversationMessages(selectedConvId ?? undefined);
  const sendMutation = useSendConversationMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (convMessages?.messages && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [convMessages?.messages]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConvId) return;
    setSendingReply(true);
    try {
      await sendMutation.mutateAsync({ conversationId: selectedConvId, text: replyText.trim() });
      setReplyText('');
      refetchMessages();
      pushToast('Mensaje enviado', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  return (
    <div className="page-container">
      <div className="treasury-subnav">
        <button type="button" className={`treasury-subnav-link${tab === 'config' ? ' active' : ''}`} onClick={() => setTab('config')}>Configuración</button>
        <button type="button" className={`treasury-subnav-link${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>Historial</button>
        <button type="button" className={`treasury-subnav-link${tab === 'conversations' ? ' active' : ''}`} onClick={() => setTab('conversations')}>Conversaciones</button>
      </div>

      {tab === 'config' ? (
        <div style={{ maxWidth: '640px', margin: '1.5rem 0' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>WhatsApp Cloud API (Meta)</h3>
          <p style={{ color: 'var(--color-text-faint)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Configurá las credenciales de la API oficial de WhatsApp Business para enviar notificaciones a tus acreedores.
          </p>

          {error && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}

          {config && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.9rem' }}>
                Estado:{' '}
                {config.isConfigured ? (
                  <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Configurado ✓</span>
                ) : (
                  <span style={{ color: 'var(--color-warning, #f59e0b)', fontWeight: 600 }}>Sin configurar</span>
                )}
                {phoneInfo && (
                  <span style={{ marginLeft: '0.75rem', color: 'var(--color-text-faint)', fontSize: '0.85rem' }}>
                    {phoneInfo.displayName} | {phoneInfo.verifiedName} | {phoneInfo.qualityRating}
                  </span>
                )}
              </span>
            </div>
          )}

          <div className="settings-field">
            <label>Phone Number ID *</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={form.whatsappPhoneNumberId}
                onChange={(e) => setForm({ ...form, whatsappPhoneNumberId: e.target.value })}
                placeholder="Ej: 123456789012345"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={handleFetchPhoneInfo}
                disabled={phoneInfoLoading || !form.whatsappPhoneNumberId || !form.whatsappAccessToken}
              >
                {phoneInfoLoading ? 'Consultando...' : 'Consultar'}
              </button>
            </div>
            {phoneInfo && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-faint)' }}>
                {phoneInfo.displayName} | {phoneInfo.verifiedName} | {phoneInfo.qualityRating}
              </div>
            )}
            <small style={{ color: 'var(--color-text-faint)' }}>ID del número de teléfono en Meta Business Suite.</small>
          </div>

          <div className="settings-field">
            <label>Access Token (permanente) *</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="password"
                value={form.whatsappAccessToken}
                onChange={(e) => setForm({ ...form, whatsappAccessToken: e.target.value })}
                placeholder="EAA..."
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={handleFetchTemplates}
                disabled={templatesLoading || !form.whatsappAccessToken}
              >
                {templatesLoading ? 'Cargando...' : 'Cargar templates'}
              </button>
            </div>
            <small style={{ color: 'var(--color-text-faint)' }}>Token de acceso permanente. Crear en Meta Developers → Herramientas → Generar token → whatsapp_business_messaging.</small>
          </div>

          <div className="settings-field">
            <label>Nombre del Template *</label>
            {templates.length > 0 ? (
              <select
                value={form.whatsappTemplateName}
                onChange={(e) => setForm({ ...form, whatsappTemplateName: e.target.value })}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  fontSize: '0.9rem',
                  width: '100%',
                }}
              >
                <option value="">Seleccionar template...</option>
                {templates.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.language}) - APPROVED
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  type="text"
                  value={form.whatsappTemplateName}
                  onChange={(e) => setForm({ ...form, whatsappTemplateName: e.target.value })}
                  placeholder="Ej: debt_reminder"
                />
                <small style={{ color: 'var(--color-text-faint)' }}>
                  Cargá los templates con el botón de arriba para seleccionar de una lista, o ingresá el nombre manualmente.
                </small>
              </>
            )}
          </div>

          <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '0.25rem' }}>Orden de variables del template</h4>
            <p style={{ color: 'var(--color-text-faint)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Cada variable se mapea a {'{{1}}'}, {'{{2}}'}, etc. en tu template de Meta. Elegi el orden y cuales incluir.
            </p>

            <VariableOrderEditor
              value={form.whatsappVariableOrder || {}}
              onChange={(order) => setForm({ ...form, whatsappVariableOrder: order })}
            />
          </div>

          <div className="settings-field">
            <label>Business Account ID</label>
            <input type="text" value={form.whatsappBusinessAccountId} onChange={(e) => setForm({ ...form, whatsappBusinessAccountId: e.target.value })} placeholder="Ej: 987654321098765" />
            <small style={{ color: 'var(--color-text-faint)' }}>WABA ID de la cuenta de WhatsApp Business para listar templates. Opcional.</small>
          </div>

          <div className="settings-field">
            <label>Webhook Verify Token</label>
            <input type="text" value={form.whatsappWebhookVerifyToken} onChange={(e) => setForm({ ...form, whatsappWebhookVerifyToken: e.target.value })} placeholder="Token personalizado" />
            <small style={{ color: 'var(--color-text-faint)' }}>Token usado por Meta para verificar el webhook. Usá el mismo valor en Meta Business Suite al configurar el webhook.</small>
          </div>

          <div className="settings-field">
            <label>App Secret</label>
            <input type="password" value={form.whatsappAppSecret} onChange={(e) => setForm({ ...form, whatsappAppSecret: e.target.value })} placeholder="Secreto de la app de Meta" />
            <small style={{ color: 'var(--color-text-faint)' }}>Secreto de la app de Meta. Se usa para validar la firma de webhooks entrantes (opcional, pero recomendado en producción).</small>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
            <button type="button" className="btn-ghost" onClick={handleTest} disabled={testMutation.isPending || !form.whatsappPhoneNumberId || !form.whatsappAccessToken}>
              {testMutation.isPending ? 'Probando...' : 'Probar conexión'}
            </button>
          </div>
        </div>
      ) : tab === 'history' ? (
        <div style={{ margin: '1.5rem 0' }}>
          <h3 style={{ marginBottom: '1rem' }}>Historial de notificaciones</h3>
          {history ? (
            <>
              <div className="sales-table">
                <div className="sales-table-head">
                  <span className="col-date">Fecha</span>
                  <span className="col-method">Destinatario</span>
                  <span className="col-total" style={{ flex: '0 0 110px' }}>Estado</span>
                  <span className="col-user">Detalle</span>
                </div>
                {history.jobs.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-faint)' }}>No hay notificaciones registradas</div>
                ) : (
                  history.jobs.map((job: NotificacionesJob) => (
                    <div key={job.id} className="sales-table-row" style={{ cursor: 'default' }}>
                      <span className="col-date">{formatDateTime(job.createdAt)}</span>
                      <span className="col-method">{job.recipientName || job.phoneNumber}{job.attempts > 1 && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginLeft: '0.35rem' }}> (×{job.attempts})</span>}</span>
                      <span className="col-total" style={{ flex: '0 0 110px' }}>{getNotifBadge(job.status)}</span>
                      <span className="col-user" style={{ fontSize: '0.85rem' }}>{job.error ? <span style={{ color: 'var(--color-danger)' }} title={job.error}>{job.error.length > 60 ? job.error.slice(0, 60) + '...' : job.error}</span> : <span style={{ color: 'var(--color-text-faint)' }}>--</span>}</span>
                    </div>
                  ))
                )}
              </div>
              {history.total > 20 && (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage <= 1}>Anterior</button>
                  <span style={{ alignSelf: 'center', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Pág {historyPage} de {Math.ceil(history.total / 20)}</span>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setHistoryPage(p => p + 1)} disabled={historyPage * 20 >= history.total}>Siguiente</button>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem' }}><Loader size={20} className="spin-icon" /></div>
          )}
        </div>
      ) : (
        <div style={{ margin: '1.5rem 0' }}>
          <h3 style={{ marginBottom: '1rem' }}>Conversaciones</h3>
          <div style={{ display: 'flex', gap: '1.5rem', minHeight: '60vh' }}>
            {/* Conversation list */}
            <div style={{ flex: '0 0 340px', borderRight: '1px solid var(--color-border)', overflowY: 'auto', maxHeight: '70vh' }}>
              {conversationsData ? (
                conversationsData.conversations.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-faint)' }}>No hay conversaciones aún. Cuando un acreedor responda a un mensaje, aparecerá acá.</div>
                ) : (
                  conversationsData.conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConvId(conv.id)}
                      style={{
                        padding: '0.75rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--color-border)',
                        background: selectedConvId === conv.id ? 'var(--color-primary-bg)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '0.9rem' }}>{conv.acreedor?.nombre || conv.phoneNumber}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {conv.windowOpen && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} title="Ventana 24hs abierta" />}
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>{conv.lastMessageAt ? formatTime(conv.lastMessageAt) : ''}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {conv.lastMessage ? (
                          <>{conv.lastMessage.direction === 'INBOUND' ? '↓ ' : '↑ '}{conv.lastMessage.content.slice(0, 60)}</>
                        ) : (
                          'Sin mensajes'
                        )}
                      </div>
                    </div>
                  ))
                )
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem' }}><Loader size={20} className="spin-icon" /></div>
              )}
            </div>

            {/* Chat view */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {selectedConvId && convMessages ? (
                <>
                  <div style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{convMessages.acreedor?.nombre || convMessages.phoneNumber}</strong>
                    <span style={{ fontSize: '0.8rem', color: convMessages.windowOpen ? 'var(--color-success)' : 'var(--color-text-faint)' }}>
                      {convMessages.windowOpen ? 'Ventana 24hs abierta' : 'Ventana 24hs cerrada'}
                    </span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: '55vh', paddingBottom: '0.5rem' }}>
                    {convMessages.messages.map((msg: WhatsAppMessage) => (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          justifyContent: msg.direction === 'OUTBOUND' ? 'flex-end' : 'flex-start',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '70%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '12px',
                            background: msg.direction === 'OUTBOUND' ? 'var(--color-primary)' : 'var(--color-surface)',
                            color: msg.direction === 'OUTBOUND' ? '#fff' : 'var(--color-text)',
                            border: msg.direction === 'INBOUND' ? '1px solid var(--color-border)' : 'none',
                            fontSize: '0.9rem',
                            wordBreak: 'break-word',
                          }}
                        >
                          <div>{msg.content}</div>
                          <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', opacity: 0.7, textAlign: 'right' }}>
                            {formatTime(msg.createdAt)}
                            {msg.direction === 'OUTBOUND' && msg.status && (
                              <span style={{ marginLeft: '0.3rem' }}>
                                {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : msg.status === 'sent' ? '✓' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  {convMessages.windowOpen && (
                    <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Escribí una respuesta..."
                        disabled={sendingReply}
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn-primary btn-sm" onClick={handleSendReply} disabled={sendingReply || !replyText.trim()}>
                        {sendingReply ? <Loader size={16} className="spin-icon" /> : <Send size={16} />}
                      </button>
                    </div>
                  )}
                  {!convMessages.windowOpen && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '0.85rem', borderTop: '1px solid var(--color-border)' }}>
                      La ventana de 24 horas está cerrada. Solo se pueden enviar templates para iniciar nuevas conversaciones.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-faint)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <MessageSquare size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                    <p>Seleccioná una conversación para ver los mensajes</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AVAILABLE_VARIABLES = [
  { key: 'nombre', label: 'Nombre del acreedor' },
  { key: 'alias', label: 'Alias del club' },
  { key: 'saldo', label: 'Saldo pendiente ($)' },
  { key: 'dias', label: 'Dias de antiguedad' },
  { key: 'club', label: 'Nombre del club' },
];

type VariableOrderEditorProps = {
  value: Record<string, number>;
  onChange: (order: Record<string, number>) => void;
};

const VariableOrderEditor: React.FC<VariableOrderEditorProps> = ({ value, onChange }) => {
  const maxPositions = AVAILABLE_VARIABLES.length;
  const usedPositions = new Set(
    Object.values(value).filter((v) => typeof v === 'number' && v > 0) as number[]
  );

  const handleChange = (key: string, newPos: number) => {
    const current = { ...value };

    const oldPos = current[key];
    if (oldPos && oldPos > 0) {
      usedPositions.delete(oldPos);
    }

    current[key] = newPos;
    if (newPos > 0) {
      usedPositions.add(newPos);
    }

    onChange(current);
  };

  const getAvailableOptions = (currentKey: string) => {
    const currentValue = value[currentKey] || 0;
    const options: { label: string; value: number }[] = [
      { label: 'Desactivado', value: 0 },
    ];

    for (let i = 1; i <= maxPositions; i++) {
      if (!usedPositions.has(i) || (currentValue === i)) {
        options.push({ label: `Posicion ${i}`, value: i });
      }
    }

    return options;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {AVAILABLE_VARIABLES.map((v) => {
        const currentPos = value[v.key] || 0;
        const options = getAvailableOptions(v.key);
        return (
          <div
            key={v.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{v.key}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-faint)' }}>{v.label}</div>
            </div>
            <select
              value={currentPos}
              onChange={(e) => handleChange(v.key, parseInt(e.target.value))}
              style={{
                padding: '0.35rem 0.5rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: '0.85rem',
                minWidth: '130px',
              }}
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
};
