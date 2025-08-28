import fetch from 'node-fetch';

const TOKEN_API_URL = 'http://34.68.213.186:3010/generate';

/**
 * Envía el texto y el idioma al endpoint externo para generar un token.
 * @param {Object} payload - { text: string, language: string }
 * @returns {Promise<string>} - Resultado del token generado (en texto plano)
 */
export async function generarTokenMemecoin(payload) {
    const res = await fetch(TOKEN_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Error al generar token: ${errorText}`);
    }

    const result = await res.text(); // ← El API devuelve texto plano
    return result;
}
