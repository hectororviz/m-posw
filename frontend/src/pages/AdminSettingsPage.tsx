import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSettings } from '../api/queries';

export const AdminSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const [form, setForm] = useState({ storeName: '', accentColor: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setForm({
        storeName: settings.storeName ?? '',
        accentColor: settings.accentColor ?? '',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setError(null);
    try {
      await apiClient.patch('/settings', form);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleUpload = async (type: 'logo' | 'favicon', file?: File | null) => {
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
      {error && <p className="error-text">{error}</p>}
    </section>
  );
};
