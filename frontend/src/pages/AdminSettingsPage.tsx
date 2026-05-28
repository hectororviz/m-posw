import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { marked } from 'marked';
import * as emoji from 'node-emoji';
import { apiClient, normalizeApiError } from '../api/client';
import { useMpOauthStatus, useSettings, useUsers } from '../api/queries';
import type { Role, Setting, User } from '../api/types';
import { useToast } from '../components/ToastProvider';
import { useEmbeddedKeyboard } from '../hooks/useEmbeddedKeyboard';

type TabId = 'general' | 'ventas' | 'mercadopago' | 'caja' | 'usuarios' | 'sistema';

type MpSetupMode = 'setup_required' | 'select_store' | null;

interface DetectedStore {
  id: string;
  name: string;
  address: string;
  pos: Array<{ id: string; name: string; qrUrl: string }>;
}

const MP_VALID_CITIES = [
  '12 De Octubre',
  '25 de Mayo',
  '9 de Julio',
  'Adolfo Alsina',
  'Adolfo Gonzales Chaves',
  'Alberti',
  'Arrecifes',
  'Avellaneda',
  'Ayacucho',
  'Azul',
  'Bahía Blanca',
  'Balcarce',
  'Baradero',
  'Beccar',
  'Benito Juárez',
  'Berazategui',
  'Berisso',
  'Bolívar',
  'Boulogne',
  'Bragado',
  'Brandsen',
  'Campana',
  'Capitán Sarmiento',
  'Cariló',
  'Carlos Casares',
  'Carlos Tejedor',
  'Carmen de Areco',
  'Caseros',
  'Castelar',
  'Castelli',
  'Cañuelas',
  'Chacabuco',
  'Chascomús',
  'Chivilcoy',
  'Colón',
  'Coronel Dorrego',
  'Coronel Pringles',
  'Coronel Rosales',
  'Coronel Suárez',
  'Daireaux',
  'Del Viso',
  'Dolores',
  'Don Torcuato',
  'Ensenada',
  'Escobar',
  'Ezeiza',
  'Florencio Varela',
  'Florentino Ameghino',
  'General Alvarado',
  'General Alvear',
  'General Arenales',
  'General Belgrano',
  'General Guido',
  'General La Madrid',
  'General Las Heras',
  'General Lavalle',
  'General Madariaga',
  'General Paz',
  'General Pinto',
  'General Pueyrredón',
  'General Rodríguez',
  'General San Martín',
  'General Viamonte',
  'General Villegas',
  'Guaminí',
  'Hipólito Yrigoyen',
  'Hurlingham',
  'Ituzaingó',
  'José C. Paz',
  'Junín',
  'La Matanza',
  'La Plata',
  'Lanús',
  'Laprida',
  'Las Flores',
  'Leandro N. Alem',
  'Lincoln',
  'Lobería',
  'Lobos',
  'Lomas de Zamora',
  'Luján',
  'Magdalena',
  'Maipú',
  'Malvinas Argentinas',
  'Mar de Ajo',
  'Mar del Plata',
  'Mar del Tuyu',
  'Marcos Paz',
  'Mercedes',
  'Merlo',
  'Miramar',
  'Monte',
  'Monte Hermoso',
  'Moreno',
  'Morón',
  'Navarro',
  'Necochea',
  'Olavarría',
  'Patagones',
  'Pehuajó',
  'Pellegrini',
  'Pergamino',
  'Pila',
  'Pilar',
  'Pinamar',
  'Presidente Perón',
  'Puán',
  'Punta Indio',
  'Quilmes',
  'Ramallo',
  'Ranchos',
  'Rauch',
  'Remedios De Escalada',
  'Rivadavia',
  'Rojas',
  'Roque Pérez',
  'Saavedra',
  'Saladillo',
  'Salliqueló',
  'Salto',
  'San Andrés de Giles',
  'San Antonio de Areco',
  'San Cayetano',
  'San Clemente',
  'San Fernando',
  'San Isidro',
  'San Miguel',
  'San Nicolás',
  'San Pedro',
  'San Vicente',
  'Suipacha',
  'Tandil',
  'Tapalqué',
  'Tigre',
  'Tordillo',
  'Tornquist',
  'Trenque Lauquen',
  'Tres Arroyos',
  'Tres Lomas',
  'Tres de febrero',
  'Vicente López',
  'Villa Adelina',
  'Villa Gesell',
  'Villarino',
  'Wilde',
  'Zárate',
];

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'mercadopago', label: 'Mercado Pago' },
  { id: 'caja', label: 'Caja' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'sistema', label: 'Sistema' },
];

