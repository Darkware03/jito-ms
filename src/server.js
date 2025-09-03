import 'dotenv/config';
import app from './app.js';
import {memecoinWokerVenta, memecoinWorker} from "./workers/memecoin.worker.js";
import {getRandomTweetFromUsers} from "./services/twitter.service.js";

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`✅ Jito MS listening on http://localhost:${PORT}`);
    setInterval(memecoinWorker, 120000);
    setInterval(memecoinWokerVenta, 6000);
    //const result = await getRandomTweetFromUsers();
    //console.log(result);

});
