import bs58 from 'bs58';

/** Serialize a VersionedTransaction/Transaction to base58 "on-wire" */
export function txToBase58(tx) {
    const wire = tx.serialize(); // Uint8Array
    return bs58.encode(wire);
}

/** Helpers for base64 if te interesa */
export function txToBase64(tx) {
    const wire = tx.serialize();
    return Buffer.from(wire).toString('base64');
}
