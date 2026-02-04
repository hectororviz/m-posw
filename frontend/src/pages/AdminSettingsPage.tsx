import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSettings } from '../api/queries';
import type { Setting } from '../api/types';
import { useToast } from '../components/ToastProvider';

export const AdminSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { pushToast } = useToast();
  const [form, setForm] = useState({
    storeName: '',
    clubName: '',
    enableTicketPrinting: false,
    accentColor: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setForm({
        storeName: settings.storeName ?? '',
        clubName: settings.clubName ?? '',
        enableTicketPrinting: settings.enableTicketPrinting ?? false,
        accentColor: settings.accentColor ?? '',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setError(null);
    try {
      const response = await apiClient.patch<Setting>('/settings', form);
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

  return (
    <section className="card">
      <h2>Settings</h2>
      <div className="form-grid">
        <input
          type="text"
          placeholder="Nombre del local"
          value={form.storeName}
          onChange={(event) => setForm({ ...form, storeName: event.target.value })}
        />
        <input
          type="text"
          placeholder="Nombre del club"
          value={form.clubName}
          onChange={(event) => setForm({ ...form, clubName: event.target.value })}
        />
        <label className="toggle-field">
          <span>Imprimir ticket al finalizar venta</span>
          <input
            type="checkbox"
            checked={form.enableTicketPrinting}
            onChange={(event) => setForm({ ...form, enableTicketPrinting: event.target.checked })}
          />
        </label>
        <input
          type="text"
          placeholder="#ff0066"
          value={form.accentColor}
          onChange={(event) => setForm({ ...form, accentColor: event.target.value })}
        />
        <button type="button" className="primary-button" onClick={handleSave}>
          Guardar
        </button>
      </div>
      <div className="form-grid">
        <label className="file-label">
          Logo
          <input type="file" accept="image/*" onChange={(event) => handleUpload('logo', event.target.files?.[0])} />
        </label>
        <label className="file-label">
          Favicon
          <input
            type="file"
            accept="image/png,image/svg+xml,image/x-icon"
            onChange={(event) => handleUpload('favicon', event.target.files?.[0])}
          />
        </label>
      </div>
      <div className="form-grid">
        <label className="file-label">
          Animacion OK
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => handleUpload('animation-ok', event.target.files?.[0])}
          />
        </label>
        <label className="file-label">
          Animacion Error
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => handleUpload('animation-error', event.target.files?.[0])}
          />
        </label>
      </div>
      {error && <p className="error-text">{error}</p>}
    </section>
  );
};
