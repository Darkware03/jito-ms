import express from 'express';
import {
    trendingTopicsController,
    trendDetailsController,
    trendAndTrenDetrailAndDataToken
} from '../controllers/twitter.controller.js';

const router = express.Router();

router.get('/trending', trendingTopicsController); // ?woeid=23424807
router.get('/trending-detail', trendDetailsController); // ?woeid=23424807
router.get('/generateAll', trendAndTrenDetrailAndDataToken); // ?woeid=23424807

export default router;
