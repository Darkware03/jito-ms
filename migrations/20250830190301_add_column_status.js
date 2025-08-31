export async function up(knex) {
    await knex.schema.alterTable("memecoins", (table) => {
        table.string("status").defaultTo("created"); // nuevo campo
        table.text("error_log").nullable(); // opcional, para registrar errores
        table.timestamp("sold_at").nullable(); // cuándo se vendió
        table.text("sell_explorer_urls").nullable(); // urls de venta
    });
}

export async function down(knex) {
    await knex.schema.alterTable("memecoins", (table) => {
        table.dropColumn("status");
        table.dropColumn("error_log");
        table.dropColumn("sold_at");
        table.dropColumn("sell_explorer_urls");
    });
}
