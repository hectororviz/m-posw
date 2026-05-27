import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { marked } from 'marked';
import * as emoji from 'node-emoji';
import { apiClient, normalizeApiError } from '../api/client';
import { useMpOauthStatus, useSettings } from '../api/queries';
import type { Setting } from '../api/types';
import { useToast } from '../components/ToastProvider';
import { useEmbeddedKeyboard } from '../hooks/useEmbeddedKeyboard';

type TabId = 'general' | 'ventas' | 'mercadopago' | 'caja' | 'sistema';

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'mercadopago', label: 'Mercado Pago' },
  { id: 'caja', label: 'Caja' },
  { id: 'sistema', label: 'Sistema' },
];

export const AdminSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: settings } = useSettings();
  const { data: mpStatus, refetch: refetchMpStatus } = useMpOauthStatus();
  const { pushToast } = useToast();
  const { showEmbeddedKeyboard, setShowEmbeddedKeyboard } = useEmbeddedKeyboard();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    storeName: '',
    clubName: '',
    enableTicketPrinting: false,
    accentColor: '',
    enableCashPayment: true,
    enableQrPayment: true,
    enableTransferPayment: true,
    movementInReasons: [] as string[],
    movementOutReasons: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [aboutContent, setAboutContent] = useState('');
  const [showMovementReasonsModal, setShowMovementReasonsModal] = useState(false);
  const [newInReason, setNewInReason] = useState('');
  const [newOutReason, setNewOutReason] = useState('');
  const [mpConnecting, setMpConnecting] = useState(false);
  const [mpDisconnecting, setMpDisconnecting] = useState(false);
  const [mpSetupLoading, setMpSetupLoading] = useState(false);
  const [mpStoreNameInput, setMpStoreNameInput] = useState('');
  const [mpPosNameInput, setMpPosNameInput] = useState('');

  useEffect(() => {
    const mpParam = searchParams.get('mp');
    if (mpParam === 'connected') {
      pushToast('Mercado Pago conectado correctamente', 'success');
      refetchMpStatus();
      setSearchParams({}, { replace: true });
    } else if (mpParam === 'error') {
      pushToast('Error al conectar Mercado Pago, intenta de nuevo', 'error');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, pushToast, refetchMpStatus, setSearchParams]);

  useEffect(() => {
    if (settings) {
      setForm({
        storeName: settings.storeName ?? '',
        clubName: settings.clubName ?? '',
        enableTicketPrinting: settings.enableTicketPrinting ?? false,
        accentColor: settings.accentColor ?? '',
        enableCashPayment: settings.enableCashPayment ?? true,
        enableQrPayment: settings.enableQrPayment ?? true,
        enableTransferPayment: settings.enableTransferPayment ?? true,
        movementInReasons: settings.movementInReasons ?? [],
        movementOutReasons: settings.movementOutReasons ?? [],
      });
    }
  }, [settings]);

  const validatePaymentMethods = (newForm: typeof form): typeof form => {
    const { enableCashPayment, enableQrPayment, enableTransferPayment } = newForm;
    if (!enableCashPayment && !enableQrPayment && !enableTransferPayment) {
      return { ...newForm, enableCashPayment: true };
    }
    return newForm;
  };

  const handlePaymentMethodChange = (field: keyof typeof form, value: boolean) => {
    setForm((prev) => validatePaymentMethods({ ...prev, [field]: value }));
  };

  const handleAddInReason = () => {
    const trimmed = newInReason.trim();
    if (trimmed && !form.movementInReasons.includes(trimmed)) {
      setForm((prev) => ({ ...prev, movementInReasons: [...prev.movementInReasons, trimmed] }));
      setNewInReason('');
    }
  };

  const handleRemoveInReason = (reason: string) => {
    setForm((prev) => ({ ...prev, movementInReasons: prev.movementInReasons.filter((r) => r !== reason) }));
  };

  const handleAddOutReason = () => {
    const trimmed = newOutReason.trim();
    if (trimmed && !form.movementOutReasons.includes(trimmed)) {
      setForm((prev) => ({ ...prev, movementOutReasons: [...prev.movementOutReasons, trimmed] }));
      setNewOutReason('');
    }
  };

  const handleRemoveOutReason = (reason: string) => {
    setForm((prev) => ({ ...prev, movementOutReasons: prev.movementOutReasons.filter((r) => r !== reason) }));
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const validatedForm = validatePaymentMethods(form);
    setForm(validatedForm);
    try {
      const response = await apiClient.patch<Setting>('/settings', validatedForm);
      queryClient.setQueryData(['settings'], response.data);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      pushToast('Configuracion actualizada', 'success');
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMovementReasons = async () => {
    try {
      const response = await apiClient.patch<Setting>('/settings', {
        movementInReasons: form.movementInReasons,
        movementOutReasons: form.movementOutReasons,
      });
      queryClient.setQueryData(['settings'], response.data);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      pushToast('Motivos guardados correctamente', 'success');
      setShowMovementReasonsModal(false);
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  const handleUpload = async (type: 'logo' | 'favicon', file?: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.post(`/settings/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      pushToast('Archivo subido correctamente', 'success');
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleConnectMp = async () => {
    setMpConnecting(true);
    try {
      const response = await apiClient.get<{ url: string }>('/mp-oauth/connect');
      window.location.href = response.data.url;
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
      setMpConnecting(false);
    }
  };

  const handleDisconnectMp = async () => {
    setMpDisconnecting(true);
    try {
      await apiClient.delete('/mp-oauth/disconnect');
      await refetchMpStatus();
      pushToast('Cuenta de MercadoPago desconectada', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setMpDisconnecting(false);
    }
  };

  const handleSetupPos = async () => {
    if (!mpStoreNameInput.trim() || !mpPosNameInput.trim()) {
      pushToast('Completa ambos campos para configurar el QR', 'error');
      return;
    }
    setMpSetupLoading(true);
    try {
      await apiClient.post('/mp-oauth/setup-pos', {
        storeName: mpStoreNameInput.trim(),
        posName: mpPosNameInput.trim(),
      });
      await refetchMpStatus();
      pushToast('Punto de venta configurado correctamente', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setMpSetupLoading(false);
    }
  };

  const handleReconfigurePos = async () => {
    try {
      await apiClient.delete('/mp-oauth/setup-pos');
      await refetchMpStatus();
      pushToast('Configuracion de POS eliminada. Podes volver a configurarlo.', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  const handleOpenAbout = async () => {
    try {
      const response = await fetch('/about.md');
      if (response.ok) {
        setAboutContent(await response.text());
      } else {
        setAboutContent('No se encontro el archivo de informacion.');
      }
    } catch {
      setAboutContent('Error al cargar la informacion.');
    }
    setShowAboutModal(true);
  };

  const aboutHtml = useMemo(() => {
    const contentWithEmojis = emoji.emojify(aboutContent);
    return marked.parse(contentWithEmojis, { async: false }) as string;
  }, [aboutContent]);

  const allPaymentMethodsDisabled = !form.enableCashPayment && !form.enableQrPayment && !form.enableTransferPayment;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title">Configuracion</h2>
        <p className="page-header-subtitle">Gestiona los parametros del sistema</p>
      </div>

      <div className="tab-bar" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {error && <p className="error-text">{error}</p>}

        {/* TAB: General */}
        {activeTab === 'general' && (
          <div className="settings-section">
            <h3 className="settings-section-header">Informacion del negocio</h3>
            <div className="settings-field">
              <label htmlFor="store-name">Nombre del local</label>
              <input
                id="store-name"
                type="text"
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                placeholder="Ej: Mi Tienda"
              />
            </div>
            <div className="settings-field">
              <label htmlFor="club-name">Empresa / Club</label>
              <input
                id="club-name"
                type="text"
                value={form.clubName}
                onChange={(e) => setForm({ ...form, clubName: e.target.value })}
                placeholder="Ej: Club Atletico"
              />
            </div>
            <div className="settings-field">
              <label htmlFor="accent-color">Color de personalizacion</label>
              <input
                id="accent-color"
                type="text"
                value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                placeholder="#0ea5e9"
              />
              <span className="field-hint">Codigo hexadecimal (ej: #0ea5e9). Define el color principal del sistema.</span>
            </div>
            <div className="settings-field">
              <label htmlFor="logo-upload">Logo</label>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={(e) => handleUpload('logo', e.target.files?.[0])}
              />
              <span className="field-hint">Imagen que aparece en la cabecera del sistema.</span>
            </div>
            <div className="settings-field">
              <label htmlFor="favicon-upload">Favicon</label>
              <input
                id="favicon-upload"
                type="file"
                accept="image/png,image/svg+xml,image/x-icon"
                onChange={(e) => handleUpload('favicon', e.target.files?.[0])}
              />
              <span className="field-hint">Icono que aparece en la pestana del navegador.</span>
            </div>
          </div>
        )}

        {/* TAB: Ventas */}
        {activeTab === 'ventas' && (
          <>
            <div className="settings-section">
              <h3 className="settings-section-header">Opciones de venta</h3>
              <div className="settings-toggle-group">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.enableTicketPrinting}
                    onChange={(e) => setForm({ ...form, enableTicketPrinting: e.target.checked })}
                  />
                  <span className="toggle-switch-track" />
                  Imprimir ticket de venta
                </label>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showEmbeddedKeyboard}
                    onChange={(e) => setShowEmbeddedKeyboard(e.target.checked)}
                  />
                  <span className="toggle-switch-track" />
                  Teclado embebido
                </label>
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-header">Medios de pago</h3>
              <p className="settings-section-desc">Selecciona los metodos de pago disponibles en el checkout. Al menos uno debe estar activo.</p>
              {allPaymentMethodsDisabled && (
                <p className="warning-text">Debe haber al menos un medio de pago activo. Efectivo se activara por defecto.</p>
              )}
              <div className="settings-toggle-group">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.enableCashPayment}
                    onChange={(e) => handlePaymentMethodChange('enableCashPayment', e.target.checked)}
                  />
                  <span className="toggle-switch-track" />
                  Efectivo
                </label>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.enableQrPayment}
                    onChange={(e) => handlePaymentMethodChange('enableQrPayment', e.target.checked)}
                  />
                  <span className="toggle-switch-track" />
                  QR MercadoPago
                </label>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.enableTransferPayment}
                    onChange={(e) => handlePaymentMethodChange('enableTransferPayment', e.target.checked)}
                  />
                  <span className="toggle-switch-track" />
                  Transferencia
                </label>
              </div>
            </div>
          </>
        )}

        {/* TAB: Mercado Pago */}
        {activeTab === 'mercadopago' && (
          <div className="mp-status-card">
            <div className="mp-status-header">
              <span className="mp-status-header-title">
                Mercado Pago
                {mpStatus?.linked ? (
                  <span className="badge badge-success">Conectado</span>
                ) : (
                  <span className="badge badge-neutral">No conectado</span>
                )}
              </span>
            </div>

            <div className="mp-status-body">
              {!mpStatus?.linked ? (
                <>
                  <p className="mp-unlinked-message">
                    Vincula tu cuenta de MercadoPago via OAuth para gestionar los pagos con QR.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleConnectMp}
                    disabled={mpConnecting}
                  >
                    {mpConnecting ? 'Redirigiendo...' : 'Conectar Mercado Pago'}
                  </button>
                </>
              ) : !mpStatus?.mpPosId ? (
                <>
                  <div className="mp-status-row">
                    <span className="mp-status-label">Estado</span>
                    <span className="badge badge-warning">Pendiente configurar POS</span>
                  </div>
                  <div className="mp-pos-form">
                    <div className="settings-field">
                      <label htmlFor="mp-store-name-input">Nombre de la tienda</label>
                      <input
                        id="mp-store-name-input"
                        type="text"
                        value={mpStoreNameInput}
                        onChange={(e) => setMpStoreNameInput(e.target.value)}
                        placeholder="Ej: Tienda Principal"
                      />
                    </div>
                    <div className="settings-field">
                      <label htmlFor="mp-pos-name-input">Nombre del punto de venta</label>
                      <input
                        id="mp-pos-name-input"
                        type="text"
                        value={mpPosNameInput}
                        onChange={(e) => setMpPosNameInput(e.target.value)}
                        placeholder="Ej: Caja 1"
                      />
                    </div>
                  </div>
                  <div className="mp-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSetupPos}
                      disabled={mpSetupLoading}
                    >
                      {mpSetupLoading ? 'Configurando...' : 'Configurar QR'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleDisconnectMp}
                      disabled={mpDisconnecting}
                    >
                      {mpDisconnecting ? 'Desconectando...' : 'Desconectar'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mp-status-row">
                    <span className="mp-status-label">Cuenta</span>
                    <span className="mp-status-value">{mpStatus?.email ?? '—'}</span>
                  </div>
                  <div className="mp-status-row">
                    <span className="mp-status-label">POS</span>
                    <span className="badge badge-info">Configurado</span>
                  </div>
                  {mpStatus.mpQrData && (
                    <div className="mp-qr-preview">
                      <img src={mpStatus.mpQrData} alt="QR MercadoPago" className="mp-qr-image" />
                    </div>
                  )}
                  <div className="mp-actions">
                    {mpStatus.mpQrData && (
                      <a
                        href={mpStatus.mpQrData}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary"
                      >
                        Descargar QR
                      </a>
                    )}
                    <button type="button" className="btn-secondary" onClick={handleReconfigurePos}>
                      Reconfigurar POS
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={handleDisconnectMp}
                      disabled={mpDisconnecting}
                    >
                      {mpDisconnecting ? 'Desconectando...' : 'Desconectar cuenta'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB: Caja */}
        {activeTab === 'caja' && (
          <div className="settings-section">
            <h3 className="settings-section-header">Motivos de movimientos</h3>
            <p className="settings-section-desc">
              Configura los motivos disponibles para los movimientos de caja (entradas y salidas).
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowMovementReasonsModal(true)}
            >
              Configurar motivos
            </button>
          </div>
        )}

        {/* TAB: Sistema */}
        {activeTab === 'sistema' && (
          <div className="settings-section">
            <h3 className="settings-section-header">Informacion del sistema</h3>
            <div className="system-info-list">
              <div className="system-info-row">
                <span className="system-info-label">Aplicacion</span>
                <span className="system-info-value">m-POSw</span>
              </div>
              <div className="system-info-row">
                <span className="system-info-label">Version</span>
                <span className="system-info-value">2.0.0</span>
              </div>
              <div className="system-info-row">
                <span className="system-info-label">Licencia</span>
                <span className="system-info-value">MIT</span>
              </div>
            </div>
            <div className="mp-actions" style={{ marginTop: '1.25rem' }}>
              <a
                href="https://github.com/hectororviz/m-posw/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                Descargar APK
              </a>
              <button type="button" className="btn-ghost" onClick={handleOpenAbout}>
                Acerca de...
              </button>
            </div>
          </div>
        )}
      </div>

      {activeTab !== 'mercadopago' && activeTab !== 'sistema' && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="settings-footer">
            <div className="settings-footer-left" />
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar configuracion'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Acerca de */}
      {showAboutModal && (
        <div className="modal-backdrop" onClick={() => setShowAboutModal(false)}>
          <div className="modal about-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Acerca del sistema</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowAboutModal(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="modal-body about-modal-body">
              <div className="about-content-markdown" dangerouslySetInnerHTML={{ __html: aboutHtml }} />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Motivos de Movimientos */}
      {showMovementReasonsModal && (
        <div className="modal-backdrop" onClick={() => setShowMovementReasonsModal(false)}>
          <div className="modal movement-reasons-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configurar motivos de movimientos</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowMovementReasonsModal(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="movement-reasons-columns">
                <div className="movement-reasons-column">
                  <h4>Motivos de Entrada</h4>
                  <div className="reasons-list">
                    <div className="reason-tag reason-tag--default">
                      <span>Apertura de Caja</span>
                      <small>(Sistema)</small>
                    </div>
                    <div className="reason-tag reason-tag--default">
                      <span>Otro</span>
                      <small>(Sistema)</small>
                    </div>
                    {form.movementInReasons.map((reason) => (
                      <span key={reason} className="reason-tag">
                        {reason}
                        <button
                          type="button"
                          className="reason-remove-btn"
                          onClick={() => handleRemoveInReason(reason)}
                          aria-label={`Eliminar ${reason}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="add-reason-row">
                    <input
                      type="text"
                      placeholder="Nuevo motivo"
                      value={newInReason}
                      onChange={(e) => setNewInReason(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleAddInReason(); }
                      }}
                    />
                    <button type="button" className="secondary-button" onClick={handleAddInReason}>
                      Agregar
                    </button>
                  </div>
                </div>
                <div className="movement-reasons-column">
                  <h4>Motivos de Salida</h4>
                  <div className="reasons-list">
                    <div className="reason-tag reason-tag--default">
                      <span>Retiro de caja</span>
                      <small>(Sistema)</small>
                    </div>
                    <div className="reason-tag reason-tag--default">
                      <span>Otro</span>
                      <small>(Sistema)</small>
                    </div>
                    {form.movementOutReasons.map((reason) => (
                      <span key={reason} className="reason-tag">
                        {reason}
                        <button
                          type="button"
                          className="reason-remove-btn"
                          onClick={() => handleRemoveOutReason(reason)}
                          aria-label={`Eliminar ${reason}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="add-reason-row">
                    <input
                      type="text"
                      placeholder="Nuevo motivo"
                      value={newOutReason}
                      onChange={(e) => setNewOutReason(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleAddOutReason(); }
                      }}
                    />
                    <button type="button" className="secondary-button" onClick={handleAddOutReason}>
                      Agregar
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="primary-button" onClick={handleSaveMovementReasons}>
                  Guardar motivos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
