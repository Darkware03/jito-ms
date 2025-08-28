export function parseJSONFromChatGPT(rawText) {
    try {
        const match = rawText.match(/```json([\s\S]*?)```/);
        if (!match || match.length < 2) {
            return {
                error: true,
                message: "No se encontró un bloque JSON válido entre ```json ... ```.",
            };
        }

        const jsonString = match[1].trim();
        const parsed = JSON.parse(jsonString);

        // Validación de campos esperados
        const fields = [
            "name",
            "symbol",
            "description_short",
            "description_long",
            "hashtags",
            "emojis",
            "disclaimers",
        ];
        const result = {};
        for (const field of fields) {
            result[field] = parsed[field] ?? null;
        }

        return result;
    } catch (err) {
        return {
            error: true,
            message: "Error al parsear el JSON desde el modelo: " + err.message,
        };
    }
}
