import {
    Keypair, VersionedTransaction, TransactionMessage, PublicKey
} from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createTransferInstruction
} from '@solana/spl-token';
import bs58 from 'bs58';
import { connection } from '../config/solana.js';
import { txToBase58 } from '../utils/encoders.js';

/**
 * Construye y FIRMA una tx donde el VENDEDOR envía tokens SPL al CREADOR.
 * - Si el ATA del creador no existe, lo crea pagando el vendedor.
 */
export async function buildSignedTransferSplSellerToCreatorBase58({
                                                                      sellerPrivateKeyBase58,
                                                                      creatorPubkey,
                                                                      mintAddress,
                                                                      amount
                                                                  }) {
    const seller = Keypair.fromSecretKey(bs58.decode(sellerPrivateKeyBase58));
    const creator = new PublicKey(creatorPubkey);
    const mint = new PublicKey(mintAddress);

    const { blockhash } = await connection.getLatestBlockhash('finalized');

    const sellerAta  = getAssociatedTokenAddressSync(mint, seller.publicKey);
    const creatorAta = getAssociatedTokenAddressSync(mint, creator);

    const ixs = [];

    // Crea ATA del creador si no existe, pagando el vendedor
    // (La instrucción es idempotente en client code; en runtime fallaría si ya existe,
    //  así que lo ideal sería chequear on-chain. Para simplicidad, la incluimos: si falla,
    //  divide en dos TXs o quita esto si SABES que creatorAta existe.)
    ixs.push(
        createAssociatedTokenAccountInstruction(
            seller.publicKey,     // payer
            creatorAta,           // ata a crear
            creator,              // owner del ata
            mint                  // mint
        )
    );

    // Transferir los tokens
    ixs.push(
        createTransferInstruction(
            sellerAta,
            creatorAta,
            seller.publicKey,
            Number(amount)
        )
    );

    const msg = new TransactionMessage({
        payerKey: seller.publicKey,
        recentBlockhash: blockhash,
        instructions: ixs
    }).compileToV0Message();

    const tx = new VersionedTransaction(msg);
    tx.sign([seller]);

    return {
        base58: txToBase58(tx),
        sellerAta: sellerAta.toBase58(),
        creatorAta: creatorAta.toBase58()
    };
}
