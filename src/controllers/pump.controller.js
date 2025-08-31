import {
    testPumpService,
    createWalletService,
    getWalletsService,
    createTokenService, sellTokenBundleService
} from "../services/pumpfun.service.js";

function extractWallets(body) {
    const {wallets} = body ?? {};
    if (Array.isArray(wallets)) return wallets;

    if (typeof wallets === 'string') {
        const trimmed = wallets.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (!Array.isArray(parsed)) throw new Error('El JSON no es un arreglo.');
                return parsed;
            } catch {
                return [trimmed];
            }
        }
        return [trimmed];
    }
}

function toNumberOr(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toBoolStringOr(value, fallback = 'false') {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (v === 'true' || v === 'false') return v;
    }
    return fallback;
}

export async function sellBundle (req,res){
    try {
        const {
            mint,
            denominatedInSol,   // "true" | "false"
            slippage,           // número (ej. 30 = 3.0%)
            priorityFeeFirst,   // número (ej. 0.00005)
            priorityFeeOthers,  // número (ej. 0.0)
            pool,
        } = req.body ?? {};
        const wallets = extractWallets(req.body);

        const result = await sellTokenBundleService({
            wallets,
            mint,
            denominatedInSol: toBoolStringOr(denominatedInSol, 'false'),
            slippage: toNumberOr(slippage, 30),
            priorityFeeFirst: toNumberOr(priorityFeeFirst, 0.00005),
            priorityFeeOthers: toNumberOr(priorityFeeOthers, 0.0),
            pool: (pool || 'pump'),
        });
        return res.json(result);
    } catch (err) {
        console.error('sellBundle error:', err);
        const msg = err?.message || 'Error desconocido en sellBundle';
        return res.status(400).json({ ok: false, error: msg });
    }
}

export async function createTokenController(req, res) {
    try {
        const {
            wallets,
            name,
            symbol,
            description,
            twitter,
            telegram,
            website,
            priorityFeeCreate,
            priorityFeeOthers,
        } = req.body;

        // ⚠️ Si usas multer para subir imágenes: req.file
        // (asegúrate de configurar el middleware en la ruta)
        const image = req.file; // { buffer, mimetype, originalname }

        if (!image) {
            return res.status(400).json({ ok: false, error: "Debes subir un archivo de imagen." });
        }

        const result = await createTokenService({
            wallets,
            image: {
                buffer: image.buffer,
                mimetype: image.mimetype,
                filename: image.originalname,
            },
            name,
            symbol,
            description,
            twitter,
            telegram,
            website,
            priorityFeeCreate,
            priorityFeeOthers,
        });

        return res.json(result);
    } catch (err) {
        console.error("❌ Error en createTokenController:", err);
        return res.status(500).json({
            ok: false,
            error: err.message || "Error inesperado en el servidor",
        });
    }
}