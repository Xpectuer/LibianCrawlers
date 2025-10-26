import { LibianCrawlerDatabase, MediaPostTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";
import { sql } from "kysely";

export default create_migration<LibianCrawlerDatabase>({
  version: "20251026232700",
  ctb_mode: "alter_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      MediaPostTable,
      "libian_crawler_cleaned.media_post"
    >("libian_crawler_cleaned.media_post", async (ctb) => {
      await ctb
        .add_column({
          col_name: "comment_level",
          datatype: "integer",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "comment_count_sub",
          datatype: "integer",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "comment_parent_id",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .ok()
        .execute();
    });
  },
  func_down: async () => {},
});
