// gmgn.service.js
const axios = require("axios");

// 🔑 Copia aquí tus cookies válidas desde el navegador
const COOKIES = "__cf_bm=toMsD8AZ8p5VxqJjNZVgQTL8z5CbVkjNTU8JJ5JTgW0-1756416973-1.0.1.1-3KnHDrmJlM_w.OowMiwnUlrgRoO3tdr3OVUAHb2RlCiiuHauTYKIDq0UH102iY.FZXlUtfgC3xBdYnR_jjo7BWkruB6Pbq6u0gklvRIX5DY; cf_clearance=Olz1XuycMkd0YLLRUOFmtIFsjnf9BnKTnO2uuKh0ZVY-1756416620-1.2.1.1-MuCrI6pDYub4tjLgSqGyGvoli8pRFGxzKHTkU9V.JD6J7DFbhP4npINPXAvj_UftvwaDEIaYbcDheqvbNlZG6NO.pQH_2yTj.EQbwnbJlTtSS1A_WmG_6tP49zrxu18WGt1i7G3RbMyZXURe6Y5fuGOc4YK7dzWlr6c355u.jZTXJVRfXHxnPfr99JMcvukdw9Hruji4DaHgghi8Rjt8NibBjkZn2xEzvzq2WMfd.ZM; _ga=GA1.1.657206926.1755044352; _ga_UGLVBMV4Z0=GS1.2.1756416321854707.09530bd0ab53eda89cabc63c94fb4201.3ghHe8YawYeT%2Bb4YaVg3Iw%3D%3D.Ax0rgygq%2FBqBXqMPThmr3g%3D%3D.RYDEXZU0nyLcOcjGSna6%2Fg%3D%3D.PvHJmG7l9JnjKf4iKQovEw%3D%3D";

export async function queryMemeParam({ user_prompt, desc_info, need_icon, need_text }) {
    try {
        const url =
            "https://gmgn.ai/xapi/v1/sol/query_meme_param?device_id=1ff7fedf-4bf6-4cb2-af6a-4ad8483e9f1c&fp_did=d224134683e3ea6c515f956363c07f5a&client_id=gmgn_web_20250828-3135-dfafdce&from_app=gmgn&app_ver=20250828-3135-dfafdce&tz_name=America%2FEl_Salvador&tz_offset=-21600&app_lang=es&os=web";

        const response = await axios.post(
            url,
            {
                user_prompt,
                desc_info,
                need_icon,
                need_text,
            },
            {
                headers: {
                    Accept: "application/json",
                    "Accept-Encoding": "identity",
                    "Content-Type": "application/json",
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
                    Origin: "https://gmgn.ai",
                    Referer: "https://gmgn.ai/?chain=sol",
                    Cookie: COOKIES,
                },
            }
        );

        return response.data;
    } catch (error) {
        console.error("❌ Error llamando a gmgn.ai:", error.message);
        return { success: false, error: error.message };
    }
}

