/**
 * News Quiz Challenge — daily Tamil MCQ rotation (IST).
 */

import {
  NEWS_QUIZ_QUESTIONS,
  NEWS_QUIZ_DAILY_SIZE,
  NEWS_QUIZ_MARKS,
} from '../config/newsQuizQuestions.js';

const istDateKey = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const hash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const pickQuestions = (size, salt) => {
  const source = NEWS_QUIZ_QUESTIONS;
  const seed = hash(`${salt}|news-quiz|${size}`);
  const idxs = [];
  let x = seed;
  while (idxs.length < Math.min(size, source.length)) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    const i = x % source.length;
    if (!idxs.includes(i)) idxs.push(i);
  }
  return idxs.map((i, order) => {
    const q = source[i];
    return {
      id: q.id,
      order: order + 1,
      question: q.question,
      options: q.options,
    };
  });
};

export const getNewsQuizMeta = () => {
  const dateKey = istDateKey();
  return {
    dateKey,
    language: 'ta',
    title: 'News Quiz Challenge',
    titleTamil: 'செய்தி வினாடி வினா சவால்',
    tagline: "Test your knowledge on today's news!",
    taglineTamil: 'இன்றைய செய்தி அறிவை சோதிக்கவும்!',
    dailySize: NEWS_QUIZ_DAILY_SIZE,
    marksPerQuestion: NEWS_QUIZ_MARKS,
    totalQuestions: NEWS_QUIZ_QUESTIONS.length,
    note: 'தினசரி தானியங்கி புதுப்பிப்பு · ஒவ்வொரு நாளும் புதிய கேள்விகள்',
    updatedAt: new Date().toISOString(),
  };
};

export const getDailyNewsQuiz = () => {
  const dateKey = istDateKey();
  const questions = pickQuestions(NEWS_QUIZ_DAILY_SIZE, `daily|${dateKey}`);
  return {
    mode: 'daily',
    dateKey,
    language: 'ta',
    title: 'News Quiz Challenge',
    titleTamil: 'செய்தி வினாடி வினா சவால்',
    questions,
    total: questions.length,
    marksPerQuestion: NEWS_QUIZ_MARKS,
    totalMarks: questions.length * NEWS_QUIZ_MARKS,
    note: 'இன்றைய செய்தி வினாடி வினா · தானியங்கி தினசரி புதுப்பிப்பு',
    updatedAt: new Date().toISOString(),
  };
};

export const submitNewsQuiz = (answers = []) => {
  const dateKey = istDateKey();
  const selected = pickQuestions(NEWS_QUIZ_DAILY_SIZE, `daily|${dateKey}`);
  const byId = new Map(NEWS_QUIZ_QUESTIONS.map((q) => [q.id, q]));

  let correct = 0;
  const review = selected.map((sq) => {
    const full = byId.get(sq.id);
    const given = answers.find((a) => a.id === sq.id);
    const chosen = given?.answerIndex;
    const ok = Number.isInteger(chosen) && chosen === full.answerIndex;
    if (ok) correct += 1;
    return {
      id: sq.id,
      question: full.question,
      options: full.options,
      correctIndex: full.answerIndex,
      chosenIndex: Number.isInteger(chosen) ? chosen : null,
      isCorrect: ok,
      explanation: full.explanation || '',
    };
  });

  const total = selected.length;
  const score = correct * NEWS_QUIZ_MARKS;
  const totalMarks = total * NEWS_QUIZ_MARKS;
  const percent = total ? Math.round((correct / total) * 100) : 0;

  return {
    mode: 'daily',
    dateKey,
    correct,
    wrong: total - correct,
    unanswered: review.filter((r) => r.chosenIndex == null).length,
    score,
    totalMarks,
    percent,
    grade: percent >= 80 ? 'A' : percent >= 60 ? 'B' : percent >= 40 ? 'C' : 'D',
    review,
    message:
      percent >= 80
        ? 'சிறப்பு! இன்றைய செய்தி அறிவு சிறப்பாக உள்ளது.'
        : percent >= 60
          ? 'நல்ல முயற்சி! நாளை மீண்டும் முயற்சிக்கவும்.'
          : 'தொடர்ந்து படியுங்கள். நாளை புதிய கேள்விகள் வரும்!',
    updatedAt: new Date().toISOString(),
  };
};

export default { getNewsQuizMeta, getDailyNewsQuiz, submitNewsQuiz };
