import 'dotenv/config';
import app from './app.js';
import {memecoinWokerVenta, memecoinWorker} from "./workers/memecoin.worker.js";
import {
    getHomeTimeline,
    getRandomTweetFromUsers,
    getTrendDetails,
    getTrendingTopics
} from "./services/twitter.service.js";

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`✅ Jito MS listening on http://localhost:${PORT}`);
    //setInterval(memecoinWorker, 300000);
    //setInterval(memecoinWokerVenta, 6000);
    //const result = await getRandomTweetFromUsers();
    //console.log(result);
    const trends = await getTrendingTopics(1);
    const trendsDetail = await getTrendDetails(trends[0].trend_name);
    const topicChoose = trendsDetail[0].text;
    console.log(trends)
});
