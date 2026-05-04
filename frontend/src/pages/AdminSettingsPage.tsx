import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { marked } from 'marked';
import * as emoji from 'node-emoji';
import { apiClient, normalizeApiError } from '../api/client';
import { useSettings } from '../api/queries';
import type { Setting } from '../api/types';
import { useToast } from '../components/ToastProvider';
import { useEmbeddedKeyboard } from '../hooks/useEmbeddedKeyboard';

export const AdminSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { pushToast } = useToast();
  const { showEmbeddedKeyboard, setShowEmbeddedKeyboard } = useEmbeddedKeyboard();
  const [form, setForm] = useState({
    storeName: '',
    clubName: '',
    enableTicketPrinting: false,
    accentColor: '',
    enableCashPayment: true,
    enableQrPayment: true,
    enableTransferPayment: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [aboutContent, setAboutContent] = useState('');

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
      });
    }
  }, [settings]);

  // Validar que al menos un medio de pago esté activo
  const validatePaymentMethods = (newForm: typeof form): typeof form => {
    const { enableCashPayment, enableQrPayment, enableTransferPayment } = newForm;
    
    // Si todos están desactivados, activar Efectivo por defecto
    if (!enableCashPayment && !enableQrPayment && !enableTransferPayment) {
      return { ...newForm, enableCashPayment: true };
    }
    
    return newForm;
  };

  const handlePaymentMethodChange = (field: keyof typeof form, value: boolean) => {
    setForm((prev) => validatePaymentMethods({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setError(null);
    // Asegurar que al menos un medio de pago esté activo antes de guardar
    const validatedForm = validatePaymentMethods(form);
    setForm(validatedForm);
    
    try {
      const response = await apiClient.patch<Setting>('/settings', validatedForm);
      queryClient.setQueryData(['settings'], response.data);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      pushToast('Configuración actualizada', 'success');
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleUpload = async (
    type: 'logo' | 'favicon' | 'animation-ok' | 'animation-error',
    file?: File | null,
  ) => {
    if (!file) {
      return;
    }
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.post(`/settings/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleOpenAbout = async () => {
    try {
      const response = await fetch('/about.md');
      if (response.ok) {
        const text = await response.text();
        setAboutContent(text);
      } else {
        setAboutContent('No se encontró el archivo de información.');
      }
    } catch {
      setAboutContent('Error al cargar la información.');
    }
    setShowAboutModal(true);
  };

  // Parsear markdown a HTML (convirtiendo emojis tipo :soccer: primero)
  const aboutHtml = useMemo(() => {
    const contentWithEmojis = emoji.emojify(aboutContent);
    return marked.parse(contentWithEmojis, { async: false }) as string;
  }, [aboutContent]);

  // Verificar si todos los medios de pago están desactivados
  const allPaymentMethodsDisabled = !form.enableCashPayment && !form.enableQrPayment && !form.enableTransferPayment;

  return (
    <section className="card admin-products">
      <h2>Settings</h2>
      <div className="settings-form-two-columns">
        <div className="settings-row">
          <label htmlFor="store-name">Nombre del local</label>
          <input
            id="store-name"
            type="text"
            value={form.storeName}
            onChange={(event) => setForm({ ...form, storeName: event.target.value })}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="club-name">Nombre del Club/empresa</label>
          <input
            id="club-name"
            type="text"
            value={form.clubName}
            onChange={(event) => setForm({ ...form, clubName: event.target.value })}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="accent-color">Color de personalización</label>
          <input
            id="accent-color"
            type="text"
            value={form.accentColor}
            onChange={(event) => setForm({ ...form, accentColor: event.target.value })}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="logo-upload">Logo</label>
          <input
            id="logo-upload"
            type="file"
            accept="image/*"
            onChange={(event) => handleUpload('logo', event.target.files?.[0])}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="favicon-upload">Favicon</label>
          <input
            id="favicon-upload"
            type="file"
            accept="image/png,image/svg+xml,image/x-icon"
            onChange={(event) => handleUpload('favicon', event.target.files?.[0])}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="animation-ok-upload">Animación OK</label>
          <input
            id="animation-ok-upload"
            type="file"
            accept="application/json,.json"
            onChange={(event) => handleUpload('animation-ok', event.target.files?.[0])}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="animation-error-upload">Animación Error</label>
          <input
            id="animation-error-upload"
            type="file"
            accept="application/json,.json"
            onChange={(event) => handleUpload('animation-error', event.target.files?.[0])}
          />
        </div>
        
        <div className="settings-checkboxes-row">
          <label className="switch settings-switch">
            <input
              type="checkbox"
              checked={form.enableTicketPrinting}
              onChange={(event) => setForm({ ...form, enableTicketPrinting: event.target.checked })}
            />
            Imprimir ticket
          </label>
          <label className="switch settings-switch">
            <input
              type="checkbox"
              checked={showEmbeddedKeyboard}
              onChange={(event) => setShowEmbeddedKeyboard(event.target.checked)}
            />
            Teclado embebido
          </label>
        </div>

        {/* Medios de Pago */}
        <div className="settings-payment-methods">
          <h3>Medios de pago</h3>
          {allPaymentMethodsDisabled && (
            <p className="warning-text">
              ⚠️ Debe habilitar al menos un medio de pago. Efectivo se activará por defecto.
            </p>
          )}
          <div className="settings-checkboxes-row">
            <label className="switch settings-switch">
              <input
                type="checkbox"
                checked={form.enableCashPayment}
                onChange={(event) => handlePaymentMethodChange('enableCashPayment', event.target.checked)}
              />
              Efectivo
            </label>
            <label className="switch settings-switch">
              <input
                type="checkbox"
                checked={form.enableQrPayment}
                onChange={(event) => handlePaymentMethodChange('enableQrPayment', event.target.checked)}
              />
              QR MercadoPago
            </label>
            <label className="switch settings-switch">
              <input
                type="checkbox"
                checked={form.enableTransferPayment}
                onChange={(event) => handlePaymentMethodChange('enableTransferPayment', event.target.checked)}
              />
              Transferencia
            </label>
          </div>
        </div>
      </div>
      
      <div className="settings-actions-row">
        <button type="button" className="primary-button" onClick={handleSave}>
          Guardar
        </button>
        <button type="button" className="secondary-button about-button" onClick={handleOpenAbout}>
          Acerca de...
        </button>
      </div>
      
      {error && <p className="error-text">{error}</p>}

      {/* Modal Acerca de */}
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
              <div 
                className="about-content-markdown" 
                dangerouslySetInnerHTML={{ __html: aboutHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
