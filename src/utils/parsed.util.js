// ---- Helpers para parsear objetos "flojos" a JSON estricto ----
export function toStrictJSON(loose) {
    // 1) Comillas a claves: { key: ... } -> { "key": ... }
    let s = loose.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');

    // 2) Comillas a valores no citados que no sean número/true/false/null
    //   Capturamos valor hasta , o } sin empezar con comillas
    s = s.replace(/:\s*([^,\}\s"][^,\}]*)/g, (_, raw) => {
        const v = raw.trim();
        // Si ya viene entre comillas
        if (/^".*"$/.test(v)) return ':' + v;
        // number | true | false | null
        if (/^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)$/i.test(v)) {
            return ':' + v;
        }
        // Cualquier alfanumérico (p.ej. base58) -> entre comillas
        return ':"' + v.replace(/"/g, '\\"') + '"';
    });

    return s.trim();
}

export function parseLooseObject(loose) {
    if (typeof loose === 'object' && loose !== null) return loose; // ya es objeto
    if (typeof loose !== 'string') {
        throw new Error(`Tipo no soportado para parseo: ${typeof loose}`);
    }
    const fixed = toStrictJSON(loose);
    return JSON.parse(fixed);
}

// Normaliza in-place: si wallets es const, NO reasignamos; mutamos contenido
export function normalizeWalletsInPlace(wallets) {
    if (Array.isArray(wallets)) {
        const parsed = wallets.map(item => parseLooseObject(item));
        wallets.splice(0, wallets.length, ...parsed);
        return wallets;
    }
    // Si te llega 1 solo objeto (string), devuélvelo parseado
    return parseLooseObject(wallets);
}