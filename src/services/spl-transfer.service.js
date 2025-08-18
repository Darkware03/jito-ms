// src/services/spl-transfer.service.js
import {
    Keypair, VersionedTransaction, TransactionMessage, PublicKey
} from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction,
    createTransferInstruction
} from '@solana/spl-token';
import bs58 from 'bs58';
import { connection } from '../config/solana.js';
import { txToBase58 } from '../utils/encoders.js';

export async function buildSignedTransferSplBase58({
                                                       creatorPrivateKeyBase58,
                                                       mintAddress,
                                                       buyerPubkey,
                                                       amount
                                                   }) {
    const creator = Keypair.fromSecretKey(bs58.decode(creatorPrivateKeyBase58));
    const mint = new PublicKey(mintAddress);
    const buyer = new PublicKey(buyerPubkey);

    const { blockhash } = await connection.getLatestBlockhash('finalized');

    const creatorAta = getAssociatedTokenAddressSync(mint, creator.publicKey);
    const buyerAta = getAssociatedTokenAddressSync(mint, buyer);

    const ixs = [];
    // Crear ATA del comprador si no existe (seguro desde el creador pagando rent)
    ixs.push(createAssociatedTokenAccountInstruction(
        creator.publicKey, buyerAta, buyer, mint
    ));
    // Transferir tokens
    ixs.push(createTransferInstruction(creatorAta, buyerAta, creator.publicKey, Number(amount)));

    const msg = new TransactionMessage({
        payerKey: creator.publicKey,
        recentBlockhash: blockhash,
        instructions: ixs
    }).compileToV0Message();

    const tx = new VersionedTransaction(msg);
    tx.sign([creator]);

    return { base58: txToBase58(tx), buyerAta: buyerAta.toBase58() };
}
