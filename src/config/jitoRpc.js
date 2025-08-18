import 'dotenv/config';

export async function jitoRpc(method, params = []) {
    const body = { jsonrpc: '2.0', id: Date.now(), method, params };

    const res = await fetch(process.env.LIL_JIT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.error) throw new Error(`${method}: ${data.error.message}`);
    return data.result;
}
