import { runCurl } from "../helpers/gmgn.curl.js";
import {getTrendDetails, getTrendingTopics} from "../services/twitter.service.js";
import {generarTokenMemecoin} from "../services/openai.service.js";
import {extractJsonFromText} from "./openai.controller.js";
import {createTokenService} from "../services/pumpfun.service.js";

export async function getMemeParam(req, res) {
    try {
        const { user_prompt, desc_info, need_icon, need_text } = req.body;

        const result = await runCurl({
            user_prompt,
            desc_info,
            need_icon,
            need_text,
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.toString() });
    }
}


export async function createToken(req, res) {
    try {
        const wallets = []
        const priorityFeeCreate = parseFloat(process.env.PFEECREATE ?? "0.001");
        const priorityFeeOthers = parseFloat(process.env.PFEEOTHER ?? "0.0005");

        wallets.push(
            {
                "privatekey": process.env.CREATOR_WALLET,
                "amount": process.env.CREATOR_AMOUNT
            }
        );
        // 1️⃣ Obtener trending topics y detalle
        const trends = await getTrendingTopics(1);
        const trendsDetail = await getTrendDetails(trends[0].trend_name);
        const topicChoose = trendsDetail[0].text;
        // 3️⃣ Ejecutar runCurl para generar el ícono
        const result = await runCurl({
            user_prompt: null,
            desc_info: topicChoose,
            need_icon: true,
            need_text: true,
        });
        // 4️⃣ Convertir base64 del ícono a Buffer
        if (!result?.data?.icon) {
            return res.status(400).json({ ok: false, error: "No se generó icono." });
        }

        const base64Icon = result.data.icon; // string base64
        const buffer = Buffer.from(base64Icon, "base64");

        const image = {
            buffer,
            mimetype: "image/png", // asumimos PNG porque gmgn devuelve PNG
            filename: `${result.symbol || "token"}.png`,
        };


        // 5️⃣ Crear token en Pump.fun
        const resultadoCreateToken = await createTokenService({
            wallets,
            image,
            name: result.data.name,
            symbol: result.data.symbol,
            description: result.name ,
            priorityFeeCreate,
            priorityFeeOthers,
        });

        return res.json(resultadoCreateToken);
    } catch (err) {
        console.error("❌ Error en createToken:", err);
        return res
            .status(500)
            .json({ ok: false, error: err.message || "Error inesperado" });
    }
}
