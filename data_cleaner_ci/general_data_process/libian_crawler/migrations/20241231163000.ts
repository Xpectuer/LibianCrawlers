import { MediaPostTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";

export default create_migration({
  version: "20241231163000",
  ctb_mode: "alter_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      MediaPostTable,
      "libian_crawler_cleaned.media_post"
    >("libian_crawler_cleaned.media_post", async (ctb) => {
      await ctb
        .add_column({
          col_name: "context_text_latest_lines_count",
          datatype: "integer",
          nullable: true,
          indexed: "asc",
        })
        .ok()
        .execute();
    });
  },
  func_down: async () => {},
});
