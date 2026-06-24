import { useState } from 'react';
import { Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useAssets, useAssetCategories, useAssetStatuses } from '../../api/queries';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { AssetStatusBadge } from './components/AssetStatusBadge';
import { AssetForm } from './components/AssetForm';
import { AssetDetail } from './components/AssetDetail';
import { ChangeStatusModal } from './components/ChangeStatusModal';
import { BajaConfirmModal } from './components/BajaConfirmModal';

const LIMITS = [10, 25, 50, 100];

export const BienesPage: React.FC = () => {
  const access = useModuleAccess('PATRIMONIO');
  const isFull = access === 'FULL';
  const isRead = access === 'READ' || access === 'FULL';

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [statusId, setStatusId] = useState<number | undefined>();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const { data: assetsData, isLoading } = useAssets({
    categoryId,
    statusId,
    location: search || undefined,
    isActive: showInactive ? undefined : true,
    page,
    limit,
  });
  const { data: categories } = useAssetCategories();
  const { data: statuses } = useAssetStatuses();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [statusModalId, setStatusModalId] = useState<number | null>(null);
  const [bajaModalId, setBajaModalId] = useState<number | null>(null);

  const openCreate = () => { setEditingId(null); setFormOpen(true); };
  const openEdit = (id: number) => { setEditingId(id); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const activeCategories = categories?.filter((c) => c.isActive) ?? [];
  const activeStatuses = statuses ?? [];
  const totalPages = Math.ceil((assetsData?.total ?? 0) / limit);

  if (!isRead) return null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            value={categoryId ?? ''}
            onChange={(e) => { setCategoryId(e.target.value ? +e.target.value : undefined); setPage(1); }}
            style={{ minWidth: 180 }}
          >
            <option value="">Todas las categorías</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={statusId ?? ''}
            onChange={(e) => { setStatusId(e.target.value ? +e.target.value : undefined); setPage(1); }}
            style={{ minWidth: 160 }}
          >
            <option value="">Todos los estados</option>
            {activeStatuses.filter((s) => s.isActive).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="search-box" style={{ minWidth: '220px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar por ubicación..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <label className="toggle-switch" style={{ marginLeft: 4 }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => { setShowInactive(e.target.checked); setPage(1); }}
            />
            <span className="toggle-switch-track" />
            <span style={{ fontSize: '0.85rem' }}>Dados de baja</span>
          </label>
        </div>
      </div>

      <div className="sales-table-wrapper">
        <div className="sales-table">
          <div className="sales-table-head">
            <span className="col-user" style={{ flex: 1 }}>Nombre</span>
            <span className="col-category" style={{ flex: 1 }}>Categoría</span>
            <span className="col-category" style={{ flex: '0 0 140px' }}>Ubicación</span>
            <span className="col-method" style={{ flex: '0 0 110px' }}>Estado</span>
            <span className="col-date" style={{ flex: '0 0 110px' }}>Fecha alta</span>
            <span className="col-action" style={{ flex: '0 0 100px', textAlign: 'right' }}>Acciones</span>
          </div>

          {isLoading && (
            <div className="sales-table-row">
              <span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Cargando...</span>
            </div>
          )}
          {!isLoading && (!assetsData?.data || assetsData.data.length === 0) && (
            <div className="sales-table-row">
              <span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No se encontraron bienes</span>
            </div>
          )}
          {assetsData?.data.map((asset) => (
            <div key={asset.id} className="sales-table-row" style={!asset.isActive ? { opacity: 0.5 } : undefined}>
              <span className="col-user" style={{ flex: 1, fontWeight: 500 }}>{asset.name}</span>
              <span className="col-category" style={{ flex: 1, color: 'var(--color-text-secondary)' }}>{asset.category?.name ?? '-'}</span>
              <span className="col-category" style={{ flex: '0 0 140px' }}>{asset.location ?? '-'}</span>
              <span className="col-method" style={{ flex: '0 0 110px' }}>
                <AssetStatusBadge name={asset.status?.name ?? ''} />
              </span>
              <span className="col-date" style={{ flex: '0 0 110px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                {asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString('es-AR') : new Date(asset.createdAt).toLocaleDateString('es-AR')}
              </span>
              <span className="col-action" style={{ flex: '0 0 100px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                <button className="btn-ghost" onClick={() => setDetailId(asset.id)} title="Ver detalle" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}>
                  <Search size={14} />
                </button>
                {isFull && asset.isActive && (
                  <>
                    <button className="btn-ghost" onClick={() => openEdit(asset.id)} title="Editar" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost" onClick={() => setStatusModalId(asset.id)} title="Cambiar estado" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}>
                      <RotateCcw size={14} />
                    </button>
                    <button className="btn-ghost" onClick={() => setBajaModalId(asset.id)} title="Dar de baja" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
        <span>Mostrando {assetsData?.data?.length ?? 0} de {assetsData?.total ?? 0}</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select value={limit} onChange={(e) => { setLimit(+e.target.value); setPage(1); }}
            style={{ padding: '0.3rem 0.5rem', borderRadius: '0.4rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.8rem' }}>
            {LIMITS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}
            style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>Anterior</button>
          <span>Pág {page} de {totalPages || 1}</span>
          <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>Siguiente</button>
        </div>
      </div>

      {isFull && (
        <button type="button" className="fab-button-v2" onClick={openCreate} aria-label="Nuevo bien" title="Nuevo bien">
          <Plus size={24} />
        </button>
      )}

      {formOpen && <AssetForm editingId={editingId} onClose={closeForm} />}
      {detailId !== null && <AssetDetail assetId={detailId} onClose={() => setDetailId(null)} />}
      {statusModalId !== null && <ChangeStatusModal assetId={statusModalId} onClose={() => setStatusModalId(null)} />}
      {bajaModalId !== null && <BajaConfirmModal assetId={bajaModalId} onClose={() => setBajaModalId(null)} />}
    </>
  );
};
