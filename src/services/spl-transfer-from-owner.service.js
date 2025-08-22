// src/services/spl-transfer-from-owner.service.js
import {
    Keypair, VersionedTransaction, TransactionMessage, PublicKey
} from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAccount,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import bs58 from 'bs58';
import { connection } from '../config/solana.js';
import { txToBase58, txToBase64 } from '../utils/encoders.js';

export async function buildSignedTransferSplFromOwnerBase58({
                                                                ownerPrivateKeyBase58,     // vendedor (firma)
                                                                mintAddress,
                                                                toPubkey,                  // comprador recibirá SPL
                                                                amount
                                                            }) {
    const owner = Keypair.fromSecretKey(bs58.decode(ownerPrivateKeyBase58));
    const mint = new PublicKey(mintAddress);
    const to = new PublicKey(toPubkey);

    const { blockhash } = await connection.getLatestBlockhash('finalized');

    const ownerAta = getAssociatedTokenAddressSync(mint, owner.publicKey);
    const toAta = getAssociatedTokenAddressSync(mint, to);

    const ixs = [];

    // Crea ATA del receptor si no existe
    let toAtaExists = true;
    try {
        await getAccount(connection, toAta, 'finalized', TOKEN_PROGRAM_ID);
    } catch {
        toAtaExists = false;
    }
    if (!toAtaExists) {
        ixs.push(createAssociatedTokenAccountInstruction(
            owner.publicKey, // payer = seller (paga renta)
            toAta,
            to,
            mint
        ));
    }

    // Evita transferirte a ti mismo
    if (ownerAta.toBase58() !== toAta.toBase58() && Number(amount) > 0) {
        ixs.push(createTransferInstruction(
            ownerAta, toAta, owner.publicKey, Number(amount)
        ));
    }

    const msg = new TransactionMessage({
        payerKey: owner.publicKey,       // el seller paga las fees de esta TX SPL
        recentBlockhash: blockhash,
        instructions: ixs
    }).compileToV0Message();

    const tx = new VersionedTransaction(msg);
    tx.sign([owner]);

    return {
        base58: txToBase58(tx),
        base64: txToBase64(tx),
        toAta: toAta.toBase58()
    };
}
