// src/services/spl-create.service.js
import {
    Keypair, PublicKey, VersionedTransaction, TransactionMessage, SystemProgram
} from '@solana/web3.js';
import {
    getMinimumBalanceForRentExemptMint, MINT_SIZE, TOKEN_PROGRAM_ID,
    createInitializeMint2Instruction, getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction, createMintToInstruction
} from '@solana/spl-token';
import tokenMetadata from '@metaplex-foundation/mpl-token-metadata';
const {
    createCreateMetadataAccountV3Instruction,
    PROGRAM_ID: PKG_PROGRAM_ID, // puede venir undefined según versión
} = tokenMetadata;
const TOKEN_METADATA_PROGRAM_ID = PKG_PROGRAM_ID
    ? new PublicKey(PKG_PROGRAM_ID) // si existe en el paquete
    : new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
import bs58 from 'bs58';
import { connection } from '../config/solana.js';
import { txToBase58 } from '../utils/encoders.js';

export async function buildSignedCreateMintTxBase58({
                                                        creatorPrivateKeyBase58,
                                                        decimals = 6,
                                                        initialSupply = 1_000_000n,        // en unidades del token (no SOL)
                                                        name, symbol, uri                  // metadata opcional (Metaplex)
                                                    }) {
    const creator = Keypair.fromSecretKey(bs58.decode(creatorPrivateKeyBase58));
    const mint = Keypair.generate();

    const { blockhash } = await connection.getLatestBlockhash('finalized');

    // 1) Cuenta mint (rent + alloc)
    const mintRent = await getMinimumBalanceForRentExemptMint(connection);
    const createMintIx = SystemProgram.createAccount({
        fromPubkey: creator.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports: mintRent,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID
    });

    // 2) Init mint (mint authority = creator)
    const initMintIx = createInitializeMint2Instruction(
        mint.publicKey,
        decimals,
        creator.publicKey,
        null,               // freezeAuthority opcional
        TOKEN_PROGRAM_ID
    );

    // 3) ATA del creador
    const creatorAta = getAssociatedTokenAddressSync(mint.publicKey, creator.publicKey);
    const createAtaIx = createAssociatedTokenAccountInstruction(
        creator.publicKey, creatorAta, creator.publicKey, mint.publicKey
    );

    // 4) MintTo supply inicial
    const mintToIx = createMintToInstruction(
        mint.publicKey, creatorAta, creator.publicKey, Number(initialSupply)
    );

    const ixs = [createMintIx, initMintIx, createAtaIx, mintToIx];

    // 5) (Opcional) Metadata (Metaplex)
/*
    if (name && symbol && uri) {
        const [metadataPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.publicKey.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );
        const metaIx = createCreateMetadataAccountV3Instruction(
            {
                metadata: metadataPda,
                mint: mint.publicKey,
                mintAuthority: creator.publicKey,
                payer: creator.publicKey,
                updateAuthority: creator.publicKey
            },
            {
                createMetadataAccountArgsV3: {
                    data: {
                        name, symbol, uri,
                        creators: null, sellerFeeBasisPoints: 0, collection: null, uses: null
                    },
                    isMutable: true,
                    collectionDetails: null
                }
            }
        );
        ixs.push(metaIx);
    }
*/

    // Mensaje v0 y firma (mint también firma por la cuenta nueva)
    const msg = new TransactionMessage({
        payerKey: creator.publicKey,
        recentBlockhash: blockhash,
        instructions: ixs
    }).compileToV0Message();

    const tx = new VersionedTransaction(msg);
    tx.sign([creator, mint]);

    return {
        base58: txToBase58(tx),
        mint: mint.publicKey.toBase58(),
        creatorAta: creatorAta.toBase58()
    };
}
