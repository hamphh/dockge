import { Knex } from "knex";

export function up(knex: Knex) {
    return knex.schema.table("agent", function (table) {
        table.string("name");
    });
}

export function down(knex: Knex) {
    return knex.schema.table("agent", function (table) {
        table.dropColumn("name");
    });
}
