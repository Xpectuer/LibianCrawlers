import { LibianCrawlerDatabase, MediaPostTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";
import { sql } from "kysely";

export default create_migration<LibianCrawlerDatabase>({
  version: "20250828112700",
  ctb_mode: "alter_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      MediaPostTable,
      "libian_crawler_cleaned.media_post"
    >("libian_crawler_cleaned.media_post", async (ctb) => {
      await ctb
        .add_column({
          col_name: "attach_docs",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "attach_docs_markdown",
          datatype: "text",
          nullable: true,
          indexed: undefined,
        })
        .ok()
        .execute();
    });
  },
  func_down: async () => {},
});