export const AdminSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: settings } = useSettings();
  const { data: mpStatus, refetch: refetchMpStatus } = useMpOauthStatus();
  const { pushToast } = useToast();
  const { showEmbeddedKeyboard, setShowEmbeddedKeyboard } = useEmbeddedKeyboard();
  const { data: users, refetch: refetchUsers } = useUsers();
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
  const [mpStreetName, setMpStreetName] = useState('');
  const [mpStreetNumber, setMpStreetNumber] = useState('');
  const [mpCityName, setMpCityName] = useState('Mar del Plata');
  const [mpStateName, setMpStateName] = useState('');
  const [mpZipCode, setMpZipCode] = useState('');
  const [mpSetupMode, setMpSetupMode] = useState<MpSetupMode>(null);
  const [detectedStores, setDetectedStores] = useState<DetectedStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedPosId, setSelectedPosId] = useState('');
  const [mpSelectLoading, setMpSelectLoading] = useState(false);
  const [mpDetectLoading, setMpDetectLoading] = useState(false);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'USER' as Role, active: true });
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userDeleting, setUserDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const resetUserForm = () => {
    setUserForm({ name: '', email: '', password: '', role: 'USER', active: true });
    setShowChangePassword(false);
    setEditingUser(null);
  };

  const openCreateUser = () => {
    resetUserForm();
    setUserModalOpen(true);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({ name: user.name, email: user.email ?? '', password: '', role: user.role, active: user.active ?? true });
    setShowChangePassword(false);
    setUserModalOpen(true);
  };

  const handleUserSave = async () => {
    setUserSaving(true);
    try {
      if (editingUser) {
        const payload: Record<string, unknown> = { name: userForm.name, email: userForm.email || undefined, role: userForm.role, active: userForm.active };
        if (userForm.password) payload.password = userForm.password;
        await apiClient.patch(`/users/${editingUser.id}`, payload);
        pushToast('Usuario actualizado', 'success');
      } else {
        await apiClient.post('/users', {
          name: userForm.name,
          email: userForm.email || undefined,
          password: userForm.password,
          role: userForm.role,
        });
        pushToast('Usuario creado', 'success');
      }
      setUserModalOpen(false);
      resetUserForm();
      await refetchUsers();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setUserSaving(false);
    }
  };

  const handleUserDelete = async () => {
    if (!deleteTarget) return;
    setUserDeleting(true);
    try {
      await apiClient.delete(`/users/${deleteTarget.id}`);
      pushToast(`Usuario "${deleteTarget.name}" eliminado`, 'success');
      setDeleteTarget(null);
      await refetchUsers();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setUserDeleting(false);
    }
  };

  useEffect(() => {
    const mpParam = searchParams.get('mp');
    if (mpParam === 'connected') {
      pushToast('Mercado Pago conectado correctamente', 'success');
      refetchMpStatus();
      setSearchParams({}, { replace: true });
      setMpSetupMode(null);
    } else if (mpParam === 'error') {
      pushToast('Error al conectar Mercado Pago, intenta de nuevo', 'error');
      setSearchParams({}, { replace: true });
      setMpSetupMode(null);
    } else if (mpParam === 'setup_required') {
      setMpSetupMode('setup_required');
      refetchMpStatus();
      setSearchParams({}, { replace: true });
    } else if (mpParam === 'select_store') {
      const stored = sessionStorage.getItem('mp_detected_stores');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as DetectedStore[];
          setDetectedStores(parsed);
          setMpSetupMode('select_store');
          sessionStorage.removeItem('mp_detected_stores');
        } catch {
          setMpSetupMode('setup_required');
        }
      } else {
        setMpSetupMode('setup_required');
      }
      refetchMpStatus();
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
    if (!mpStoreNameInput.trim() || !mpPosNameInput.trim() || !mpStreetName.trim() || !mpStreetNumber.trim() || !mpCityName.trim() || !mpStateName.trim() || !mpZipCode.trim()) {
      pushToast('Completa todos los campos para configurar el QR', 'error');
      return;
    }
    setMpSetupLoading(true);
    try {
      await apiClient.post('/mp-oauth/setup-pos', {
        storeName: mpStoreNameInput.trim(),
        posName: mpPosNameInput.trim(),
        streetName: mpStreetName.trim(),
        streetNumber: mpStreetNumber.trim(),
        cityName: mpCityName.trim(),
        stateName: mpStateName.trim(),
        zipCode: mpZipCode.trim(),
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
      setMpSetupMode('setup_required');
      pushToast('Configuracion de POS eliminada. Podes volver a configurarlo.', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  const handleSelectStore = async () => {
    if (!selectedStoreId || !selectedPosId) {
      pushToast('Selecciona una tienda y un punto de venta', 'error');
      return;
    }
    setMpSelectLoading(true);
    try {
      await apiClient.post('/mp-oauth/select-store', {
        storeId: selectedStoreId,
        posId: selectedPosId,
      });
      await refetchMpStatus();
      setMpSetupMode(null);
      pushToast('Punto de venta configurado correctamente', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setMpSelectLoading(false);
    }
  };

  const handleCreateNewStore = () => {
    setMpSetupMode('setup_required');
  };

  const handleDetectStores = async (showToast = false) => {
    setMpDetectLoading(true);
    try {
      const response = await apiClient.get<{
        status: 'already_configured' | 'no_stores' | 'found_stores';
        stores?: DetectedStore[];
      }>('/mp-oauth/detect-stores');

      const detection = response.data;

      if (detection.status === 'already_configured') {
        await refetchMpStatus();
        setMpSetupMode(null);
        if (showToast) pushToast('Punto de venta ya configurado', 'success');
      } else if (detection.status === 'found_stores' && detection.stores && detection.stores.length > 0) {
        setDetectedStores(detection.stores);
        setMpSetupMode('select_store');
      } else {
        setMpSetupMode('setup_required');
        if (showToast) pushToast('No se encontraron tiendas en tu cuenta', 'info');
      }
    } catch (err) {
      setMpSetupMode('setup_required');
      if (showToast) pushToast(normalizeApiError(err), 'error');
    } finally {
      setMpDetectLoading(false);
    }
  };

  useEffect(() => {
    if (mpStatus?.linked && !mpStatus?.mpPosId && mpSetupMode === null) {
      handleDetectStores();
    }
  }, [mpStatus?.linked, mpStatus?.mpPosId, mpSetupMode]);

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
                mpSetupMode === 'select_store' && detectedStores.length > 0 ? (
                  <>
                    <div className="mp-status-row">
                      <span className="mp-status-label">Estado</span>
                      <span className="badge badge-warning">Pendiente seleccionar tienda</span>
                    </div>
                    <p className="mp-status-section-msg">
                      Encontramos tiendas existentes en tu cuenta de Mercado Pago
                    </p>
                    <div className="mp-stores-list">
                      {detectedStores.map((store) => (
                        <div key={store.id} className="mp-store-group">
                          <h4 className="mp-store-name">{store.name}</h4>
                          {store.address && (
                            <p className="mp-store-address">{store.address}</p>
                          )}
                          {store.pos.length === 0 ? (
                            <p className="mp-no-pos-msg">Sin puntos de venta</p>
                          ) : (
                            <div className="mp-pos-list">
                              {store.pos.map((p) => {
                                const isSelected =
                                  selectedStoreId === store.id && selectedPosId === p.id;
                                return (
                                  <label
                                    key={p.id}
                                    className={`mp-pos-option ${isSelected ? 'mp-pos-option--selected' : ''}`}
                                  >
                                    <input
                                      type="radio"
                                      name="mp-pos-selection"
                                      value={p.id}
                                      checked={isSelected}
                                      onChange={() => {
                                        setSelectedStoreId(store.id);
                                        setSelectedPosId(p.id);
                                      }}
                                    />
                                    <span className="mp-pos-option-name">{p.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mp-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSelectStore}
                        disabled={mpSelectLoading || !selectedPosId}
                      >
                        {mpSelectLoading ? 'Guardando...' : 'Usar seleccionado'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleCreateNewStore}
                      >
                        Crear nueva tienda
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
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
                      <span className="mp-status-label">Estado</span>
                      <span className="badge badge-warning">Pendiente configurar POS</span>
                    </div>
                    {mpSetupMode === 'setup_required' ? (
                      <p className="mp-status-section-msg">
                        No se encontraron tiendas existentes en tu cuenta
                      </p>
                    ) : (
                      <p className="mp-status-section-msg">
                        Configura el punto de venta para aceptar pagos con QR
                      </p>
                    )}
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
                      <div className="settings-field">
                        <label htmlFor="mp-street-name">Calle</label>
                        <input
                          id="mp-street-name"
                          type="text"
                          value={mpStreetName}
                          onChange={(e) => setMpStreetName(e.target.value)}
                          placeholder="Ej: Av. Corrientes"
                        />
                      </div>
                      <div className="settings-field">
                        <label htmlFor="mp-street-number">Numero</label>
                        <input
                          id="mp-street-number"
                          type="text"
                          value={mpStreetNumber}
                          onChange={(e) => setMpStreetNumber(e.target.value)}
                          placeholder="Ej: 1234"
                        />
                      </div>
                      <div className="settings-field">
                        <label htmlFor="mp-city-name">Ciudad</label>
                        <select
                          id="mp-city-name"
                          value={mpCityName}
                          onChange={(e) => setMpCityName(e.target.value)}
                        >
                          {MP_VALID_CITIES.map((city) => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      </div>
                      <div className="settings-field">
                        <label htmlFor="mp-state-name">Provincia</label>
                        <input
                          id="mp-state-name"
                          type="text"
                          value={mpStateName}
                          onChange={(e) => setMpStateName(e.target.value)}
                          placeholder="Ej: Buenos Aires"
                        />
                      </div>
                      <div className="settings-field">
                        <label htmlFor="mp-zip-code">Codigo Postal</label>
                        <input
                          id="mp-zip-code"
                          type="text"
                          value={mpZipCode}
                          onChange={(e) => setMpZipCode(e.target.value)}
                          placeholder="Ej: 1043"
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
                        {mpSetupLoading ? 'Configurando...' : 'Crear tienda y punto de venta'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleDetectStores(true)}
                        disabled={mpDetectLoading}
                      >
                        {mpDetectLoading ? 'Buscando...' : 'Buscar tiendas existentes'}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={handleDisconnectMp}
                        disabled={mpDisconnecting}
                      >
                        {mpDisconnecting ? 'Desconectando...' : 'Desconectar'}
                      </button>
                    </div>
                  </>
                )
              ) : (
                <>
                  <div className="mp-status-row">
                    <span className="mp-status-label">Vencimiento del token</span>
                    <span className="mp-status-value">
                      {mpStatus?.expiresAt
                        ? new Date(mpStatus.expiresAt).toLocaleDateString('es-AR')
                        : '—'}
                    </span>
                  </div>
                  <div className="mp-status-row">
                    <span className="mp-status-label">POS</span>
                    <span className="badge badge-info">Configurado</span>
                  </div>
                  {mpStatus?.mpQrData && (
                    <div className="mp-qr-preview">
                      <img src={mpStatus.mpQrData} alt="QR MercadoPago" className="mp-qr-image" />
                    </div>
                  )}
                  <div className="mp-actions">
                    {mpStatus?.mpQrData && (
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

        {/* TAB: Usuarios */}
        {activeTab === 'usuarios' && (
          <>
            <div className="page-header" style={{ marginBottom: '1rem', paddingBottom: '0.75rem' }}>
              <h2 className="page-header-title">Usuarios</h2>
              <p className="page-header-subtitle">Gestiona las personas que pueden acceder al sistema.</p>
            </div>
            {(!users || users.length === 0) ? (
              <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
                <p style={{ color: 'var(--color-text-faint)', margin: '0 0 0.5rem', fontSize: '0.95rem' }}>No hay usuarios registrados.</p>
                <p style={{ color: 'var(--color-border-heavy)', margin: 0, fontSize: '0.85rem' }}>Crea el primer usuario para empezar.</p>
              </div>
            ) : (
              <div className="user-list">
                {users.map((user) => (
                  <div key={user.id} className="user-list-row">
                    <div className="user-list-info">
                      <span className="user-list-name">{user.name}</span>
                      <span className="user-list-email">{user.email || 'Sin email'}</span>
                      <span className={`badge ${user.role === 'ADMIN' ? 'badge-info' : 'badge-neutral'}`}>
                        {user.role === 'ADMIN' ? 'Admin' : 'Caja'}
                      </span>
                      <span className={`badge ${user.active !== false ? 'badge-success' : 'badge-neutral'}`} style={{ opacity: user.active !== false ? 1 : 0.5 }}>
                        {user.active !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div className="user-list-actions">
                      <button type="button" className="btn-ghost" onClick={() => openEditUser(user)} aria-label={`Editar ${user.name}`}>
                        ✎
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(user)} aria-label={`Eliminar ${user.name}`}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="fab-button-v2" onClick={openCreateUser} aria-label="Nuevo usuario" title="Nuevo usuario">
              +
            </button>
          </>
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

      {/* Modal: Crear / Editar Usuario */}
      {userModalOpen && (
        <div className="modal-backdrop" onClick={() => { setUserModalOpen(false); resetUserForm(); }}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingUser ? 'Editar usuario' : 'Nuevo usuario'}</h3>
              <button type="button" className="icon-button" onClick={() => { setUserModalOpen(false); resetUserForm(); }} aria-label="Cerrar">✕</button>
            </div>
            <div className="modal-body">
              <div className="settings-field">
                <label htmlFor="user-name">Nombre</label>
                <input id="user-name" type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="Ej: Juan Perez" />
              </div>
              <div className="settings-field">
                <label htmlFor="user-email">Email</label>
                <input id="user-email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="Opcional" />
              </div>
              <div className="settings-field">
                <label htmlFor="user-role">Rol</label>
                <select id="user-role" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })} style={{ maxWidth: '220px' }}>
                  <option value="ADMIN">ADMIN — Acceso completo</option>
                  <option value="USER">USER — Operacion de caja</option>
                </select>
              </div>
              <div className="settings-field">
                <label className="toggle-switch">
                  <input type="checkbox" checked={userForm.active} onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })} />
                  <span className="toggle-switch-track" />
                  Activo
                </label>
              </div>
              {!editingUser && (
                <div className="settings-field">
                  <label htmlFor="user-password">Contraseña</label>
                  <input id="user-password" type="password" inputMode="numeric" pattern="[0-9]*" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value.replace(/\D/g, '') })} placeholder="Minimo 6 digitos" />
                </div>
              )}
              {editingUser && !showChangePassword && (
                <button type="button" className="btn-ghost" onClick={() => setShowChangePassword(true)} style={{ marginBottom: '0.75rem' }}>
                  Cambiar contraseña
                </button>
              )}
              {editingUser && showChangePassword && (
                <div className="settings-field">
                  <label htmlFor="user-password-edit">Nueva contraseña</label>
                  <input id="user-password-edit" type="password" inputMode="numeric" pattern="[0-9]*" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value.replace(/\D/g, '') })} placeholder="Minimo 6 digitos" />
                </div>
              )}
              <div className="modal-footer" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => { setUserModalOpen(false); resetUserForm(); }}>
                  Cancelar
                </button>
                <button type="button" className="btn-primary" onClick={handleUserSave} disabled={userSaving || !userForm.name || (!editingUser && !userForm.password)}>
                  {userSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Eliminar Usuario */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Eliminar usuario</h3>
              <button type="button" className="icon-button" onClick={() => setDeleteTarget(null)} aria-label="Cerrar">✕</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 0.5rem', color: 'var(--color-text-body)' }}>
                <strong>{deleteTarget.name}</strong> ya no podra acceder al sistema.
              </p>
              <div className="modal-footer" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>
                  Cancelar
                </button>
                <button type="button" className="btn-primary" onClick={handleUserDelete} disabled={userDeleting} style={{ background: 'var(--color-danger)' }}>
                  {userDeleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
      {activeTab !== 'mercadopago' && activeTab !== 'sistema' && activeTab !== 'usuarios' && (
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
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
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
