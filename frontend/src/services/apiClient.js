import axios from 'axios';

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BACKEND_URL + '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Keep a copy of the token in memory so we don't read localStorage every time
let _cachedToken = localStorage.getItem('accessToken');

export const setApiToken = (token) => {
  _cachedToken = token;
  api.defaults.headers.common['Authorization'] = token ? `Bearer ${token}` : undefined;
};

export const clearApiToken = () => {
  _cachedToken = null;
  delete api.defaults.headers.common['Authorization'];
};

// Set the auth header right away if we already have a token
if (_cachedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${_cachedToken}`;
}

api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const refreshResponse = await axios.post(
          BACKEND_URL + '/api/v1/auth/refresh',
          { refreshToken }
        );

        const { accessToken } = refreshResponse.data.data;
        localStorage.setItem('accessToken', accessToken);
        setApiToken(accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        // Refresh failed, so log the user out
        clearApiToken();
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        // Tell the app to clear state and go to the login page
        window.dispatchEvent(new Event('auth_session_expired'));
        
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 423) {
      // Account needs a temporary password change before continuing
      window.dispatchEvent(new Event('password_change_required'));
    }

    return Promise.reject(error);
  }
);

export default api;
