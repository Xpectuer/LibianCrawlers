import { MediaPostTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";
import { sql } from "kysely";

export default create_migration({
  version: "20241231",
  ctb_mode: "alter_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      MediaPostTable,
      "libian_crawler_cleaned.media_post"
    >("libian_crawler_cleaned.media_post", async (ctb) => {
      await ctb
        .add_column({
          col_name: "content_text_timeline_count",
          datatype: "integer",
          nullable: false,
          default_value: () => 0,
          indexed: "asc",
        })
        .add_column({
          col_name: "context_text_latest_str_length",
          datatype: "integer",
          nullable: false,
          default_value: () => 0,
          indexed: "asc",
        })
        .add_column({
          col_name: "context_text_latest",
          datatype: "text",
          nullable: true,
        })
        .add_column({
          col_name: "content_text_deleted_at_least_once",
          datatype: "boolean",
          nullable: false,
          default_value: () => false,
          indexed: "asc",
        })
        .add_column({
          col_name: "content_text_deleted_first_time",
          datatype: "timestamptz",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "content_text_resume_after_deleted",
          datatype: "boolean",
          nullable: false,
          default_value: () => false,
          indexed: "asc",
        })
        .add_column({
          col_name: "content_text_timeline",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "content_text_summary_uncleaned_timeline",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "content_text_detail_uncleaned_timeline",
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
