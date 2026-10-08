import api from './client.js';

export const aiApi = {
  generateQuiz: async (params) => {
    const res = await api.post('/api/ai/generate-quiz', params);
    return res.data;
  },
  extractPdf: async (formData, onUploadProgress) => {
    const res = await api.post('/api/ai/extract-pdf', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    });
    return res.data;
  }
};
