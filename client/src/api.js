import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15000,
});

let refreshPromise = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then((res) => res.data)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retried && !original.url.includes('/auth/')) {
      original._retried = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }
    return Promise.reject(error);
  }
);

export function errorMessage(err) {
  return err?.response?.data?.error || err?.message || 'Something went wrong.';
}
