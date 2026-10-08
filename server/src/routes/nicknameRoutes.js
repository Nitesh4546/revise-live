import express from 'express';
import { generateFriendlyNickname } from '../utils/nicknames.js';

const router = express.Router();

router.get('/random', (req, res) => {
  const nickname = generateFriendlyNickname();
  res.json({ ok: true, nickname });
});

export default router;
