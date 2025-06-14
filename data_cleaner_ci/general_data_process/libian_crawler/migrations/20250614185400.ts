import { LibianCrawlerDatabase, MediaPostTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";

export default create_migration<LibianCrawlerDatabase>({
  version: "20250614185400",
  ctb_mode: "alter_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      MediaPostTable,
      "libian_crawler_cleaned.media_post"
    >("libian_crawler_cleaned.media_post", async (ctb) => {
      await ctb
        .add_column({
          col_name: "literature_first_issn",
          datatype: "varchar(256)",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "literature_first_isbn",
          datatype: "varchar(1024)",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "literature_first_cnsn",
          datatype: "varchar(1024)",
          nullable: true,
          indexed: "asc",
        })
        .ok()
        .execute();
    });
  },
  func_down: async () => {},
});
