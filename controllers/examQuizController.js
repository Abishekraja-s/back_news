import {
  listExamCatalog,
  getDailyQuiz,
  getFullTest,
  submitExamAnswers,
} from '../services/examQuizService.js';

export const getExamCatalog = async (req, res, next) => {
  try {
    res.json({ success: true, data: listExamCatalog() });
  } catch (error) {
    next(error);
  }
};

export const getExamDaily = async (req, res, next) => {
  try {
    const data = getDailyQuiz(req.params.slug);
    res.json({ success: true, data });
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ success: false, message: 'Exam not found' });
    next(error);
  }
};

export const getExamTest = async (req, res, next) => {
  try {
    const data = getFullTest(req.params.slug);
    res.json({ success: true, data });
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ success: false, message: 'Exam not found' });
    next(error);
  }
};

export const postExamSubmit = async (req, res, next) => {
  try {
    const mode = req.body?.mode === 'test' ? 'test' : 'daily';
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const data = submitExamAnswers(req.params.slug, mode, answers);
    res.json({ success: true, data });
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ success: false, message: 'Exam not found' });
    next(error);
  }
};
