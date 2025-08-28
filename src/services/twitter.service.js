import fetch from 'node-fetch';

const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const WOEID = 23424807;

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