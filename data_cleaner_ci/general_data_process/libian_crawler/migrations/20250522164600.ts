import { LibianCrawlerDatabase, ChatMessageTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";
import { sql } from "kysely";

export default create_migration<LibianCrawlerDatabase>({
  version: "20250522164600",
  ctb_mode: "alter_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      ChatMessageTable,
      "libian_crawler_cleaned.chat_message"
    >("libian_crawler_cleaned.chat_message", async (ctb) => {
      await ctb
        .add_column({
          col_name: "create_date",
          datatype: "date",
          nullable: true,
          indexed: "asc",
        })
        .ok()
        .execute();
    });
  },
  func_down: async () => {},
});
