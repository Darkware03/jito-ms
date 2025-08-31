// gmgn.routes.js
import { Router } from 'express';
import {getMemeParam, createToken} from '../controllers/gmgn.controller.js'
const r = Router();

// POST /api/meme-param
r.post("/meme-param", getMemeParam);
r.post("/meme-param-auto-gen", createToken);

export default r;
