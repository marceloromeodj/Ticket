import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Ticket, ShieldCheck } from 'lucide-react';
import api from '../api/axios';

// Carga el script de Google Identity Services una sola vez (bajo demanda,
// solo si el backend tiene GOOGLE_CLIENT_ID configurado).
function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.getElementById('google-identity-script');
    if (existing) { existing.addEventListener('load', resolve); return; }
    const script = document.createElement('script');
    script.id = 'google-identity-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function Login() {
  const { login, verifyMfa, loginWithSso, token } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState(null);
  const [sso, setSso] = useState({ google: false, microsoft: false });
  const [mfaToken, setMfaToken] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const googleBtnRef = useRef(null);

  // Si se entra por el subdominio de una empresa (empresa1.dominio.com),
  // el backend la resuelve por el Host de la petición y acá se muestra su
  // nombre/logo en vez del branding genérico.
  useEffect(() => {
    api.get('/companies/resolve')
      .then(({ data }) => setCompany(data?.company || null))
      .catch(() => setCompany(null));
    api.get('/auth/sso/config')
      .then(({ data }) => setSso(data))
      .catch(() => {});
  }, []);

  // Respuesta del login redirigido de Microsoft: vuelve a esta misma
  // página (redirect_uri = /login) con el id_token en el fragmento (#) de
  // la URL, nunca en query string, para que no quede en logs/historial.
  useEffect(() => {
    if (!window.location.hash.includes('id_token')) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const idToken = params.get('id_token');
    if (!idToken) return;
    window.history.replaceState(null, '', window.location.pathname);
    handleSso('microsoft', idToken);
  }, []);

  useEffect(() => {
    if (!sso.google || !sso.google_client_id || mfaToken) return;
    loadGoogleScript().then(() => {
      window.google.accounts.id.initialize({
        client_id: sso.google_client_id,
        callback: (response) => handleSso('google', response.credential),
      });
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, { theme: 'outline', size: 'large', width: 320 });
      }
    }).catch(() => {});
  }, [sso, mfaToken]);

  if (token) return <Navigate to="/" replace />;

  const handleSso = async (provider, id_token) => {
    setError('');
    setLoading(true);
    const result = await loginWithSso(provider, id_token);
    setLoading(false);
    if (!result.ok) return setError(result.error);
    if (result.mfa_required) return setMfaToken(result.mfa_token);
    navigate('/');
  };

  const handleMicrosoftLogin = () => {
    const redirectUri = `${window.location.origin}/login`;
    const nonce = Math.random().toString(36).slice(2);
    const url = new URL(`https://login.microsoftonline.com/${sso.azure_tenant_id}/oauth2/v2.0/authorize`);
    url.searchParams.set('client_id', sso.azure_client_id);
    url.searchParams.set('response_type', 'id_token');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('response_mode', 'fragment');
    url.searchParams.set('nonce', nonce);
    window.location.href = url.toString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(form.email, form.password);
    setLoading(false);
    if (!result.ok) return setError(result.error);
    if (result.mfa_required) return setMfaToken(result.mfa_token);
    navigate('/');
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await verifyMfa(mfaToken, mfaCode);
    setLoading(false);
    if (result.ok) navigate('/');
    else setError(result.error);
  };

  if (mfaToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4">
              <ShieldCheck size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Verificación en dos pasos</h1>
            <p className="text-primary-200 mt-1 text-sm">Ingresá el código de tu app de autenticación</p>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
            )}
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label className="label">Código de 6 dígitos</label>
                <input
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="input text-center text-xl tracking-[0.5em]"
                  placeholder="000000"
                />
              </div>
              <button type="submit" disabled={loading || mfaCode.length !== 6} className="btn-primary w-full justify-center py-2.5 text-base">
                {loading ? 'Verificando...' : 'Verificar'}
              </button>
              <button type="button" onClick={() => { setMfaToken(null); setMfaCode(''); }} className="text-sm text-gray-500 hover:underline w-full text-center">
                Volver
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4 overflow-hidden">
            {company?.logo_url
              ? <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain p-2" />
              : <Ticket size={32} className="text-white" />}
          </div>
          <h1 className="text-3xl font-bold text-white">{company?.name || 'HelpDesk'}</h1>
          <p className="text-primary-200 mt-1">{company ? 'Portal de soporte' : 'Sistema de Tickets Multi-Empresa'}</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Iniciar sesión</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="input"
                placeholder="usuario@empresa.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 text-base mt-2"
              style={company?.primary_color ? { backgroundColor: company.primary_color } : undefined}
            >
              {loading ? 'Iniciando sesión...' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="/forgot-password" className="text-sm text-primary-600 hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          {(sso.google || sso.microsoft) && (
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
              {sso.google && (
                <div className="flex justify-center" ref={googleBtnRef} />
              )}
              {sso.microsoft && (
                <button type="button" onClick={handleMicrosoftLogin} className="btn-ghost w-full justify-center py-2.5">
                  Iniciar sesión con Microsoft
                </button>
              )}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">Portal de clientes:</p>
            <a href="/portal" className="text-xs text-primary-600 hover:underline">
              Consultar estado de mi ticket →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
