import db from "../config/db.js";
import { Keypair, VersionedTransaction, Connection, PublicKey } from "@solana/web3.js";
import bs58 from 'bs58';
import { parseLooseObject, toStrictJSON } from "../utils/parsed.util.js";

export async function testPumpService() {
    // 1️⃣ Borrar todos los registros de user_wallet
    await db("user_wallet").del();

    // 2️⃣ Consultar los estados
    const states = await db("user_wallet")
        .select("*")
        .orderBy("created_at", "asc");

    // 3️⃣ Retornar respuesta
    return {
        message: "test realizado con exito",
        states
    };
}

export async function createWalletPumpPortal() {
    const response = await fetch(`${process.env.PUMPFUN_BASE_URL}/api/create-wallet`, {
        method: 'GET'
    });
    if(!response.ok){
        throw new Error(`PumpPortal HTTP ${response.status} ${response.statusText}`)
    }
    const data = await response.json();
    return data;
}

export async function createWalletService() {
    const adminUser = await db('user')
        .select('id')
        .where({ email: 'admin@local.test' })
        .first();

    if (!adminUser) {
        throw new Error('Usuario administrador no encontrado en la base de datos');
    }

    const data = await createWalletPumpPortal();

    const [row] = await db('user_wallet')
        .insert({
            user_id: adminUser.id,
            public_key: data.walletPublicKey,
            private_key: data.privateKey,
            api_key: data.apiKey,
            is_active: true
        })
        .returning('*');

    return { wallet: row }
}

export async function getWalletsService() {
    // Consulta todos los registros de la tabla state
    const wallets = await db("user_wallet").select("*").orderBy("created_at", "asc");
    return {
        wallets
    };
}

// ===== Helpers =====
let lastJitoSendAt = 0;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function rateGate(minIntervalMs = 1000) {
    const now = Date.now();
    const wait = Math.max(0, lastJitoSendAt + minIntervalMs - now);
    if (wait > 0) await sleep(wait);
    lastJitoSendAt = Date.now();
}

async function sendBundleWithBackoff(encodedSignedTransactions, url, maxTries = 6) {
    let delay = 800;
    for (let i = 0; i < maxTries; i++) {
        await rateGate(1000); // 1 req/seg
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'sendBundle',
                params: [encodedSignedTransactions],
            }),
        });
        if (res.ok) return { ok: true, status: res.status };
        if (res.status !== 429) {
            const txt = await res.text().catch(() => '');
            return { ok: false, status: res.status, text: txt };
        }
        const jitter = Math.floor(Math.random() * 250);
        await sleep(Math.min(delay + jitter, 10_000));
        delay = Math.min(delay * 2, 10_000);
    }
    return { ok: false, status: 429, text: 'rate limited after retries' };
}

async function sendEachViaRpc(encodedSignedTransactions, rpcUrl) {
    const conn = new Connection(rpcUrl, 'confirmed');
    const sigs = [];
    for (const b58 of encodedSignedTransactions) {
        const raw = bs58.decode(b58);
        const sig = await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
        sigs.push(sig);
    }
    return sigs;
}

// 🔹 ADDED: polling hasta confirmed/finalized
async function waitForConfirmations(rpcUrl, signatures, timeoutMs = 90_000) {
    const conn = new Connection(rpcUrl, 'confirmed');
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        const { value } = await conn.getSignatureStatuses(signatures);
        const done = value.every(v => v && (v.confirmationStatus === 'confirmed' || v.confirmationStatus === 'finalized'));
        if (done) return value;
        await sleep(1200);
    }
    return null; // timeout
}

