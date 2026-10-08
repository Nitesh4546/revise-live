import express from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { Class } from '../models/Class.js';
import { GameSession } from '../models/GameSession.js';

const router = express.Router();

const classSchema = z.object({
  name: z.string().trim().min(1).max(60)
});

// List classes for teacher
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const classes = await Class.find({ teacherId: req.user.id }).sort({ name: 1 });
    res.json({ ok: true, data: classes });
  } catch (err) {
    next(err);
  }
});

// Create class
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const parsed = classSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Valid class name required' } });
    }
    const newClass = await Class.create({
      name: parsed.data.name,
      teacherId: req.user.id
    });
    res.status(201).json({ ok: true, data: newClass });
  } catch (err) {
    next(err);
  }
});

// Class topic mastery trends across sessions (D5)
router.get('/:id/trends', authMiddleware, async (req, res, next) => {
  try {
    const classObj = await Class.findOne({ _id: req.params.id, teacherId: req.user.id });
    if (!classObj) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Class not found' } });
    }

    const sessions = await GameSession.find({ classId: classObj._id }).sort({ createdAt: 1 });

    const topicStats = new Map();

    sessions.forEach((s) => {
      (s.blindspotReport?.topics || []).forEach((t) => {
        if (!topicStats.has(t.topicTag)) {
          topicStats.set(t.topicTag, { topicTag: t.topicTag, accuracies: [] });
        }
        topicStats.get(t.topicTag).accuracies.push({
          date: s.endedAt || s.createdAt,
          accuracy: t.accuracy
        });
      });
    });

    const topicTrends = Array.from(topicStats.values()).map((t) => {
      const avg = t.accuracies.reduce((sum, item) => sum + item.accuracy, 0) / (t.accuracies.length || 1);
      return {
        topicTag: t.topicTag,
        averageAccuracy: Number(avg.toFixed(2)),
        sessionsCount: t.accuracies.length,
        history: t.accuracies
      };
    });

    topicTrends.sort((a, b) => a.averageAccuracy - b.averageAccuracy);

    res.json({
      ok: true,
      data: {
        className: classObj.name,
        sessionsCount: sessions.length,
        topicTrends,
        weakestTopics: topicTrends.slice(0, 3)
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
