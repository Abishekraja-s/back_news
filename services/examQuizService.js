/**
 * Daily Tamil exam quizzes — deterministic rotation by IST date + exam slug.
 */

import { EXAM_CATEGORIES, ALL_EXAMS, findExam, DAILY_QUIZ_SIZE, FULL_TEST_SIZE, MARKS_PER_QUESTION } from '../config/examCatalog.js';
import { EXAM_QUESTIONS } from '../config/examQuestionsTamil.js';

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

const pickQuestions = (exam, size, salt) => {
  const pool = EXAM_QUESTIONS.filter((q) => q.topics.some((t) => exam.topics.includes(t)));
  const source = pool.length ? pool : EXAM_QUESTIONS;
  const seed = hash(`${salt}|${exam.slug}|${size}`);
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
      // answer hidden until submit — sent as opaque token for verify
    };
  });
};

const publicExam = (e) => ({
  slug: e.slug,
  name: e.name,
  nameTamil: e.nameTamil,
  category: e.category,
  categoryName: e.categoryName,
  categoryNameTamil: e.categoryNameTamil,
  color: e.color,
  topics: e.topics,
});

export const listExamCatalog = () => {
  const dateKey = istDateKey();
  return {
    dateKey,
    language: 'ta',
    dailySize: DAILY_QUIZ_SIZE,
    testSize: FULL_TEST_SIZE,
    marksPerQuestion: MARKS_PER_QUESTION,
    categories: EXAM_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      nameTamil: c.nameTamil,
      color: c.color,
      exams: c.exams.map((e) => publicExam({ ...e, category: c.id, categoryName: c.name, categoryNameTamil: c.nameTamil, color: c.color })),
    })),
    totalExams: ALL_EXAMS.length,
    totalQuestions: EXAM_QUESTIONS.length,
    note: 'தினசரி தானியங்கி புதுப்பிப்பு · தமிழ் கேள்விகள்',
    updatedAt: new Date().toISOString(),
  };
};

export const getDailyQuiz = (slug) => {
  const exam = findExam(slug);
  if (!exam) throw Object.assign(new Error('Exam not found'), { status: 404 });
  const dateKey = istDateKey();
  const questions = pickQuestions(exam, DAILY_QUIZ_SIZE, `daily|${dateKey}`);
  return {
    mode: 'daily',
    dateKey,
    exam: publicExam(exam),
    questions,
    total: questions.length,
    marksPerQuestion: MARKS_PER_QUESTION,
    totalMarks: questions.length * MARKS_PER_QUESTION,
    note: 'இன்றைய தினசரி வினாடி வினா · ஒவ்வொரு நாளும் புதிய கேள்விகள்',
    updatedAt: new Date().toISOString(),
  };
};

export const getFullTest = (slug) => {
  const exam = findExam(slug);
  if (!exam) throw Object.assign(new Error('Exam not found'), { status: 404 });
  const dateKey = istDateKey();
  const questions = pickQuestions(exam, FULL_TEST_SIZE, `test|${dateKey}`);
  return {
    mode: 'test',
    dateKey,
    exam: publicExam(exam),
    questions,
    total: questions.length,
    marksPerQuestion: MARKS_PER_QUESTION,
    totalMarks: questions.length * MARKS_PER_QUESTION,
    durationMinutes: 15,
    note: 'முழு சோதனை · மதிப்பெண் தானாக கணக்கிடப்படும்',
    updatedAt: new Date().toISOString(),
  };
};

export const submitExamAnswers = (slug, mode, answers = []) => {
  const exam = findExam(slug);
  if (!exam) throw Object.assign(new Error('Exam not found'), { status: 404 });
  const dateKey = istDateKey();
  const size = mode === 'test' ? FULL_TEST_SIZE : DAILY_QUIZ_SIZE;
  const salt = mode === 'test' ? `test|${dateKey}` : `daily|${dateKey}`;
  const selected = pickQuestions(exam, size, salt);
  const byId = new Map(EXAM_QUESTIONS.map((q) => [q.id, q]));

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
  const score = correct * MARKS_PER_QUESTION;
  const totalMarks = total * MARKS_PER_QUESTION;
  const percent = total ? Math.round((correct / total) * 100) : 0;

  return {
    exam: publicExam(exam),
    mode,
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
        ? 'சிறப்பு! நீங்கள் நன்றாக செய்துள்ளீர்கள்.'
        : percent >= 60
          ? 'நல்ல முயற்சி! இன்னும் பயிற்சி செய்யுங்கள்.'
          : 'தொடர்ந்து பயிற்சி செய்யுங்கள். வெற்றி உங்களுடையது!',
    updatedAt: new Date().toISOString(),
  };
};

export default { listExamCatalog, getDailyQuiz, getFullTest, submitExamAnswers };
