// src/services/sol-transfer.service.js
import { Keypair, VersionedTransaction, TransactionMessage, SystemProgram, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { connection } from '../config/solana.js';
import { txToBase58 } from '../utils/encoders.js';

export async function buildSignedTransferSolBase58({
                                                       buyerPrivateKeyBase58,
                                                       toPubkey,
                                                       lamports
                                                   }) {
    const buyer = Keypair.fromSecretKey(bs58.decode(buyerPrivateKeyBase58));
    const to = new PublicKey(toPubkey);
    const { blockhash } = await connection.getLatestBlockhash('finalized');

    const ix = SystemProgram.transfer({ fromPubkey: buyer.publicKey, toPubkey: to, lamports: Number(lamports) });
    const msg = new TransactionMessage({
        payerKey: buyer.publicKey, recentBlockhash: blockhash, instructions: [ix]
    }).compileToV0Message();

    const tx = new VersionedTransaction(msg);
    tx.sign([buyer]);
    return { base58: txToBase58(tx) };
}
