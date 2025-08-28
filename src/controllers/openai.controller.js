import { generarTokenMemecoin } from '../services/openai.service.js';
import { parseJSONFromChatGPT } from '../utils/parser.js';

export async function generarTokenHandler(req, res) {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    try {
        const respuesta = await generarTokenMemecoin({ text });
        console.log('🔍 RAW:', respuesta);

        let parsed;

        // Si ya es un objeto:
        if (typeof respuesta === 'object') {
            parsed = respuesta;
        } else {
            // Si es texto que contiene JSON envuelto en markdown
            parsed = extractJsonFromText(respuesta);
        }

        return res.json(parsed);
    } catch (error) {
        console.error('❌ Error:', error.message);
        return res.status(500).json({ error: 'Error procesando el JSON' });
    }
}

export function extractJsonFromText(rawText) {
    const match = rawText.match(/```json\s*([\s\S]*?)```/);
    if (!match) {
        throw new Error("No se encontró bloque JSON válido.");
    }
    return JSON.parse(match[1]);
}
