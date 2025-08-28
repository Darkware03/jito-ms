import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

import { buildSignedCreateMintTxBase58 } from "../services/spl-create.service.js";
import { buildSignedTransferSplBase58 } from "../services/spl-transfer.service.js";
import { buildSignedTransferSolBase58 } from "../services/sol-transfer.service.js";
import { buildSignedTipBase58 } from "../services/txbuild.service.js"; // o tip.service.js
import {simulateBundle, sendBundle, getBundleStatuses} from "../services/jito.service.js";
import {connection} from "../config/solana.js";

async function assertHasLamports(pkBase58, requiredLamports, label) {
    const pub = Keypair.fromSecretKey(bs58.decode(pkBase58)).publicKey;
    const bal = await connection.getBalance(pub, 'finalized');
    if (bal < requiredLamports) {
        throw new Error(`${label} sin SOL suficiente: tiene ${bal}, requiere >= ${requiredLamports}`);
    }
}
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

        await assertHasLamports(creatorPrivateKeyBase58, /* p.ej */ 200_000, 'Creator');
        await assertHasLamports(b0.buyerPrivateKeyBase58, Number(b0.paymentLamports) + 10_000, 'Buyer0');
        await assertHasLamports(tipPk1, Number(tipLamports) + 5_000, 'TIP payer');

        const bundle1 = [
            txCreate.base64,
            txSpl0.base64,
            txPay0.base64,
            txTip1.base64
        ];

        const sim1 = await simulateBundle(bundle1);
        if (simulateOnly) {
            results.push({ stage: "bundle1", simulate: sim1 });
        } else {
            const id1 = await sendBundle(bundle1);
           // poll simple (500-1000ms)
            for (let i = 0; i < 30; i++) {
                const st = await getBundleStatuses([id1]);
                const s = st?.[0]?.status; // 'Landed' | 'Pending' | 'Dropped' | ...
                if (s === 'Landed') break;
                if (s === 'Dropped') throw new Error(`Bundle1 dropped`);
                await new Promise(r => setTimeout(r, 1000));
            }
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

                txs.push(txSpl.base64, txPay.base64);
            }

            // TIP al final
            const tipPkN = tipPayerPrivateKeyBase58 || chunk[0].buyerPrivateKeyBase58 || creatorPrivateKeyBase58;
            const txTipN = await buildSignedTipBase58({ payerPrivateKeyBase58: tipPkN, lamports: Number(tipLamports) });
            txs.push(txTipN.base64);

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

