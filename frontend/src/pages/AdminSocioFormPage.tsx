import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSocio, useSociosTipos } from '../api/queries';
import { useToast } from '../components/ToastProvider';

export const AdminSocioFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const socioId = id ? Number(id) : undefined;
  const { data: socio } = useSocio(isEditing ? socioId : undefined);
  const { data: tipos = [] } = useSociosTipos();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nroSocio: '',
    dni: '',
    apellido: '',
    nombre: '',
    fechaNacimiento: '',
    telefono: '',
    direccion: '',
    socioTipoId: '',
    fechaAlta: new Date().toISOString().slice(0, 10),
    estado: 'ACTIVO' as string,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (socio && isEditing) {
      setForm({
        nroSocio: String(socio.nroSocio),
        dni: socio.dni,
        apellido: socio.apellido,
        nombre: socio.nombre,
        fechaNacimiento: socio.fechaNacimiento ? socio.fechaNacimiento.slice(0, 10) : '',
        telefono: socio.telefono ?? '',
        direccion: socio.direccion ?? '',
        socioTipoId: String(socio.socioTipoId),
        fechaAlta: socio.fechaAlta.slice(0, 10),
        estado: socio.estado,
      });
    }
  }, [socio, isEditing]);

  const handleSave = async () => {
    if (!form.apellido.trim() || !form.nombre.trim() || !form.dni.trim()) {
      setError('Apellido, nombre y DNI son obligatorios');
      return;
    }
    if (!form.nroSocio || !form.socioTipoId) {
      setError('Numero de socio y tipo son obligatorios');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        nroSocio: Number(form.nroSocio),
        dni: form.dni,
        apellido: form.apellido,
        nombre: form.nombre,
        fechaNacimiento: form.fechaNacimiento || undefined,
        telefono: form.telefono || undefined,
        direccion: form.direccion || undefined,
        socioTipoId: Number(form.socioTipoId),
        fechaAlta: form.fechaAlta,
        estado: form.estado,
      };

      if (isEditing) {
        await apiClient.put(`/socios/${socioId}`, payload);
        pushToast('Socio actualizado', 'success');
      } else {
        await apiClient.post('/socios', payload);
        pushToast('Socio creado', 'success');
      }
      await queryClient.invalidateQueries({ queryKey: ['socios'] });
      navigate('/admin/socios');
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigate('/admin/socios')}
              style={{ marginBottom: '0.5rem' }}
            >
              &larr; Volver
            </button>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>
              {isEditing ? 'Editar socio' : 'Nuevo socio'}
            </h2>
          </div>
        </div>
      </div>

      <div className="settings-section">
        {error && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          <div className="settings-field">
            <label>Numero de Socio *</label>
            <input
              type="number"
              value={form.nroSocio}
              onChange={(e) => setForm({ ...form, nroSocio: e.target.value })}
              placeholder="Numero de socio"
            />
          </div>
          <div className="settings-field">
            <label>DNI *</label>
            <input
              type="text"
              value={form.dni}
              onChange={(e) => setForm({ ...form, dni: e.target.value })}
              placeholder="DNI"
            />
          </div>
          <div className="settings-field">
            <label>Apellido *</label>
            <input
              type="text"
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              placeholder="Apellido"
            />
          </div>
          <div className="settings-field">
            <label>Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre"
            />
          </div>
          <div className="settings-field">
            <label>Fecha de Nacimiento</label>
            <input
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })}
            />
          </div>
          <div className="settings-field">
            <label>Telefono</label>
            <input
              type="text"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="Telefono"
            />
          </div>
          <div className="settings-field">
            <label>Direccion</label>
            <input
              type="text"
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              placeholder="Direccion"
            />
          </div>
          <div className="settings-field">
            <label>Tipo de Socio *</label>
            <select
              value={form.socioTipoId}
              onChange={(e) => setForm({ ...form, socioTipoId: e.target.value })}
            >
              <option value="">Seleccionar tipo</option>
              {tipos.filter(t => t.activo).map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div className="settings-field">
            <label>Fecha de Alta *</label>
            <input
              type="date"
              value={form.fechaAlta}
              onChange={(e) => setForm({ ...form, fechaAlta: e.target.value })}
            />
          </div>
          <div className="settings-field">
            <label>Estado</label>
            <select
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
            >
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="SUSPENDIDO">Suspendido</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" className="btn-ghost" onClick={() => navigate('/admin/socios')}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};
