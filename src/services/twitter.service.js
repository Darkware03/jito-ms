import fetch from 'node-fetch';

const WOEID = 23424807;
const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const USERNAMES = (process.env.TWITTER_USER_TO_LISTEN || "").split(',').map(u => u.trim());

export async function getTrendingTopics(woeid,maxTrends=50) {
    const url = `https://api.x.com/2/trends/by/woeid/${woeid}?max_trends=${maxTrends}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
        },
    });

    const data = await res.json();

    if (data.errors) {
        throw new Error(
            `Twitter API error: ${data.errors[0]?.message || 'Unknown error'}`
        );
    }

    return data.data;
}

export async function getTrendDetails(trendName) {
    const url = `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(trendName)}&max_results=10`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
        },
    });
    const data = await res.json();
    if (data.errors) throw new Error(`Twitter API error: ${data.errors[0]?.message || 'Unknown error'}`);
    return data.data;
}

async function getUserId(username) {
    const url = `https://api.twitter.com/2/users/by/username/${username}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
        },
    });

    const data = await res.json();
    if (data.errors) {
        console.error(`❌ Error al obtener ID de ${username}:`, data.errors[0]?.detail || 'Desconocido');
        return null;
    }

    return data.data.id;
}

async function getLatestTweets(userId, username) {
    const url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=5&tweet.fields=created_at,public_metrics`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
        },
    });
    const data = await res.json();
    if (data.errors) {
        console.error(`❌ Error al obtener tweets de ${username}:`, data.errors[0]?.detail || 'Desconocido');
        return [];
    }

    return (data.data || []).map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        like_count: tweet.public_metrics?.like_count,
        retweet_count: tweet.public_metrics?.retweet_count,
        username,
    }));
}

export async function getRandomTweetFromUsers() {
    let allTweets = [];

    for (const username of USERNAMES) {
        const userId = await getUserId(username);
        if (!userId) continue;

        const tweets = await getLatestTweets(userId, username);
        allTweets.push(...tweets);
    }

    if (allTweets.length === 0) {
        return { error: true, message: "No se encontraron tweets de los usuarios configurados." };
    }

    const random = allTweets[Math.floor(Math.random() * allTweets.length)];
    return { success: true, tweet: random };
}


import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
dotenv.config();

const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

const userClient = client.readWrite;

export async function getHomeTimeline() {
    try {
        const timeline = await userClient.v2.homeTimeline({
            max_results: 2,
        });
        console.log(timeline.data.data)
        return timeline.data;
    } catch (err) {
        console.error('❌ Error obteniendo timeline:', err?.data || err);
        return { error: true, message: err.message };
    }
}
