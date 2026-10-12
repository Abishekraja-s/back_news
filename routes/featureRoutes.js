import express from 'express';
import {
  getHub,
  getFeatureByKey,
  getLiveWeather,
  getLiveGoldPrice,
  getLiveCurrency,
  getLiveMarket,
  getLiveTraffic,
  getLiveLocalUpdates,
  getLiveTodayInHistory,
  getLiveStockWatchlist,
  getLiveTrending,
  getLiveCommunityFeed,
  getLiveFuel,
  getDistrictsFuel,
  getDistrictFuel,
  getDistrictsWeather,
  getDistrictWeather,
  getAllFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
  syncDefaults,
} from '../controllers/featureController.js';
import {
  getItems,
  createItem,
  updateItem,
  deleteItem,
} from '../controllers/featureItemController.js';
import {
  getNewsQuizInfo,
  getNewsQuizDaily,
  postNewsQuizSubmit,
} from '../controllers/newsQuizController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR];

// Public
router.get('/hub', getHub);
router.get('/weather/live', getLiveWeather);
router.get('/gold/live', getLiveGoldPrice);
router.get('/currency/live', getLiveCurrency);
router.get('/market/live', getLiveMarket);
router.get('/traffic/live', getLiveTraffic);
router.get('/local-updates/live', getLiveLocalUpdates);
router.get('/today-in-history/live', getLiveTodayInHistory);
router.get('/stocks/live', getLiveStockWatchlist);
router.get('/trending/live', getLiveTrending);
router.get('/community/live', getLiveCommunityFeed);
router.get('/news-quiz', getNewsQuizInfo);
router.get('/news-quiz/daily', getNewsQuizDaily);
router.post('/news-quiz/submit', postNewsQuizSubmit);
router.get('/fuel/live', getLiveFuel);
router.get('/fuel/districts', getDistrictsFuel);
router.get('/fuel/districts/:district', getDistrictFuel);
router.get('/weather/districts', getDistrictsWeather);
router.get('/weather/districts/:district', getDistrictWeather);
router.get('/key/:key', getFeatureByKey);

// Items (before /:id)
router.get('/items', protect, authorize(...managers), getItems);
router.post('/items', protect, authorize(...managers), createItem);
router.put('/items/:id', protect, authorize(...managers), updateItem);
router.delete('/items/:id', protect, authorize(...managers), deleteItem);

// Feature registry admin
router.get('/', protect, authorize(...managers), getAllFeatures);
router.post('/sync', protect, authorize(ROLES.SUPER_ADMIN), syncDefaults);
router.post('/', protect, authorize(...managers), createFeature);
router.put('/:id', protect, authorize(...managers), updateFeature);
router.delete('/:id', protect, authorize(ROLES.SUPER_ADMIN), deleteFeature);

export default router;
