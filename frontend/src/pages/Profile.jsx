import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, ShieldOff, Key, Save } from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

function MfaSection() {
  const { user, updateProfile } = useAuthStore();
  const [step, setStep] = useState('idle'); // idle | setup | disable
  const [otpauthUrl, setOtpauthUrl] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const setupMutation = useMutation({
    mutationFn: () => api.post('/auth/mfa/setup'),
    onSuccess: ({ data }) => { setOtpauthUrl(data.otpauth_url); setSecret(data.secret); setStep('setup'); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const enableMutation = useMutation({
    mutationFn: () => api.post('/auth/mfa/enable', { code }),
    onSuccess: () => {
      toast.success('MFA activado');
      updateProfile({ mfa_enabled: true });
      setStep('idle'); setCode(''); setOtpauthUrl(null);
    },
    onError: e => toast.error(e.response?.data?.error || 'Código incorrecto'),
  });

  const disableMutation = useMutation({
    mutationFn: () => api.post('/auth/mfa/disable', { password }),
    onSuccess: () => {
      toast.success('MFA desactivado');
      updateProfile({ mfa_enabled: false });
      setStep('idle'); setPassword('');
    },
    onError: e => toast.error(e.response?.data?.error || 'Contraseña incorrecta'),
  });

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        {user?.mfa_enabled ? <ShieldCheck size={18} className="text-green-600" /> : <ShieldOff size={18} className="text-gray-400" />}
        <h2 className="font-semibold text-gray-900">Verificación en dos pasos (MFA)</h2>
      </div>
      <p className="text-sm text-gray-500">
        Agrega un código de una app de autenticación (Google Authenticator, Authy, etc.) al iniciar sesión.
      </p>

      {step === 'idle' && (
        user?.mfa_enabled
          ? <button onClick={() => setStep('disable')} className="btn-ghost text-red-600">Desactivar MFA</button>
          : <button onClick={() => setupMutation.mutate()} disabled={setupMutation.isLoading} className="btn-primary">
              {setupMutation.isLoading ? 'Generando...' : 'Activar MFA'}
            </button>
      )}

      {step === 'setup' && otpauthUrl && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Escaneá este código con tu app de autenticación:</p>
          <div className="bg-white p-3 border border-gray-100 rounded-lg w-fit">
            <QRCodeSVG value={otpauthUrl} size={160} />
          </div>
          <p className="text-xs text-gray-400">O ingresá manualmente: <code className="bg-gray-50 px-1 rounded">{secret}</code></p>
          <div className="flex gap-2 items-end">
            <div>
              <label className="label">Código de 6 dígitos</label>
              <input
                inputMode="numeric" maxLength={6} className="input w-32 text-center tracking-widest"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button onClick={() => enableMutation.mutate()} disabled={code.length !== 6 || enableMutation.isLoading} className="btn-primary h-9">
              Confirmar
            </button>
            <button onClick={() => { setStep('idle'); setOtpauthUrl(null); setCode(''); }} className="btn-ghost h-9">Cancelar</button>
          </div>
        </div>
      )}

      {step === 'disable' && (
        <div className="flex gap-2 items-end">
          <div>
            <label className="label">Confirmá tu contraseña</label>
            <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button onClick={() => disableMutation.mutate()} disabled={!password || disableMutation.isLoading} className="btn-primary h-9 bg-red-600 hover:bg-red-700">
            Desactivar
          </button>
          <button onClick={() => { setStep('idle'); setPassword(''); }} className="btn-ghost h-9">Cancelar</button>
        </div>
      )}
    </div>
  );
}

function ChangePasswordSection() {
  const [form, setForm] = useState({ current_password: '', new_password: '' });

  const mutation = useMutation({
    mutationFn: () => api.put('/auth/change-password', form),
    onSuccess: () => { toast.success('Contraseña actualizada'); setForm({ current_password: '', new_password: '' }); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Key size={18} className="text-gray-500" />
        <h2 className="font-semibold text-gray-900">Cambiar contraseña</h2>
      </div>
      <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="space-y-3 max-w-sm">
        <div>
          <label className="label">Contraseña actual</label>
          <input required type="password" className="input" value={form.current_password} onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))} />
        </div>
        <div>
          <label className="label">Nueva contraseña</label>
          <input required minLength={8} type="password" className="input" value={form.new_password} onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))} />
        </div>
        <button type="submit" disabled={mutation.isLoading} className="btn-primary">
          <Save size={14} /> {mutation.isLoading ? 'Guardando...' : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuthStore();
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi cuenta</h1>
        <p className="text-sm text-gray-500">{user?.name} — {user?.email}</p>
      </div>
      <ChangePasswordSection />
      <MfaSection />
    </div>
  );
}
