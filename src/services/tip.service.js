import { Keypair, SystemProgram, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import bs58 from 'bs58';
import { connection } from '../config/solana.js';
import { getTipAccounts } from './jito.service.js';
import { txToBase58 } from '../utils/tx.js';

// Construye y firma una tx de TIP (transfer SOL) y devuelve base58 firmado
export async function buildSignedTipTxBase58({ payerPrivateKeyBase58, lamports }) {
    const payer = Keypair.fromSecretKey(bs58.decode(payerPrivateKeyBase58));
    const tipAccounts = await getTipAccounts(); // array de pubkeys sugeridas
    const tipAccount = tipAccounts[Math.floor(Math.random() * tipAccounts.length)]; // aleatorio

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

    const ix = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: tipAccount,
        lamports: lamports // p.ej. 1000 lamports mínimo sugerido
    });

    const msgV0 = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: blockhash,
        instructions: [ix]
    }).compileToV0Message();

    const tx = new VersionedTransaction(msgV0);
    tx.sign([payer]);

    return {
        base58: txToBase58(tx),
        tipAccount,
        lastValidBlockHeight
    };
}
