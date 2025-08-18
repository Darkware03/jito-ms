import { Keypair, SystemProgram, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import bs58 from 'bs58';
import { connection } from '../config/solana.js';
import { getTipAccounts } from './jito.service.js';
import { txToBase58 } from '../utils/encoders.js';

// Crea y firma una transferencia SOL (para pruebas)
export async function buildSignedTransferBase58({ fromPrivateKeyBase58, toPubkey, lamports }) {
    const from = Keypair.fromSecretKey(bs58.decode(fromPrivateKeyBase58));
    const { blockhash } = await connection.getLatestBlockhash('finalized');

    const ix = SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey,
        lamports
    });

    const msg = new TransactionMessage({
        payerKey: from.publicKey,
        recentBlockhash: blockhash,
        instructions: [ix]
    }).compileToV0Message();

    const tx = new VersionedTransaction(msg);
    tx.sign([from]);
    return txToBase58(tx);
}

// Crea y firma la TIP tx (última del bundle)
export async function buildSignedTipBase58({ payerPrivateKeyBase58, lamports }) {
    const payer = Keypair.fromSecretKey(bs58.decode(payerPrivateKeyBase58));
    const tips = await getTipAccounts();
    const tipAccount = tips[Math.floor(Math.random() * tips.length)];

    const { blockhash } = await connection.getLatestBlockhash('finalized');

    const ix = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: tipAccount,
        lamports
    });

    const msg = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: blockhash,
        instructions: [ix]
    }).compileToV0Message();

    const tx = new VersionedTransaction(msg);
    tx.sign([payer]);
    return { base58: txToBase58(tx), tipAccount };
}
