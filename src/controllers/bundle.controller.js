import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

import { buildSignedCreateMintTxBase58 } from "../services/spl-create.service.js";
import { buildSignedTransferSplBase58 } from "../services/spl-transfer.service.js";
import { buildSignedTransferSolBase58 } from "../services/sol-transfer.service.js";
import { buildSignedTipBase58 } from "../services/txbuild.service.js"; // o tip.service.js si lo separaste
import { simulateBundle, sendBundle } from "../services/jito.service.js";

export async function bundleCreateAndSell(req, res, next) {
    try {
        const {
            // clave del creador (minteará supply y enviará al comprador)
            creatorPrivateKeyBase58,
            // clave del comprador (pagará en SOL y recibirá SPL)
            buyerPrivateKeyBase58,

            // Config del token
            decimals = 6,
            initialSupply = 1_000_000, // entero (unidades del token)
            name, symbol, uri,        // opcional: metadata metaplex

            // Venta
            tokenAmountToBuyer,       // entero en unidades del token
            paymentLamports,          // SOL en lamports (1 SOL = 1_000_000_000)

            // TIP
            tipLamports = 2000,       // 1000–10000 recomendado
            tipPayerPrivateKeyBase58, // opcional; por defecto usa buyer o creator

            // Control
            simulateOnly = false
        } = req.body;

        if (!creatorPrivateKeyBase58 || !buyerPrivateKeyBase58) {
            return res.status(400).json({ ok:false, error: "creatorPrivateKeyBase58 y buyerPrivateKeyBase58 son requeridos" });
        }
        if (tokenAmountToBuyer == null || paymentLamports == null) {
            return res.status(400).json({ ok:false, error: "tokenAmountToBuyer y paymentLamports son requeridos" });
        }

        // Derivar pubkeys
        const creator = Keypair.fromSecretKey(bs58.decode(creatorPrivateKeyBase58));
        const buyer   = Keypair.fromSecretKey(bs58.decode(buyerPrivateKeyBase58));
        const buyerPubkey = buyer.publicKey.toBase58();
        const creatorPubkey = creator.publicKey.toBase58();

        // ------------- TX1: CREATE MINT (+ ATA creador + mintTo + (opcional) metadata)
        const tx1 = await buildSignedCreateMintTxBase58({
            creatorPrivateKeyBase58,
            decimals: Number(decimals),
            initialSupply: BigInt(initialSupply),
            name, symbol, uri
        });
        // tx1 => { base58, mint, creatorAta }
        const mintAddress = tx1.mint;

        // Validación simple de cantidades
        if (Number(tokenAmountToBuyer) > Number(initialSupply)) {
            return res.status(400).json({ ok:false, error: "tokenAmountToBuyer no puede exceder initialSupply" });
        }

        // ------------- TX2: TRANSFER SPL del creador → comprador
        const tx2 = await buildSignedTransferSplBase58({
            creatorPrivateKeyBase58,
            mintAddress,
            buyerPubkey,
            amount: Number(tokenAmountToBuyer)
        });
        // tx2 => { base58, buyerAta }

        // ------------- TX3: PAGO SOL del comprador → creador
        const tx3 = await buildSignedTransferSolBase58({
            buyerPrivateKeyBase58,
            toPubkey: creatorPubkey,
            lamports: Number(paymentLamports)
        });
        // tx3 => { base58 }

        // ------------- TX4: TIP (última del bundle)
        const tipPk = tipPayerPrivateKeyBase58 || buyerPrivateKeyBase58 || creatorPrivateKeyBase58;
        const tx4 = await buildSignedTipBase58({
            payerPrivateKeyBase58: tipPk,
            lamports: Number(tipLamports)
        });
        // tx4 => { base58, tipAccount }

        // Bundle en orden: create → transfer SPL → pago SOL → TIP
        const bundleTxs = [tx1.base58, tx2.base58, tx3.base58, tx4.base58];

        // (Opcional) Simular
        const simulation = await simulateBundle(bundleTxs);

        if (simulateOnly) {
            return res.json({
                ok: true,
                simulateOnly: true,
                mint: mintAddress,
                creator: creatorPubkey,
                buyer: buyerPubkey,
                tipAccount: tx4.tipAccount,
                simulation
            });
        }

        // Enviar bundle
        const bundleId = await sendBundle(bundleTxs);

        return res.json({
            ok: true,
            bundleId,
            mint: mintAddress,
            creator: creatorPubkey,
            buyer: buyerPubkey,
            tipAccount: tx4.tipAccount,
            simulation // útil para debug/ver gas/logs
        });
    } catch (err) {
        return next(err);
    }
}
