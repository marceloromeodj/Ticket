import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { ArrowLeft, Plus, X, Check, Printer, Wrench, QrCode, Barcode as BarcodeIcon, History, ArrowRight } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { safeFormat as format } from '../../utils/safeDate';
import { clsx } from 'clsx';

function AssetBarcode({ value }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      JsBarcode(canvasRef.current, value, {
        format: 'CODE128',
        width: 2,
        height: 60,
        fontSize: 14,
        margin: 8,
      });
    }
  }, [value]);

  return <canvas ref={canvasRef} />;
}

function PlanModal({ assetId, onClose }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [frequencyDays, setFrequencyDays] = useState(90);
  const [checklist, setChecklist] = useState(['']);

  const mutation = useMutation({
    mutationFn: () => api.post('/maintenance/plans', {
      asset_id: assetId, title, frequency_days: frequencyDays,
      checklist: checklist.filter(Boolean),
    }),
    onSuccess: () => { queryClient.invalidateQueries(['maintenance-plans', assetId]); toast.success('Plan creado'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Nuevo plan de mantenimiento</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="p-6 space-y-4">
          <div>
            <label className="label">Título *</label>
            <input required className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Limpieza y revisión trimestral" />
          </div>
          <div>
            <label className="label">Frecuencia (días)</label>
            <input type="number" min={1} className="input" value={frequencyDays} onChange={e => setFrequencyDays(parseInt(e.target.value) || 90)} />
          </div>
          <div>
            <label className="label">Checklist</label>
            {checklist.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  className="input text-sm"
                  value={item}
                  onChange={e => setChecklist(c => c.map((x, idx) => idx === i ? e.target.value : x))}
                  placeholder={`Ítem ${i + 1}`}
                />
                <button type="button" onClick={() => setChecklist(c => c.filter((_, idx) => idx !== i))} className="btn-ghost p-1.5 text-red-400"><X size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setChecklist(c => [...c, ''])} className="text-xs text-primary-600 hover:underline">+ Agregar ítem</button>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={mutation.isLoading} className="btn-primary">{mutation.isLoading ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompleteModal({ plan, onClose }) {
  const queryClient = useQueryClient();
  const [results, setResults] = useState((plan.checklist || []).map(item => ({ item, checked: false, note: '' })));
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post(`/maintenance/plans/${plan.id}/complete`, { checklist_results: results, notes }),
    onSuccess: () => { queryClient.invalidateQueries(['maintenance-plans']); toast.success('Mantenimiento registrado'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Registrar mantenimiento — {plan.title}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-3">
          {results.map((r, i) => (
            <label key={i} className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded"
                checked={r.checked}
                onChange={e => setResults(rs => rs.map((x, idx) => idx === i ? { ...x, checked: e.target.checked } : x))}
              />
              {r.item}
            </label>
          ))}
          {results.length === 0 && <p className="text-sm text-gray-400">Este plan no tiene checklist, solo se registra la fecha.</p>}
          <textarea className="input text-sm" rows={2} placeholder="Notas (opcional)" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading} className="btn-primary">
            <Check size={14} /> {mutation.isLoading ? 'Guardando...' : 'Confirmar realizado'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MovementHistory({ assetId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['asset-history', assetId],
    queryFn: () => api.get(`/assets/${assetId}/history`).then(r => r.data),
  });

  const events = data?.events || [];

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><History size={16} /> Historial de movimientos</h2>
      {isLoading && <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>}
      {!isLoading && events.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin movimientos registrados todavía</p>}
      <div className="space-y-3">
        {events.map(ev => (
          <div key={ev.id} className="border-l-2 border-primary-100 pl-3 py-0.5">
            <p className="text-xs text-gray-400">
              {format(ev.created_at, "d MMM yyyy HH:mm")} {ev.user_name && `· ${ev.user_name}`}
            </p>
            {ev.type === 'create' ? (
              <p className="text-sm text-gray-700 mt-0.5">Activo dado de alta</p>
            ) : (
              <div className="mt-0.5 space-y-1">
                {ev.changes.map((c, i) => (
                  <p key={i} className="text-sm text-gray-700 flex items-center gap-1.5 flex-wrap">
                    <span className="text-gray-500">{c.label}:</span>
                    <span>{c.from ?? '—'}</span>
                    <ArrowRight size={11} className="text-gray-300" />
                    <span className="font-medium">{c.to ?? '—'}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [completingPlan, setCompletingPlan] = useState(null);
  const [codeType, setCodeType] = useState('qr'); // qr | barcode

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => api.get(`/assets/${id}`).then(r => r.data),
  });

  const { data: plansData } = useQuery({
    queryKey: ['maintenance-plans', id],
    queryFn: () => api.get('/maintenance/plans', { params: { asset_id: id } }).then(r => r.data),
  });
  const plans = plansData?.plans || [];

  const { data: assetTypes = [] } = useQuery({
    queryKey: ['asset-types', 'all'],
    queryFn: () => api.get('/asset-types', { params: { active: 'all' } }).then(r => r.data?.types || []),
  });
  const typeLabel = (key) => assetTypes.find(t => t.key === key)?.label || key;

  const qrUrl = `${window.location.origin}/assets/${id}`;

  if (isLoading) return <div className="text-center text-gray-400 py-16">Cargando...</div>;
  if (!asset) return <div className="text-center text-gray-500 py-16">Activo no encontrado</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/assets')} className="btn-ghost p-2"><ArrowLeft size={16} /></button>
        <div>
          <p className="text-xs text-gray-400 font-mono">{asset.asset_tag}</p>
          <h1 className="text-2xl font-bold text-gray-900">{asset.name}</h1>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 col-span-2 space-y-3">
          <h2 className="font-semibold text-gray-900">Información</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Tipo</span><p className="font-medium">{typeLabel(asset.type)}</p></div>
            <div><span className="text-gray-500">Estado</span><p className="font-medium capitalize">{asset.status}</p></div>
            <div><span className="text-gray-500">Marca / Modelo</span><p className="font-medium">{asset.brand} {asset.model}</p></div>
            <div><span className="text-gray-500">Nº de serie</span><p className="font-medium">{asset.serial_number || '—'}</p></div>
            <div><span className="text-gray-500">IP / MAC</span><p className="font-medium">{asset.ip_address || '—'} {asset.mac_address ? `/ ${asset.mac_address}` : ''}</p></div>
            <div><span className="text-gray-500">Sucursal</span><p className="font-medium">{asset.branch?.name || '—'}</p></div>
            <div><span className="text-gray-500">Asignado a</span><p className="font-medium">{asset.owner?.name || '—'}</p></div>
            <div><span className="text-gray-500">Ubicación</span><p className="font-medium">{asset.location || '—'}</p></div>
            <div><span className="text-gray-500">Garantía hasta</span><p className="font-medium">{asset.warranty_until ? format(asset.warranty_until, 'd MMM yyyy') : '—'}</p></div>
          </div>
          {asset.notes && <p className="text-sm text-gray-600 border-t border-gray-100 pt-3">{asset.notes}</p>}
        </div>

        <div className="card p-5 flex flex-col items-center text-center">
          <div className="flex items-center justify-between w-full mb-3">
            <h2 className="font-semibold text-gray-900">{codeType === 'qr' ? 'Código QR' : 'Código de barras'}</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setCodeType('qr')}
                className={clsx('p-1.5 rounded-lg', codeType === 'qr' ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:bg-gray-50')}
                title="Código QR"
              >
                <QrCode size={14} />
              </button>
              <button
                onClick={() => setCodeType('barcode')}
                className={clsx('p-1.5 rounded-lg', codeType === 'barcode' ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:bg-gray-50')}
                title="Código de barras"
              >
                <BarcodeIcon size={14} />
              </button>
            </div>
          </div>
          <div className="print-area flex flex-col items-center">
            <div className="bg-white p-3 border border-gray-100 rounded-lg print:border-0">
              {codeType === 'qr' ? <QRCodeSVG value={qrUrl} size={140} /> : <AssetBarcode value={asset.asset_tag} />}
            </div>
            {codeType === 'qr' && <p className="text-xs text-gray-400 mt-2 break-all">{qrUrl}</p>}
          </div>
          <button onClick={() => window.print()} className="btn-ghost h-8 text-xs mt-3">
            <Printer size={12} /> {codeType === 'qr' ? 'Imprimir para pegar en el equipo' : 'Imprimir código de barras'}
          </button>
        </div>
      </div>

      {/* Mantenimiento preventivo */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Wrench size={16} /> Mantenimiento preventivo</h2>
          <button onClick={() => setShowPlanModal(true)} className="btn-ghost h-8 text-xs"><Plus size={12} /> Nuevo plan</button>
        </div>
        {plans.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Sin planes de mantenimiento configurados</p>}
        <div className="space-y-3">
          {plans.map(plan => {
            const overdue = plan.next_due_at && new Date(plan.next_due_at) < new Date();
            return (
              <div key={plan.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{plan.title}</p>
                  <p className={clsx('text-xs mt-0.5', overdue ? 'text-red-600 font-medium' : 'text-gray-500')}>
                    Próximo: {plan.next_due_at ? format(plan.next_due_at, "d MMM yyyy") : '—'} {overdue && '(vencido)'}
                    {plan.last_done_at && ` · Último: ${format(plan.last_done_at, 'd MMM yyyy')}`}
                  </p>
                </div>
                <button onClick={() => setCompletingPlan(plan)} className="btn-primary h-8 text-xs">
                  <Check size={12} /> Registrar realizado
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tickets relacionados */}
      {asset.tickets?.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Tickets relacionados</h2>
          <div className="space-y-2">
            {asset.tickets.map(t => (
              <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm">
                <span>#{t.ticket_number} — {t.subject}</span>
                <span className="badge badge-pending text-xs">{t.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <MovementHistory assetId={id} />

      {showPlanModal && <PlanModal assetId={id} onClose={() => setShowPlanModal(false)} />}
      {completingPlan && <CompleteModal plan={completingPlan} onClose={() => setCompletingPlan(null)} />}
    </div>
  );
}
