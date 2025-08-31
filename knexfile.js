import 'dotenv/config';

export default {
    development: {
        client: process.env.DB_CLIENT || 'pg',
        connection: {
            host: process.env.DB_HOST || 'localhost',
            port: +(process.env.DB_PORT || 5432),
            database: process.env.DB_DATABASE || 'bot',
            user: process.env.DB_USER || 'bot_user',
            password: process.env.DB_PASSWORD || 'bot_password',
        },
        pool: { min: 2, max: 10 },
        migrations: { directory: './migrations' },
        seeds: { directory: './seeds' },
    }
};