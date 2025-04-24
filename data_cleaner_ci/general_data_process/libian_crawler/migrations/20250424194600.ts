import { LibianCrawlerDatabase, MediaPostTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";

export default create_migration<LibianCrawlerDatabase>({
  version: "20250424194600",
  ctb_mode: "alter_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      MediaPostTable,
      "libian_crawler_cleaned.media_post"
    >("libian_crawler_cleaned.media_post", async (ctb) => {
      await ctb
        .add_column({
          col_name: "literature_first_journal",
          datatype: "varchar(1024)",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "literature_first_doi",
          datatype: "varchar(1024)",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "literature_first_category",
          datatype: "varchar(1024)",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "literature_first_level_of_evidence",
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
