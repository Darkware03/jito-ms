import { jitoRpc } from '../config/jitoRpc.js';

export const getTipAccounts = () => jitoRpc('getTipAccounts');
export const simulateBundle = (base58Txs) => jitoRpc('simulateBundle', [base58Txs]);
export const sendBundle = (base58Txs) => jitoRpc('sendBundle', [base58Txs]);
export const getInflightStatuses = (bundleIds) => jitoRpc('getInflightBundleStatuses', [bundleIds]);
export const getBundleStatuses = (bundleIds) => jitoRpc('getBundleStatuses', [bundleIds]);
