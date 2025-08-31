export async function up(knex) {
    await knex.schema.createTable("memecoins", (table) => {
        table.increments("id").primary();
        table.string("name").notNullable();
        table.string("symbol").notNullable();
        table.text("mint").nullable();
        table.boolean("is_sold").defaultTo(false);
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
}

export async function down(knex) {
    await knex.schema.dropTableIfExists("memecoins");
}
