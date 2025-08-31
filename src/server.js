import 'dotenv/config';
import app from './app.js';
import {memecoinWorker} from "./workers/memecoin.worker.js";

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Jito MS listening on http://localhost:${PORT}`);
    setInterval(memecoinWorker, 60000);
});
