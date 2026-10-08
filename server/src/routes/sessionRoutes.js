import { Router } from 'express';
import {
  listSessions,
  getSession,
  exportSessionCsv,
  exportSessionPdf,
  exportStudentSessionPdf,
  deleteSession
} from '../controllers/sessionController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listSessions);
router.get('/:id/export.csv', exportSessionCsv);
router.get('/:id/export.pdf', exportSessionPdf);
router.get('/:id/students/:playerId/export.pdf', exportStudentSessionPdf);
router.get('/:id', getSession);
router.delete('/:id', deleteSession);

export default router;