// ===== Servicio principal =====
export async function createTokenService(params) {
    const {
        wallets,
        image,
        name,
        symbol,
        description,
        twitter = '',
        telegram = '',
        website = '',
    } = params;


    if (!Array.isArray(wallets) || wallets.length < 1) {
        throw new Error('Debes proporcionar al menos 1 private key en wallets[]');
    }
    if (wallets.length > 5) {
        throw new Error('Solo puedes usar hasta 5 wallets');
    }
    if (!image?.buffer) {
        throw new Error('Falta el archivo de imagen (image.buffer).');
    }
    const walletsParsed = wallets.map((item, i) => {
        try {
            return parseLooseObject(item)
        } catch (e) {
            throw new Error(`Wallet #${i} inválido: ${e.message} | entrada corregida: ${toStrictJSON(item)}`);
        }
    })
    // Keypairs desde base58 (SECRET keys)
    const signerKeyPairs = walletsParsed.map((w, i) => {
        try {
            const raw = bs58.decode(w.privatekey);
            const keypair = Keypair.fromSecretKey(Uint8Array.from(raw));
            return {
                ...w,
                keypair
            }
        } catch (e) {
            throw new Error(`Private key base58 inválida en índice ${i}: ${e.message}`);
        }
    });
    // Subida IPFS
    const fileBlob = new Blob([image.buffer], { type: image.mimetype || 'application/octet-stream' });
    const formData = new FormData();
    formData.append('file', fileBlob, image.filename || 'image.png');
    formData.append('name', name);
    formData.append('symbol', symbol);
    formData.append('description', description);
    formData.append('twitter', twitter);
    formData.append('telegram', telegram);
    formData.append('website', website);
    formData.append('showName', 'true');



    const ipfsRes = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: formData });
    if (!ipfsRes.ok) {
        const txt = await ipfsRes.text().catch(() => '');
        throw new Error(`Error IPFS: ${ipfsRes.status} ${ipfsRes.statusText} ${txt}`);
    }
    const ipfsJson = await ipfsRes.json();
    if (!ipfsJson?.metadataUri) {
        throw new Error('Respuesta IPFS inválida (sin metadataUri).');
    }

    // Config PumpPortal (igual que ejemplo oficial)
    const CREATE_DENOM_IN_SOL = "true";
    const CREATE_SLIPPAGE     = 30;
    const CREATE_PRIORITYFEE  = params.priorityFeeCreate; // tip alto; si sigue duro, prueba 0.01
    const POOL                = "pump";

    const BUY_DENOM_IN_SOL    = "false";
    const BUY_SLIPPAGE        = 30;
    const BUY_PRIORITYFEE     = params.priorityFeeOthers;

    // Bundle
    const mintKeypair = Keypair.generate();
    const bundledTxArgs = [{
        publicKey: signerKeyPairs[0].keypair.publicKey.toBase58(),
        action: 'create',
        tokenMetadata: { name, symbol, uri: ipfsJson.metadataUri },
        mint: mintKeypair.publicKey.toBase58(),
        denominatedInSol: CREATE_DENOM_IN_SOL,
        amount: signerKeyPairs[0].amount,
        slippage: CREATE_SLIPPAGE,
        priorityFee: CREATE_PRIORITYFEE,
        pool: POOL,
    }];
    if (signerKeyPairs.length > 1) {
        for (let i = 1; i < signerKeyPairs.length; i++) {
            bundledTxArgs.push({
                publicKey: signerKeyPairs[i].keypair.publicKey.toBase58(),
                action: 'buy',
                mint: mintKeypair.publicKey.toBase58(),
                denominatedInSol: BUY_DENOM_IN_SOL,
                amount: signerKeyPairs[i].amount,
                slippage: BUY_SLIPPAGE,
                priorityFee: BUY_PRIORITYFEE,
                pool: POOL,
            });
        }
    }
    // trade-local
    const tradeRes = await fetch('https://pumpportal.fun/api/trade-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundledTxArgs),
    });
    if (!tradeRes.ok) {
        const txt = await tradeRes.text().catch(() => '');
        throw new Error(`Error trade-local: ${tradeRes.status} ${tradeRes.statusText} ${txt}`);
    }
    const rawTxs = await tradeRes.json();

    // Firmar
    const encodedSignedTransactions = [];
    const signatures = [];
    for (let i = 0; i < rawTxs.length; i++) {
        const tx = VersionedTransaction.deserialize(new Uint8Array(bs58.decode(rawTxs[i])));
        if (bundledTxArgs[i].action === 'create') {
            tx.sign([mintKeypair, signerKeyPairs[0].keypair]);
        } else {
            tx.sign([signerKeyPairs[i].keypair]);
        }
        encodedSignedTransactions.push(bs58.encode(tx.serialize()));
        signatures.push(bs58.encode(tx.signatures[0]));
    }

    // Envío a Jito con backoff y fallback RPC
    const JITO_URL = process.env.JITO_BUNDLE_URL ?? 'https://mainnet.block-engine.jito.wtf/api/v1/bundles';
    const RPC_URL  = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';

    const jitoRes = await sendBundleWithBackoff(encodedSignedTransactions, JITO_URL);
    const jitoStatus = jitoRes.status;

    // 🔹 ADDED: espera confirmación hasta 30s; si no, rebroadcast
    let finalSigs = [...signatures];
    const statuses = await waitForConfirmations(RPC_URL, signatures, 30_000); // 30s de margen
    if (!statuses) {
        try {
            const rebSig = await sendEachViaRpc(encodedSignedTransactions, RPC_URL);
            finalSigs = rebSig;
            // vuelve a esperar confirmación otros 60s
            await waitForConfirmations(RPC_URL, rebSig, 60_000);
        } catch (e) {
            // si el blockhash ya caducó, toca regenerar bundle (opcional hacerlo aquí)
            if (!/blockhash/i.test(String(e?.message || ''))) throw e;
        }
    }

    return {
        ok: true,
        mint: mintKeypair.publicKey.toBase58(),
        signatures: finalSigs,
        explorerUrls: finalSigs.map(s => `https://solscan.io/tx/${s}`),
        jitoStatus,
        ipfs: { metadataUri: ipfsJson.metadataUri },
    };
}

