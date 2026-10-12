import {
  getNewsQuizMeta,
  getDailyNewsQuiz,
  submitNewsQuiz,
} from '../services/newsQuizService.js';

export const getNewsQuizInfo = async (req, res, next) => {
  try {
    res.json({ success: true, data: getNewsQuizMeta() });
  } catch (error) {
    next(error);
  }
};

export const getNewsQuizDaily = async (req, res, next) => {
  try {
    res.json({ success: true, data: getDailyNewsQuiz() });
  } catch (error) {
    next(error);
  }
};

export const postNewsQuizSubmit = async (req, res, next) => {
  try {
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    res.json({ success: true, data: submitNewsQuiz(answers) });
  } catch (error) {
    next(error);
  }
};
