import { buildSignedCreateMintTxBase58 } from "../services/spl-create.service.js";
import { buildSignedTransferSplBase58 } from "../services/spl-transfer.service.js";
import { buildSignedTransferSolBase58 } from "../services/sol-transfer.service.js";

// POST /api/jito/build-create-mint
export async function buildCreateMint(req, res, next) {
    try {
        const {
            creatorPrivateKeyBase58,
            decimals = 6,
            initialSupply = 1_000_000,
            name, symbol, uri
        } = req.body;

        if (!creatorPrivateKeyBase58) {
            return res.status(400).json({ ok:false, error: "creatorPrivateKeyBase58 es requerido" });
        }

        const out = await buildSignedCreateMintTxBase58({
            creatorPrivateKeyBase58,
            decimals: Number(decimals),
            initialSupply: BigInt(initialSupply),
            name, symbol, uri
        });

        // { base58, mint, creatorAta }
        return res.json({ ok:true, ...out });
    } catch (e) { next(e); }
}

// POST /api/jito/build-transfer-spl
export async function buildTransferSpl(req, res, next) {
    try {
        const { creatorPrivateKeyBase58, mintAddress, buyerPubkey, amount } = req.body;

        if (!creatorPrivateKeyBase58 || !mintAddress || !buyerPubkey || amount == null) {
            return res.status(400).json({
                ok:false,
                error: "creatorPrivateKeyBase58, mintAddress, buyerPubkey y amount son requeridos"
            });
        }

        const out = await buildSignedTransferSplBase58({
            creatorPrivateKeyBase58,
            mintAddress,
            buyerPubkey,
            amount: Number(amount)
        });

        // { base58, buyerAta }
        return res.json({ ok:true, ...out });
    } catch (e) { next(e); }
}

// POST /api/jito/build-transfer-sol
export async function buildTransferSol(req, res, next) {
    try {
        const { buyerPrivateKeyBase58, toPubkey, lamports } = req.body;

        if (!buyerPrivateKeyBase58 || !toPubkey || lamports == null) {
            return res.status(400).json({
                ok:false,
                error: "buyerPrivateKeyBase58, toPubkey y lamports son requeridos"
            });
        }

        const out = await buildSignedTransferSolBase58({
            buyerPrivateKeyBase58,
            toPubkey,
            lamports: Number(lamports)
        });

        // { base58 }
        return res.json({ ok:true, ...out });
    } catch (e) { next(e); }
}
