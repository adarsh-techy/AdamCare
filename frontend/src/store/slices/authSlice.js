import { createSlice } from '@reduxjs/toolkit';
import api, { setApiToken, clearApiToken } from '../../services/apiClient';

// Load the saved user right away so the app doesn't flash a logged-out state on refresh
const readStoredUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
};

const initialState = {
  user: readStoredUser(),
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  loading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.loading = false;
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
    loginFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    logoutSuccess: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.loading = false;
      state.error = null;
    },
    requirePasswordChange: (state) => {
      // Mark that the user must change their password before continuing
      if (state.user) {
        state.user = { ...state.user, mustChangePassword: true };
      }
    },
    updateUserProfile: (state, action) => {
      // Update the saved user profile with the new changes
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    }
  }
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logoutSuccess,
  requirePasswordChange,
  updateUserProfile
} = authSlice.actions;

export const loginUser = (credentials) => async (dispatch) => {
  try {
    dispatch(loginStart());
    const response = await api.post('/auth/login', credentials);
    const { user, accessToken, refreshToken } = response.data.data;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));

    // Make sure future requests use the new login token
    setApiToken(accessToken);

    dispatch(loginSuccess({ user, accessToken, refreshToken }));
    return { success: true, user };
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Login failed. Please try again.';
    dispatch(loginFailure(errorMsg));
    return { success: false, error: errorMsg };
  }
};

export const logoutUser = () => async (dispatch, getState) => {
  const { auth } = getState();
  const token = auth.refreshToken || localStorage.getItem('refreshToken');
  
  try {
    if (token) {
      await api.post('/auth/logout', { refreshToken: token });
    }
  } catch (err) {
    console.error('Logout error on server:', err.message);
  } finally {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    clearApiToken();

    dispatch(logoutSuccess());
  }
};

export const initializeAuth = () => (dispatch) => {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  const userStr = localStorage.getItem('user');

  if (accessToken && refreshToken && userStr) {
    try {
      const user = JSON.parse(userStr);
      dispatch(loginSuccess({ user, accessToken, refreshToken }));
    } catch (e) {
      console.error('Error parsing stored user data:', e);
    }
  }
};

export default authSlice.reducer;
