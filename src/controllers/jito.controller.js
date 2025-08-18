import {
    getTipAccounts, simulateBundle, sendBundle,
    getInflightStatuses, getBundleStatuses
} from '../services/jito.service.js';
import {
    buildSignedTransferBase58, buildSignedTipBase58
} from '../services/txbuild.service.js';

export async function tipAccounts(req, res, next) {
    try { res.json(await getTipAccounts()); } catch (e) { next(e); }
}

// Construye una transferencia firmada en base58 (para tus pruebas)
export async function buildTransfer(req, res, next) {
    try {
        const { toPubkey, lamports } = req.body;
        const fromPK = req.body?.fromPrivateKeyBase58 || process.env.SENDER_PRIVATE_KEY_BASE58;
        if (!fromPK || !toPubkey || !lamports) {
            return res.status(400).json({ ok:false, error:'fromPrivateKeyBase58 (o env), toPubkey y lamports son requeridos' });
        }
        const base58 = await buildSignedTransferBase58({ fromPrivateKeyBase58: fromPK, toPubkey, lamports: Number(lamports) });
        res.json({ ok:true, base58 });
    } catch (e) { next(e); }
}

// Construye la TIP firmada (última del bundle)
export async function buildTip(req, res, next) {
    try {
        const lamports = Number(req.body?.lamports ?? 1000);
        const pk = req.body?.payerPrivateKeyBase58 || process.env.SENDER_PRIVATE_KEY_BASE58;
        if (!pk) return res.status(400).json({ ok:false, error:'payerPrivateKeyBase58 requerido (o SENDER_PRIVATE_KEY_BASE58 en .env)' });
        const out = await buildSignedTipBase58({ payerPrivateKeyBase58: pk, lamports });
        res.json({ ok:true, ...out });
    } catch (e) { next(e); }
}

export async function simulate(req, res, next) {
    try {
        const txs = req.body?.txs;
        if (!Array.isArray(txs) || txs.length === 0) return res.status(400).json({ ok:false, error:'txs[] requerido' });
        const result = await simulateBundle(txs);
        res.json({ ok:true, result });
    } catch (e) { next(e); }
}

export async function send(req, res, next) {
    try {
        const txs = req.body?.txs;
        if (!Array.isArray(txs) || txs.length === 0) return res.status(400).json({ ok:false, error:'txs[] requerido' });
        const bundleId = await sendBundle(txs);
        res.json({ ok:true, bundleId });
    } catch (e) { next(e); }
}

export async function statusInflight(req, res, next) {
    try {
        const ids = Array.isArray(req.body?.bundleIds) ? req.body.bundleIds : [req.query.id].filter(Boolean);
        if (!ids.length) return res.status(400).json({ ok:false, error: 'bundleIds o ?id requerido' });
        const result = await getInflightStatuses(ids);
        res.json({ ok:true, result });
    } catch (e) { next(e); }
}

export async function statusFinal(req, res, next) {
    try {
        const ids = Array.isArray(req.body?.bundleIds) ? req.body.bundleIds : [req.query.id].filter(Boolean);
        if (!ids.length) return res.status(400).json({ ok:false, error: 'bundleIds o ?id requerido' });
        const result = await getBundleStatuses(ids);
        res.json({ ok:true, result });
    } catch (e) { next(e); }
}
