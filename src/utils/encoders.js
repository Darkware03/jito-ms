// utils/encoders.js
import bs58 from 'bs58';

export function txToBase58(tx) {
    const wire = tx.serialize(); // Uint8Array
    return bs58.encode(wire);
}

export function txToBase64(tx) {
    const wire = tx.serialize(); // Uint8Array
    return Buffer.from(wire).toString('base64');
}
