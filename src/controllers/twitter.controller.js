import {getTrendDetails, getTrendingTopics} from '../services/twitter.service.js';
import {generarTokenMemecoin} from "../services/openai.service.js";
import {extractJsonFromText} from "./openai.controller.js";
import {bundleCreateAndSellMany, bundleCreateAndSellManyWithParams} from "./bundle-many.controller.js";

export async function trendingTopicsController(req, res) {
    try {
        const woeid = req.query.woeid || 1; // Worldwide por defecto
        const topics = await getTrendingTopics(woeid);
        res.json({ ok: true, topics });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
}
export async function trendDetailsController(req, res) {
    try {
        const trendName = req.query.trendName;
        if (!trendName) throw new Error('Trend name is required');
        const details = await getTrendDetails(trendName);
        res.json({ ok: true, details });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
}

export async function trendAndTrenDetrailAndDataToken(req, res) {
    const trends = await getTrendingTopics(req.query.woeid);
    const trendsDetail = await getTrendDetails(trends[0].trend_name);

    const tokenData = await generarTokenMemecoin({
        text: trendsDetail[0].text
    });

    //const tokenDataParsed = JSON.parse(tokenData);
    //const tokenCSVParsed = extractTokenDataFromRaw(tokenDataParsed);

    let parsed;

    // Si ya es un objeto:
    if (typeof tokenData === 'object') {
        parsed = tokenData;
    } else {
        // Si es texto que contiene JSON envuelto en markdown
        parsed = extractJsonFromText(tokenData);
    }
   const tokenCreation = await bundleCreateAndSellManyWithParams(req.body);
    return res.json({ ok: true, token: tokenCreation });
}

function extractTokenDataFromRaw(tokenResponse) {
    const raw = tokenResponse.raw;
    console.log("🔍 RAW:", raw);

    if (!raw || typeof raw !== 'string') {
        return { error: true, message: "El campo 'raw' no está definido o no es un string válido." };
    }

    const headers = [
        "name",
        "symbol",
        "description_short",
        "description_long",
        "hashtags",
        "emojis",
        "disclaimers"
    ];

    const afterCsv = raw.split('</csv>')[2];
    if (!afterCsv) {
        return { error: true, message: "No se encontró la etiqueta </csv>." };
    }
    // Busca la primera línea que tenga al menos 6 comas
    const candidateLine = afterCsv
        .split('\n')
        .map(l => l.trim())
        .find(line => {
            const commaCount = (line.match(/,/g) || []).length;
            return commaCount >= 6 && !line.startsWith('#') && !line.startsWith('//');
        });

    if (!candidateLine) {
        return { error: true, message: "No se encontró una línea CSV válida después de </csv>." };
    }

    const values = candidateLine
        .split(',')
        .map(v => {
            const trimmed = v.trim().replace(/^"(.*)"$/, '$1'); // elimina comillas
            return trimmed === '' ? null : trimmed;
        });
    console.log("values",candidateLine)
    const result = {};
    headers.forEach((key, idx) => {
        result[key] = values[idx] !== undefined ? values[idx] : null;
    });

    return result;
}
