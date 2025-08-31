import db from "../src/config/db.js";

export const Memecoin = {
    async create(data) {
        const [row] = await db("memecoins").insert(data).returning("*");
        return row;
    },

    async findByMint(mint) {
        return db("memecoins").where({ mint }).first();
    },

    async markSold(id) {
        return db("memecoins").where({ id }).update({ is_sold: true });
    },
};
