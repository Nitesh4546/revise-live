import mongoose from 'mongoose';
import { GameSession } from '../models/GameSession.js';
import { generateSessionCsv } from '../services/csvService.js';
import { generateSessionPdf, sanitizePdfFilename } from '../services/pdfService.js';

export async function listSessions(req, res, next) {
  try {
    const hostQuery = { $in: [req.user._id, req.user._id.toString()] };
    const sessions = await GameSession.find({ hostId: hostQuery })
      .select('quizTitle pin startedAt endedAt playerCount blindspotReport.overallAccuracy')
      .sort({ endedAt: -1 })
      .lean();

    res.status(200).json({ sessions });
  } catch (err) {
    next(err);
  }
}

export async function getSession(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid session ID format'
        }
      });
    }

    const hostQuery = { $in: [req.user._id, req.user._id.toString()] };
    const session = await GameSession.findOne({ _id: id, hostId: hostQuery }).lean();
    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Game session not found or you do not have permission to view it.'
        }
      });
    }

    res.status(200).json({ session });
  } catch (err) {
    next(err);
  }
}

export async function exportSessionCsv(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid session ID format'
        }
      });
    }

    const hostQuery = { $in: [req.user._id, req.user._id.toString()] };
    const session = await GameSession.findOne({ _id: id, hostId: hostQuery }).lean();
    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Game session not found or you do not have permission to export it.'
        }
      });
    }

    const csvContent = generateSessionCsv(session);
    const filename = `ReviseLive-${session.pin}-${new Date(session.endedAt).toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
}

export async function deleteSession(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid session ID format'
        }
      });
    }

    const hostQuery = { $in: [req.user._id, req.user._id.toString()] };
    const session = await GameSession.findOneAndDelete({ _id: id, hostId: hostQuery });
    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Game session not found or you do not have permission to delete it.'
        }
      });
    }

    res.status(200).json({ ok: true, message: 'Game session deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function exportSessionPdf(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Game session not found or you do not have permission to export it.'
        }
      });
    }

    const hostQuery = { $in: [req.user._id, req.user._id.toString()] };
    const session = await GameSession.findOne({ _id: id, hostId: hostQuery }).lean();
    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Game session not found or you do not have permission to export it.'
        }
      });
    }

    const filename = sanitizePdfFilename(session.quizTitle, 'class-report');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    const pdfStream = generateSessionPdf(session);
    pdfStream.on('error', (err) => {
      if (!res.headersSent) next(err);
    });
    pdfStream.pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function exportStudentSessionPdf(req, res, next) {
  try {
    const { id, playerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Game session not found or you do not have permission to access it.'
        }
      });
    }

    const hostQuery = { $in: [req.user._id, req.user._id.toString()] };
    const session = await GameSession.findOne({ _id: id, hostId: hostQuery }).lean();
    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Game session not found or you do not have permission to access it.'
        }
      });
    }

    const player = (session.players || []).find((p) => p.playerId === playerId);
    if (!player) {
      return res.status(404).json({
        error: {
          code: 'STUDENT_NOT_FOUND',
          message: 'Student not found in this game session.'
        }
      });
    }

    const filename = sanitizePdfFilename(`${session.quizTitle}-${player.name}`, 'student-report');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    const pdfStream = generateSessionPdf(session, { targetPlayerId: playerId });
    pdfStream.on('error', (err) => {
      if (!res.headersSent) next(err);
    });
    pdfStream.pipe(res);
  } catch (err) {
    next(err);
  }
}

