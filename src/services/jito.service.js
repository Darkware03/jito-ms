import { jitoRpc } from '../config/jitoRpc.js';

export const getTipAccounts = () => jitoRpc('getTipAccounts');
// src/services/jito.service.js

/**
 * Simula SIEMPRE con el shape moderno (el relayer lo acepta):
 * { encodedTransactions: [...], encoding: 'base64' }
 */
export const simulateBundle = (base64Txs) =>
    jitoRpc('simulateBundle', [{
        encodedTransactions: base64Txs,
        encoding: 'base64'
    }]);

/**
 * Envío con fallback:
 *  A) moderno: [{ encodedTransactions, encoding: 'base64' }]
 *  B) legacy1: [ base64Txs ]               // array plano
 *  C) legacy2: [{ transactions: base64Txs }]// algunos relayers usan 'transactions'
 */

export const sendBundle = (base64Txs, region = 'mainnet') =>
    jitoRpc('sendBundle', [ base64Txs, region ]);
export const getInflightStatuses = (bundleIds) => jitoRpc('getInflightBundleStatuses', [bundleIds]);
export const getBundleStatuses = (bundleIds) =>
    jitoRpc('getBundleStatuses', [bundleIds]); // devuelve estado por ID