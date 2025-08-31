import { Router } from "express";
import {
    sellBundle,createTokenController
} from "../controllers/pump.controller.js";
import multer from 'multer';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});
// Test endpoint
router.post('/sell', sellBundle);
router.post("/createToken", upload.single("image"), createTokenController);


export default router;
