import api from './client.js';
import { downloadAuthenticatedBlob } from '../utils/downloadHelper.js';

export const sessionApi = {
  list: async () => {
    const res = await api.get('/api/sessions');
    return res.data;
  },
  get: async (id) => {
    const res = await api.get(`/api/sessions/${id}`);
    return res.data;
  },
  downloadClassPdf: async (sessionId) => {
    return downloadAuthenticatedBlob({
      url: `/api/sessions/${sessionId}/export.pdf`,
      defaultFilename: `session-${sessionId}-class-report.pdf`
    });
  },
  downloadStudentPdf: async (sessionId, playerId, playerName = 'student') => {
    return downloadAuthenticatedBlob({
      url: `/api/sessions/${sessionId}/students/${playerId}/export.pdf`,
      defaultFilename: `student-${playerName}-report.pdf`
    });
  },
  downloadCsv: async (sessionId) => {
    return downloadAuthenticatedBlob({
      url: `/api/sessions/${sessionId}/export.csv`,
      defaultFilename: `session-${sessionId}.csv`
    });
  }
};
