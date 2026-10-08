import api from './client.js';
import { downloadAuthenticatedBlob } from '../utils/downloadHelper.js';

export const quizApi = {
  list: async (params = {}) => {
    const res = await api.get('/api/quizzes', { params });
    return res.data;
  },
  get: async (id) => {
    const res = await api.get(`/api/quizzes/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/api/quizzes', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.put(`/api/quizzes/${id}`, data);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/api/quizzes/${id}`);
    return res.data;
  },
  duplicate: async (id) => {
    const res = await api.post(`/api/quizzes/${id}/duplicate`);
    return res.data;
  },
  downloadPdf: async (id, { variant = 'questions', explanations = true } = {}) => {
    return downloadAuthenticatedBlob({
      url: `/api/quizzes/${id}/export.pdf?variant=${variant}&explanations=${explanations ? '1' : '0'}`,
      defaultFilename: `quiz-${variant}.pdf`
    });
  }
};
