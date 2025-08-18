import bs58 from 'bs58';

export function txToBase58(tx) {
    const wire = tx.serialize(); // Uint8Array
    return bs58.encode(wire);
}
