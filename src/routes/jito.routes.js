import { Router } from 'express';
import {
    tipAccounts, buildTransfer, buildTip,
    simulate, send, statusInflight, statusFinal
} from '../controllers/jito.controller.js';
import {
    buildCreateMint,
    buildTransferSpl,
    buildTransferSol
} from "../controllers/spl.controller.js";
import {bundleCreateAndSell} from "../controllers/bundle.controller.js";
import {bundleCreateAndSellMany} from "../controllers/bundle-many.controller.js";
import {bundleSellMany} from "../controllers/sell-many.controller.js";

const r = Router();

// Utilidades Jito
r.get("/tip-accounts", tipAccounts);
r.post("/build-tip", buildTip);

// NUEVOS builders para tu flujo de “crear y vender”
r.post("/build-create-mint", buildCreateMint);
r.post("/build-transfer-spl", buildTransferSpl);
r.post("/build-transfer-sol", buildTransferSol);

// Bundles
r.post("/simulate", simulate);
r.post("/send", send);
r.get("/status/inflight", statusInflight);
r.post("/status/inflight", statusInflight);
r.get("/status/final", statusFinal);
r.post("/status/final", statusFinal);
// 🚀 EP “todo en uno”: crear y vender en el mismo bloque
r.post("/bundle-create-and-sell", bundleCreateAndSell); // 👈
r.post("/bundle-create-and-sell-many", bundleCreateAndSellMany);
r.post("/bundle-sell-many", bundleSellMany)
export default r;
