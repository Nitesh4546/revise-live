import api from './client.js';

export const authApi = {
  register: async (data) => {
    const res = await api.post('/api/auth/register', data);
    return res.data;
  },
  login: async (data) => {
    const res = await api.post('/api/auth/login', data);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/api/auth/me');
    return res.data;
  },
  updatePreferences: async (preferences) => {
    const res = await api.patch('/api/auth/preferences', preferences);
    return res.data;
  }
};
