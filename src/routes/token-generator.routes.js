import { Router } from 'express';
import { postGenerarToken } from '../controllers/token-generator.controller.js';

const router = Router();

router.post('/generate-token', postGenerarToken);

export default router;
