import express from 'express';
import {
  getExamCatalog,
  getExamDaily,
  getExamTest,
  postExamSubmit,
} from '../controllers/examQuizController.js';

const router = express.Router();

router.get('/catalog', getExamCatalog);
router.get('/:slug/daily', getExamDaily);
router.get('/:slug/test', getExamTest);
router.post('/:slug/submit', postExamSubmit);

export default router;
