import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

// Request interceptor: attach token + company header
api.interceptors.request.use((config) => {
  const token     = localStorage.getItem('token');
  const companyId = localStorage.getItem('company_id');

  if (token)     config.headers.Authorization = `Bearer ${token}`;
  if (companyId) config.headers['X-Company-ID'] = companyId;

  return config;
});

// Response interceptor: handle 401 (token expired)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && err.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`,
          { refresh_token: refresh }
        );
        localStorage.setItem('token',         data.token);
        localStorage.setItem('refresh_token', data.refresh_token);
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