export async function bundleCreateAndSellManyWithParams(params) {
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
        } = params;

        if (!creatorPrivateKeyBase58) {
            return { ok: false, error: "El campo 'creatorPrivateKeyBase58' es requerido." };
        }
        if (!name || !symbol) {
            return { ok: false, error: "Los campos 'name' y 'symbol' son requeridos." };
        }
        if (!Array.isArray(buyers) || buyers.length === 0) {
            return { ok: false, error: "El arreglo 'buyers' debe contener al menos un comprador." };
        }

        const creator = Keypair.fromSecretKey(bs58.decode(creatorPrivateKeyBase58));
        const creatorPubkey = creator.publicKey.toBase58();

        const totalTokens = buyers.reduce((acc, b) => acc + Number(b.tokenAmount || 0), 0);
        if (totalTokens > Number(initialSupply)) {
            return { ok: false, error: "La suma de 'tokenAmount' en los compradores excede el 'initialSupply'." };
        }

        const results = [];
        let mintAddress = null;

        // BUNDLE 1: Create Mint + Transfer + Payment + Tip
        const b0 = buyers[0];
        if (!b0?.buyerPrivateKeyBase58 || b0?.tokenAmount == null || b0?.paymentLamports == null) {
            return {
                ok: false,
                error: "El primer comprador debe tener los campos 'buyerPrivateKeyBase58', 'tokenAmount' y 'paymentLamports'."
            };
        }

        const buyer0 = Keypair.fromSecretKey(bs58.decode(b0.buyerPrivateKeyBase58));
        const buyer0Pub = buyer0.publicKey.toBase58();

        const txCreate = await buildSignedCreateMintTxBase58({
            creatorPrivateKeyBase58,
            decimals,
            initialSupply: BigInt(initialSupply),
            name, symbol, uri
        });
        mintAddress = txCreate.mint;

        const txSpl0 = await buildSignedTransferSplBase58({
            creatorPrivateKeyBase58,
            mintAddress,
            buyerPubkey: buyer0Pub,
            amount: Number(b0.tokenAmount)
        });

        const txPay0 = await buildSignedTransferSolBase58({
            buyerPrivateKeyBase58: b0.buyerPrivateKeyBase58,
            toPubkey: creatorPubkey,
            lamports: Number(b0.paymentLamports)
        });

        const tipPk1 = tipPayerPrivateKeyBase58 || b0.buyerPrivateKeyBase58 || creatorPrivateKeyBase58;
        const txTip1 = await buildSignedTipBase58({ payerPrivateKeyBase58: tipPk1, lamports: Number(tipLamports) });

        await assertHasLamports(creatorPrivateKeyBase58, 200_000, 'Creator');
        await assertHasLamports(b0.buyerPrivateKeyBase58, Number(b0.paymentLamports) + 10_000, 'Buyer0');
        await assertHasLamports(tipPk1, Number(tipLamports) + 5_000, 'TIP payer');

        const bundle1 = [txCreate.base64, txSpl0.base64, txPay0.base64, txTip1.base64];
        const sim1 = await simulateBundle(bundle1);

        if (simulateOnly) {
            results.push({ stage: "bundle1", simulate: sim1 });
        } else {
            const id1 = await sendBundle(bundle1);
            results.push({ stage: "bundle1", bundleId: id1, simulate: sim1 });

            for (let i = 0; i < 30; i++) {
                const st = await getBundleStatuses([id1]);
                const status = st?.[0]?.status;
                if (status === 'Landed') break;
                if (status === 'Dropped') return { ok: false, error: "El bundle1 fue descartado por la red." };
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // BUNDLES 2..N
        const rest = buyers.slice(1);
        for (let i = 0; i < rest.length; i += 2) {
            const chunk = rest.slice(i, i + 2);
            const txs = [];

            for (const buyer of chunk) {
                if (!buyer?.buyerPrivateKeyBase58 || buyer?.tokenAmount == null || buyer?.paymentLamports == null) {
                    return {
                        ok: false,
                        error: `Comprador en posición ${i + 1} inválido: faltan campos obligatorios.`
                    };
                }

                const kp = Keypair.fromSecretKey(bs58.decode(buyer.buyerPrivateKeyBase58));
                const pub = kp.publicKey.toBase58();

                const txSpl = await buildSignedTransferSplBase58({
                    creatorPrivateKeyBase58,
                    mintAddress,
                    buyerPubkey: pub,
                    amount: Number(buyer.tokenAmount)
                });

                const txPay = await buildSignedTransferSolBase58({
                    buyerPrivateKeyBase58: buyer.buyerPrivateKeyBase58,
                    toPubkey: creatorPubkey,
                    lamports: Number(buyer.paymentLamports)
                });

                txs.push(txSpl.base64, txPay.base64);
            }

            const tipPkN = tipPayerPrivateKeyBase58 || chunk[0].buyerPrivateKeyBase58 || creatorPrivateKeyBase58;
            const txTipN = await buildSignedTipBase58({ payerPrivateKeyBase58: tipPkN, lamports: Number(tipLamports) });
            txs.push(txTipN.base64);

            const simN = await simulateBundle(txs);
            if (simulateOnly) {
                results.push({ stage: `bundle${2 + Math.floor(i / 2)}`, simulate: simN });
            } else {
                const idN = await sendBundle(txs);
                results.push({ stage: `bundle${2 + Math.floor(i / 2)}`, bundleId: idN, simulate: simN });
            }
        }

        return {
            ok: true,
            mint: mintAddress,
            bundles: results
        };

    } catch (err) {
        console.error("❌ Error en bundleCreateAndSellManyWithParams:", err);
        return {
            ok: false,
            error: err.message || 'Error inesperado al procesar el bundle.'
        };
    }
}
