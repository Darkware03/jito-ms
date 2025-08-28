import { generarTokenMemecoin } from '../services/token-generator.service.js';

export async function postGenerarToken(req, res, next) {
    try {
        const { text, language } = req.body;

        if (!text || !language) {
            return res.status(400).json({ ok: false, error: 'text y language son requeridos' });
        }

        const resultado = await generarTokenMemecoin({ text, language });

        res.json({
            ok: true,
            token: resultado,
        });
    } catch (err) {
        next(err);
    }
}
