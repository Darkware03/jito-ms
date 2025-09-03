import db from "../config/db.js";
import { getTrendingTopics, getTrendDetails } from "../services/twitter.service.js";
import { runCurl } from "../helpers/gmgn.curl.js";
import { createTokenService, sellTokenBundleService } from "../services/pumpfun.service.js";

export async function memecoinWorker() {
    try {
        console.log("⏳ Ejecutando worker de memecoins COMPRA...");
                  console.log("⏳ Ejecutando worker de memecoins...");
        // 1️⃣ Buscar si hay tokens en estado "created"
        const existing = await db("memecoins")
            .where({ status: "created" })
            .orderBy("created_at", "asc")
            .first();

        if (existing) {
        console.log(`⚠️ Ya existe token pendiente de venta: ${existing.symbol} (${existing.mint}), no se realizara la compra`);
        return;
        }
        // 2️⃣ Obtener trending topics
        const trends = await getTrendingTopics(process.env.WOEID);
        let trendsDetail = null;
        let topicChoose = null;

        for (const trend of trends) {
            try {
                if (trend.trend_name.startsWith('$')) continue; // ⚠️ Saltar cashtags
                trendsDetail = await getTrendDetails(trend.trend_name);
                topicChoose = trendsDetail[0].text;
                break;
            } catch (err) {
                console.warn(`⚠️ No se pudo procesar trending "${trend.trend_name}": ${err.message}`);
            }
        }

        if (!trendsDetail || !topicChoose) {
            console.log("❌ No se encontró un trending válido para crear token.");
            return;
        }

        // 3️⃣ Llamar gmgn para icon
        const result = await runCurl({
            user_prompt: null,
            desc_info: topicChoose,
            need_icon: true,
            need_text: true,
        });

        if (!result?.data?.icon) {
            console.log("⚠️ No se generó icono.");
            return;
        }

        const buffer = Buffer.from(result.data.icon, "base64");
        const image = {
            buffer,
            mimetype: "image/png",
            filename: `${result.data.symbol || "token"}.png`,
        };

        // 4️⃣ Wallets
        const wallets = [
            {
                privatekey: process.env.CREATOR_WALLET,
                amount: parseFloat(process.env.CREATOR_AMOUNT ?? "0.01"),
            },
        ];
        const priorityFeeCreate = parseFloat(process.env.PFEECREATE ?? "0.001");
        const priorityFeeOthers = parseFloat(process.env.PFEEOTHER ?? "0.0005");

        // 5️⃣ Crear token
        const created = await createTokenService({
            wallets,
            image,
            name: result.data.name,
            symbol: result.data.symbol,
            description: result.data.name,
            priorityFeeCreate,
            priorityFeeOthers,
            twitter:`${process.env.TWITTER_BASE_URL}/${trends[0].id}`
        });

        // 6️⃣ Guardar en DB
        const [row] = await db("memecoins")
            .insert({
                name: created.name ?? result.data.name,
                symbol: created.symbol ?? result.data.symbol,
                mint: created.mint,
                status: "created",
                created_at: db.fn.now(),
            })
            .returning("*");

        console.log("✅ Token creado:", row);

        // 7️⃣ Intentar vender después de 6s
        setTimeout(async () => {
            try {
                const sold = await sellTokenBundleService({
                    wallets: [
                        {
                            privatekey: process.env.CREATOR_WALLET,
                            percent: parseFloat(process.env.CREATOR_AMOUNT ?? "100"),
                        },
                    ],
                    mint: created.mint,
                    denominatedInSol: "false",
                    slippage: 30,
                    priorityFeeFirst: priorityFeeCreate,
                    priorityFeeOthers: priorityFeeOthers,
                    pool: "pump",
                });

                await db("memecoins").where({ id: row.id }).update({
                    status: "sold",
                    sold_at: db.fn.now(),
                    sell_explorer_urls: JSON.stringify(sold.explorerUrls),
                });

                console.log("💸 Token vendido:", created.mint);
            } catch (err) {
                console.error("❌ Error en venta automática:", err.message);
            }
        }, 6000);
    } catch (err) {
        console.error("❌ Error en worker:", err.message);
    }
}

export async function memecoinWokerVenta(){
          console.log("⏳ Ejecutando worker de memecoins VENTA...");
        // 1️⃣ Buscar si hay tokens en estado "created"
        const existing = await db("memecoins")
            .where({ status: "created" })
            .orderBy("created_at", "asc")
            .first();

        if (existing) {
            console.log(`⚠️ Ya existe token pendiente de venta: ${existing.symbol} (${existing.mint})`);

            // ⏳ Reintentar venta cada 6s hasta que se venda
            setTimeout(async () => {
                try {
                    const wallets = [
                        {
                            privatekey: process.env.CREATOR_WALLET,
                            // usamos % de venta en base al amount configurado
                            percent: parseFloat(process.env.CREATOR_AMOUNT ?? "100"),
                        },
                    ];

                    const sold = await sellTokenBundleService({
                        wallets,
                        mint: existing.mint,
                        denominatedInSol: "false",
                        slippage: 30,
                        priorityFeeFirst: parseFloat(process.env.PFEECREATE ?? "0.001"),
                        priorityFeeOthers: parseFloat(process.env.PFEEOTHER ?? "0.0005"),
                        pool: "pump",
                    });

                    await db("memecoins").where({ id: existing.id }).update({
                        status: "sold",
                        sold_at: db.fn.now(),
                        sell_explorer_urls: JSON.stringify(sold.explorerUrls),
                    });

                    console.log("💸 Token vendido:", existing.mint);
                } catch (err) {
                    console.error("❌ Reintento de venta fallido:", err.message);
                }
            }, 6000);

            return; // 🚫 No crear nada nuevo si ya hay uno pendiente
        }
}