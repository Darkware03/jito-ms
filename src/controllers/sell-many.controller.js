// src/controllers/bundle-sell-many.controller.js
import bs58 from "bs58";
import { Keypair, PublicKey } from "@solana/web3.js";

import { buildSignedTransferSplFromOwnerBase58 } from "../services/spl-transfer-from-owner.service.js";
import { buildSignedTransferSolBase58 } from "../services/sol-transfer.service.js";
import { buildSignedTipBase58 } from "../services/txbuild.service.js";
import { simulateBundle, sendBundle } from "../services/jito.service.js";
import { connection } from "../config/solana.js";

/**
 * Body esperado:
 * {
 *   "mintAddress": ".....",                 // Mint del SPL a vender
 *   "buyerPrivateKeyBase58": "....",        // El COMPRADOR central que recibirá los SPL y pagará SOL
 *   "sellers": [
 *     { "sellerPrivateKeyBase58": "...", "tokenAmount": 10_000, "paymentLamports": 5_000_000 },
 *     { "sellerPrivateKeyBase58": "...", "tokenAmount": 15_000, "paymentLamports": 7_000_000 },
 *     ...
 *   ],
 *   "tipLamports": 3000,
 *   "tipPayerPrivateKeyBase58": "",         // opcional (por defecto el buyer)
 *   "simulateOnly": false
 * }
 */
export async function bundleSellMany(req, res, next) {
    try {
        const {
            mintAddress,
            buyerPrivateKeyBase58,
            sellers = [],
            tipLamports = 2000,
            tipPayerPrivateKeyBase58,
            simulateOnly = false,
        } = req.body;

        if (!mintAddress) {
            return res.status(400).json({ ok: false, error: "mintAddress es requerido" });
        }
        if (!buyerPrivateKeyBase58) {
            return res.status(400).json({ ok: false, error: "buyerPrivateKeyBase58 es requerido" });
        }
        if (!Array.isArray(sellers) || sellers.length === 0) {
            return res.status(400).json({ ok: false, error: "sellers[] es requerido con al menos 1 elemento" });
        }

        const buyer = Keypair.fromSecretKey(bs58.decode(buyerPrivateKeyBase58));
        const buyerPubkey = buyer.publicKey.toBase58();

        // Validación: ningún seller puede ser igual al buyer (evita transferirte a ti mismo)
        for (let i = 0; i < sellers.length; i++) {
            const s = sellers[i];
            if (!s?.sellerPrivateKeyBase58 || s?.tokenAmount == null || s?.paymentLamports == null) {
                return res.status(400).json({ ok: false, error: `sellers[${i}] debe tener sellerPrivateKeyBase58, tokenAmount, paymentLamports` });
            }
            if (s.sellerPrivateKeyBase58 === buyerPrivateKeyBase58) {
                return res.status(400).json({ ok: false, error: `sellers[${i}] no puede ser el mismo que el comprador` });
            }
        }

        const results = [];

        // Recomendación: si vas a ENVIAR bundles reales (simulateOnly=false),
        // espera Landed entre bundles usando getBundleStatuses para evitar dependencias de estado.
        // Aquí en simulateOnly puedes simular cada bundle por separado.

        // ---------- Agrupar vendedores de a 1 o 2 por bundle (SPL seller->buyer + SOL buyer->seller + TIP)
        for (let i = 0; i < sellers.length; i += 2) {
            const chunk = sellers.slice(i, i + 2); // 1 o 2 vendedores por bundle
            const txs = [];

            for (const order of chunk) {
                const { sellerPrivateKeyBase58, tokenAmount, paymentLamports } = order;

                // TX1: transfer SPL seller -> buyer (crea ATA del buyer si no existe, firmado por seller)
                const txSpl = await buildSignedTransferSplFromOwnerBase58({
                    ownerPrivateKeyBase58: sellerPrivateKeyBase58,
                    mintAddress,
                    toPubkey: buyerPubkey,
                    amount: Number(tokenAmount),
                });

                // TX2: pago SOL buyer -> seller
                const sellerPubkey = Keypair.fromSecretKey(bs58.decode(sellerPrivateKeyBase58)).publicKey.toBase58();
                const txPay = await buildSignedTransferSolBase58({
                    buyerPrivateKeyBase58,          // paga el comprador central
                    toPubkey: sellerPubkey,         // cobra el vendedor
                    lamports: Number(paymentLamports),
                });

                txs.push(txSpl.base64, txPay.base64);
            }

            // TIP (páguelo buyer por defecto para asegurar balance)
            const tipPk = tipPayerPrivateKeyBase58 || buyerPrivateKeyBase58;
            const txTip = await buildSignedTipBase58({
                payerPrivateKeyBase58: tipPk,
                lamports: Number(tipLamports),
            });
            txs.push(txTip.base64);

            // Simular y/o enviar
            const sim = await simulateBundle(txs);
            if (simulateOnly) {
                results.push({ stage: `bundle${1 + Math.floor(i / 2)}`, simulate: sim });
            } else {
                const id = await sendBundle(txs);
                results.push({ stage: `bundle${1 + Math.floor(i / 2)}`, bundleId: id, simulate: sim });
                // Sugerencia: espera Landed aquí si vas a mandar otro bundle después
                // await waitForLanded(id)
            }
        }

        return res.json({
            ok: true,
            mint: mintAddress,
            bundles: results,
        });
    } catch (err) {
        return next(err);
    }
}
