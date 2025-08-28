import express from 'express';
import { generarTokenHandler } from '../controllers/openai.controller.js';

const router = express.Router();

router.post('/generar-token', generarTokenHandler);

export default router;
