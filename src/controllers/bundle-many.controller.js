import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

import { buildSignedCreateMintTxBase58 } from "../services/spl-create.service.js";
import { buildSignedTransferSplBase58 } from "../services/spl-transfer.service.js";
import { buildSignedTransferSolBase58 } from "../services/sol-transfer.service.js";
import { buildSignedTipBase58 } from "../services/txbuild.service.js"; // o tip.service.js
import { simulateBundle, sendBundle } from "../services/jito.service.js";

/**
 * Body esperado:
 * {
 *   "creatorPrivateKeyBase58": "...",
 *   "decimals": 6,
 *   "initialSupply": 1000000,
 *   "name": "MiToken", "symbol": "MIT", "uri": "https://...",
 *   "buyers": [
 *     { "buyerPrivateKeyBase58": "...", "tokenAmount": 10000, "paymentLamports": 5000000 },
 *     { "buyerPrivateKeyBase58": "...", "tokenAmount": 8000,  "paymentLamports": 4000000 },
 *     ...
 *   ],
 *   "tipLamports": 3000,
 *   "tipPayerPrivateKeyBase58": "",          // opcional
 *   "simulateOnly": false
 * }
 */
export async function bundleCreateAndSellMany(req, res, next) {
    try {
        const {
            creatorPrivateKeyBase58,
            decimals = 6,
            initialSupply = 1_000_000,
            name, symbol, uri,
            buyers = [],
            tipLamports = 2000,
            tipPayerPrivateKeyBase58,
            simulateOnly = false
        } = req.body;

        if (!creatorPrivateKeyBase58) {
            return res.status(400).json({ ok:false, error: "creatorPrivateKeyBase58 es requerido" });
        }
        if (!Array.isArray(buyers) || buyers.length === 0) {
            return res.status(400).json({ ok:false, error: "buyers[] es requerido con al menos 1 elemento" });
        }
        console.log(process.env.RPC_URL)
        // Validaciones y derivaciones
        const creator = Keypair.fromSecretKey(bs58.decode(creatorPrivateKeyBase58));
        const creatorPubkey = creator.publicKey.toBase58();

        const totalTokens = buyers.reduce((acc, b) => acc + Number(b.tokenAmount || 0), 0);
        if (totalTokens > Number(initialSupply)) {
            return res.status(400).json({ ok:false, error: "Suma de tokenAmount de buyers excede initialSupply" });
        }

        const results = [];
        let mintAddress = null;

        // ---------- BUNDLE 1: CREATE + Buyer[0] + TIP
        const b0 = buyers[0];
        if (!b0?.buyerPrivateKeyBase58 || b0?.tokenAmount == null || b0?.paymentLamports == null) {
            return res.status(400).json({ ok:false, error: "buyers[0] debe tener buyerPrivateKeyBase58, tokenAmount, paymentLamports" });
        }
        const buyer0 = Keypair.fromSecretKey(bs58.decode(b0.buyerPrivateKeyBase58));
        const buyer0Pub = buyer0.publicKey.toBase58();

        // TX1: create mint (+ATA+mintTo[initialSupply] + (opcional) metadata)
        const txCreate = await buildSignedCreateMintTxBase58({
            creatorPrivateKeyBase58,
            decimals: Number(decimals),
            initialSupply: BigInt(initialSupply),
            name, symbol, uri
        });
        mintAddress = txCreate.mint;

        // TX2: transfer SPL creador -> buyer0
        const txSpl0 = await buildSignedTransferSplBase58({
            creatorPrivateKeyBase58,
            mintAddress,
            buyerPubkey: buyer0Pub,
            amount: Number(b0.tokenAmount)
        });

        // TX3: pago SOL buyer0 -> creador
        const txPay0 = await buildSignedTransferSolBase58({
            buyerPrivateKeyBase58: b0.buyerPrivateKeyBase58,
            toPubkey: creatorPubkey,
            lamports: Number(b0.paymentLamports)
        });

        // TX4: TIP
        const tipPk1 = tipPayerPrivateKeyBase58 || b0.buyerPrivateKeyBase58 || creatorPrivateKeyBase58;
        const txTip1 = await buildSignedTipBase58({ payerPrivateKeyBase58: tipPk1, lamports: Number(tipLamports) });

        const bundle1 = [txCreate.base58, txSpl0.base58, txPay0.base58, txTip1.base58];

        const sim1 = await simulateBundle(bundle1);
        if (simulateOnly) {
            results.push({ stage: "bundle1", simulate: sim1 });
        } else {
            const id1 = await sendBundle(bundle1);
            results.push({ stage: "bundle1", bundleId: id1, simulate: sim1 });
        }

        // ---------- BUNDLES 2..N: agrupar compradores restantes de a 1 o 2 por bundle
        // (sin CREATE, para respetar límite de 5 tx: hasta 2 compradores + TIP)
        const rest = buyers.slice(1);
        for (let i = 0; i < rest.length; i += 2) {
            const chunk = rest.slice(i, i + 2); // 1 o 2 compradores

            const txs = [];
            // Para cada comprador del chunk: transfer SPL + pago SOL
            for (const buyerOrder of chunk) {
                if (!buyerOrder?.buyerPrivateKeyBase58 || buyerOrder?.tokenAmount == null || buyerOrder?.paymentLamports == null) {
                    throw new Error("Cada buyer debe traer buyerPrivateKeyBase58, tokenAmount, paymentLamports");
                }
                const kp = Keypair.fromSecretKey(bs58.decode(buyerOrder.buyerPrivateKeyBase58));
                const pub = kp.publicKey.toBase58();

                const txSpl = await buildSignedTransferSplBase58({
                    creatorPrivateKeyBase58,
                    mintAddress,
                    buyerPubkey: pub,
                    amount: Number(buyerOrder.tokenAmount)
                });

                const txPay = await buildSignedTransferSolBase58({
                    buyerPrivateKeyBase58: buyerOrder.buyerPrivateKeyBase58,
                    toPubkey: creatorPubkey,
                    lamports: Number(buyerOrder.paymentLamports)
                });

                txs.push(txSpl.base58, txPay.base58);
            }

            // TIP al final
            const tipPkN = tipPayerPrivateKeyBase58 || chunk[0].buyerPrivateKeyBase58 || creatorPrivateKeyBase58;
            const txTipN = await buildSignedTipBase58({ payerPrivateKeyBase58: tipPkN, lamports: Number(tipLamports) });
            txs.push(txTipN.base58);

            // Simular y/o enviar
            const simN = await simulateBundle(txs);
            if (simulateOnly) {
                results.push({ stage: `bundle${2 + Math.floor(i / 2)}`, simulate: simN });
            } else {
                const idN = await sendBundle(txs);
                results.push({ stage: `bundle${2 + Math.floor(i / 2)}`, bundleId: idN, simulate: simN });
            }
        }

        return res.json({
            ok: true,
            mint: mintAddress,
            bundles: results
        });

    } catch (err) {
        return next(err);
    }
}
