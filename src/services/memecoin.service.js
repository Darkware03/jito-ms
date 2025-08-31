import { Memecoin } from "../../models/memecoin.model.js";
import { createTokenService, sellTokenBundleService } from "./pumpfun.service.js";

export async function handleMemecoinLifecycle(params) {
    const { name, symbol, description, wallets, image, priorityFeeCreate, priorityFeeOthers } = params;

    // 1) Buscar si ya existe por symbol
    const existing = await db("memecoins").where({ symbol }).first();

    if (!existing) {
        // 2) Crear token en Pump.fun
        const created = await createTokenService({
            wallets,
            image,
            name,
            symbol,
            description,
            priorityFeeCreate,
            priorityFeeOthers,
        });

        // 3) Guardar en DB
        await Memecoin.create({
            name,
            symbol,
            mint: created.mint,
            signatures: JSON.stringify(created.signatures),
            ipfs_uri: created.ipfs?.metadataUri,
            raw_response: created,
        });

        return { action: "buy", data: created };
    }

    // 4) Si ya existe, esperar 6 segundos antes de vender
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const sellRes = await sellTokenBundleService({
        wallets,
        mint: existing.mint,
        denominatedInSol: "false",
        slippage: 30,
        pool: "pump",
    });

    await Memecoin.markSold(existing.id);

    return { action: "sell", data: sellRes };
}