// ===== Venta por bundles (múltiples wallets con amounts distintos) =====
/**
 * 🚀 Servicio para vender tokens por amount o percent
 */
export async function sellTokenBundleService(params) {
    const {
        wallets,              // [{ privatekey, amount }] o [{ privatekey, percent }]
        mint,                 // mint del token a vender
        denominatedInSol = "false",
        slippage = 30,
        priorityFeeFirst = 0.00005,
        priorityFeeOthers = 0.0,
        pool = "pump",
    } = params;

    if (!mint) throw new Error('Debes proporcionar el mint del token a vender.');
    if (!Array.isArray(wallets) || wallets.length < 1) {
        throw new Error('Debes proporcionar al menos 1 wallet.');
    }
    if (wallets.length > 5) {
        throw new Error('Solo puedes usar hasta 5 wallets');
    }

    const RPC_URL = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';
    const conn = new Connection(RPC_URL, 'confirmed');
    const mintPubkey = new PublicKey(mint);

    // 1) Parsear wallets
    const walletsParsed = wallets.map((item, i) => {
        try {
            return parseLooseObject(item);
        } catch (e) {
            throw new Error(`Wallet #${i} inválido: ${e.message} | entrada corregida: ${toStrictJSON(item)}`);
        }
    });

    // 2) Decodificar claves
    const signerEntries = walletsParsed.map((w, i) => {
        try {
            const raw = bs58.decode(w.privatekey);
            if (raw.length !== 64) throw new Error(`SecretKey debe tener 64 bytes (tiene ${raw.length})`);
            const keypair = Keypair.fromSecretKey(raw);
            return { ...w, keypair };
        } catch (e) {
            throw new Error(`Private key inválida en wallet #${i}: ${e.message}`);
        }
    });

    // 3) Calcular amounts
    const validEntries = [];
    for (const entry of signerEntries) {
        let finalAmount = entry.amount;

        // Si viene percent → calcular balance primero
        if (entry.percent) {
            try {
                const tokenAccounts = await conn.getTokenAccountsByOwner(entry.keypair.publicKey, {
                    mint: mintPubkey,
                });

                if (tokenAccounts.value.length === 0) {
                    console.warn(`⚠️ Wallet ${entry.keypair.publicKey.toBase58()} no tiene cuenta para ${mint}`);
                    continue;
                }

                // Normalmente solo hay una cuenta asociada
                const accountInfo = tokenAccounts.value[0].account.data;
                const balanceResp = await conn.getTokenAccountBalance(tokenAccounts.value[0].pubkey);
                const balance = parseInt(balanceResp.value.amount, 10);

                if (!balance || balance <= 0) {
                    console.warn(`⚠️ Wallet ${entry.keypair.publicKey.toBase58()} balance 0 de ${mint}`);
                    continue;
                }

                if (entry.percent >= 100) {
                    finalAmount = balance - 1; // deja 1 token
                } else {
                    finalAmount = Math.floor((balance * entry.percent) / 100);
                }
                console.log(`✅ Wallet ${entry.keypair.publicKey.toBase58()} balance=${balance}, percent=${entry.percent}%, sell=${finalAmount}`);
            } catch (e) {
                console.warn(`⚠️ Error leyendo balance de ${entry.keypair.publicKey.toBase58()}: ${e.message}`);
                continue;
            }
        }

        if (typeof finalAmount !== 'number' || finalAmount <= 0) {
            console.warn(`⚠️ Wallet ${entry.keypair.publicKey.toBase58()} sin amount válido, ignorada`);
            continue;
        }

        validEntries.push({ ...entry, amount: finalAmount });
    }

    if (validEntries.length === 0) {
        throw new Error('Ninguna wallet tiene balance o amount válido para vender.');
    }

    // 4) Construir bundle
    const bundledTxArgs = validEntries.map((entry, i) => ({
        publicKey: entry.keypair.publicKey.toBase58(),
        action: 'sell',
        mint,
        denominatedInSol,
        amount: '100%',
        slippage,
        priorityFee: i === 0 ? priorityFeeFirst : priorityFeeOthers,
        pool,
    }));

    // 5) Llamar PumpPortal trade-local
    const tradeRes = await fetch('https://pumpportal.fun/api/trade-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundledTxArgs),
    });
    if (!tradeRes.ok) {
        const txt = await tradeRes.text().catch(() => '');
        throw new Error(`Error trade-local: ${tradeRes.status} ${tradeRes.statusText} ${txt}`);
    }
    const rawTxs = await tradeRes.json();

    // 6) Firmar transacciones
    const encodedSignedTransactions = [];
    const signatures = [];
    for (let i = 0; i < rawTxs.length; i++) {
        const tx = VersionedTransaction.deserialize(bs58.decode(rawTxs[i]));
        tx.sign([validEntries[i].keypair]);
        encodedSignedTransactions.push(bs58.encode(tx.serialize()));
        signatures.push(bs58.encode(tx.signatures[0]));
    }

    // 7) Enviar a Jito y confirmar
    const JITO_URL = process.env.JITO_BUNDLE_URL ?? 'https://mainnet.block-engine.jito.wtf/api/v1/bundles';
    const jitoRes = await sendBundleWithBackoff(encodedSignedTransactions, JITO_URL);
    const jitoStatus = jitoRes.status;

    let finalSigs = [...signatures];
    const statuses = await waitForConfirmations(RPC_URL, signatures, 30_000);
    if (!statuses) {
        try {
            const rebSig = await sendEachViaRpc(encodedSignedTransactions, RPC_URL);
            finalSigs = rebSig;
            await waitForConfirmations(RPC_URL, rebSig, 60_000);
        } catch (e) {
            if (!/blockhash/i.test(String(e?.message || ''))) throw e;
        }
    }

    return {
        ok: true,
        signatures: finalSigs,
        explorerUrls: finalSigs.map(s => `https://solscan.io/tx/${s}`),
        jitoStatus,
    };
}