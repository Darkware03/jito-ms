import { spawn } from "child_process";

export function runCurl({ user_prompt, desc_info, need_icon = true, need_text = false }) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ user_prompt, desc_info, need_icon, need_text });
        const COOKIES = "__cf_bm=...; cf_clearance=...; _ga=...; _ga_UGLVBMV4Z0=...";

        const args = [
            "-s", "-X", "POST",
            "https://gmgn.ai/xapi/v1/sol/query_meme_param?device_id=1ff7fedf-4bf6-4cb2-af6a-4ad8483e9f1c&fp_did=d224134683e3ea6c515f956363c07f5a&client_id=gmgn_web_20250828-3135-dfafdce&from_app=gmgn&app_ver=20250828-3135-dfafdce&tz_name=America%2FEl_Salvador&tz_offset=-21600&app_lang=es&os=web",
            "-H", "Accept: application/json",
            "-H", "Accept-Encoding: identity",
            "-H", "Content-Type: application/json",
            "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
            "-H", "Origin: https://gmgn.ai",
            "-H", "Referer: https://gmgn.ai/?chain=sol",
            "-H", `Cookie: ${COOKIES}`,
            "--data-raw", body
        ];

        const curl = spawn("curl", args);

        let data = "";
        curl.stdout.on("data", chunk => {
            data += chunk.toString();
        });

        curl.stderr.on("data", err => {
            console.error("⚠️ stderr:", err.toString());
        });

        curl.on("close", () => {
            try {
                resolve(JSON.parse(data));
            } catch {
                resolve(data);
            }
        });
    });
}
