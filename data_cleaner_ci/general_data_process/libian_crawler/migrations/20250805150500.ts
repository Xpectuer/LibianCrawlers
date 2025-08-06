import { LibianCrawlerDatabase, LiteratureTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";
import { sql } from "kysely";

export default create_migration<LibianCrawlerDatabase>({
  version: "20250805150500",
  ctb_mode: "alter_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      LiteratureTable,
      "libian_crawler_cleaned.literature"
    >("libian_crawler_cleaned.literature", async (ctb) => {
      await ctb
        .add_column({
          col_name: "issn_list_joined",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "issn_list",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .ok()
        .execute();
    });
  },
  func_down: async () => {},
});
