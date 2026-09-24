import express from 'express';
import { shareNewsArticle, shareNewsMeta } from '../controllers/shareController.js';

const router = express.Router();

router.get('/news/:slug', shareNewsArticle);
router.get('/news/:slug/meta', shareNewsMeta);

export default router;
