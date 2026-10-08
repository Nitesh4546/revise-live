import mongoose from 'mongoose';
import { Quiz } from '../models/Quiz.js';
import { generateQuizPdf, sanitizePdfFilename } from '../services/pdfService.js';

export async function listQuizzes(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { createdBy: req.user._id };
    const [quizzes, total] = await Promise.all([
      Quiz.find(filter)
        .select('-sourceMaterial')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Quiz.countDocuments(filter)
    ]);

    res.status(200).json({
      quizzes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getQuiz(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid quiz ID format'
        }
      });
    }

    const quiz = await Quiz.findOne({ _id: id, createdBy: req.user._id });
    if (!quiz) {
      return res.status(404).json({
        error: {
          code: 'QUIZ_NOT_FOUND',
          message: 'Quiz not found or you do not have permission to access it'
        }
      });
    }

    res.status(200).json({ quiz });
  } catch (err) {
    next(err);
  }
}

export async function createQuiz(req, res, next) {
  try {
    const quizData = {
      ...req.body,
      createdBy: req.user._id
    };

    const quiz = await Quiz.create(quizData);
    res.status(201).json({ quiz });
  } catch (err) {
    next(err);
  }
}

export async function updateQuiz(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid quiz ID format'
        }
      });
    }

    const quiz = await Quiz.findOne({ _id: id, createdBy: req.user._id });
    if (!quiz) {
      return res.status(404).json({
        error: {
          code: 'QUIZ_NOT_FOUND',
          message: 'Quiz not found or you do not have permission to modify it'
        }
      });
    }

    Object.assign(quiz, req.body);
    await quiz.save();

    res.status(200).json({ quiz });
  } catch (err) {
    next(err);
  }
}

export async function deleteQuiz(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid quiz ID format'
        }
      });
    }

    const quiz = await Quiz.findOneAndDelete({ _id: id, createdBy: req.user._id });
    if (!quiz) {
      return res.status(404).json({
        error: {
          code: 'QUIZ_NOT_FOUND',
          message: 'Quiz not found or you do not have permission to delete it'
        }
      });
    }

    res.status(200).json({ success: true, message: 'Quiz deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function duplicateQuiz(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid quiz ID format'
        }
      });
    }

    const original = await Quiz.findOne({ _id: id, createdBy: req.user._id });
    if (!original) {
      return res.status(404).json({
        error: {
          code: 'QUIZ_NOT_FOUND',
          message: 'Quiz not found or you do not have permission to duplicate it'
        }
      });
    }

    const duplicatedData = {
      title: `${original.title} (Copy)`.slice(0, 100),
      topic: original.topic,
      description: original.description,
      sourceMaterial: original.sourceMaterial,
      difficulty: original.difficulty,
      questions: original.questions.map((q) => ({
        questionText: q.questionText,
        options: [...q.options],
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        topicTag: q.topicTag,
        timeLimit: q.timeLimit
      })),
      createdBy: req.user._id
    };

    const duplicate = await Quiz.create(duplicatedData);
    res.status(201).json({ quiz: duplicate });
  } catch (err) {
    next(err);
  }
}

export async function exportQuizPdf(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: {
          code: 'QUIZ_NOT_FOUND',
          message: 'Quiz not found or you do not have permission to access it'
        }
      });
    }

    const quiz = await Quiz.findOne({ _id: id, createdBy: req.user._id });
    if (!quiz) {
      return res.status(404).json({
        error: {
          code: 'QUIZ_NOT_FOUND',
          message: 'Quiz not found or you do not have permission to access it'
        }
      });
    }

    const variant = req.query.variant === 'answers' ? 'answers' : 'questions';
    const explanations = req.query.explanations !== '0';
    const filename = sanitizePdfFilename(quiz.title, variant);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    const pdfStream = generateQuizPdf(quiz, { variant, explanations });
    pdfStream.on('error', (streamErr) => {
      if (!res.headersSent) {
        next(streamErr);
      }
    });
    pdfStream.pipe(res);
  } catch (err) {
    next(err);
  }
}

