import { LibianCrawlerDatabase, MediaPostTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";

export default create_migration<LibianCrawlerDatabase>({
  version: "20241225",
  ctb_mode: "create_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      MediaPostTable,
      "libian_crawler_cleaned.media_post"
    >("libian_crawler_cleaned.media_post", async (ctb) => {
      await ctb
        .add_column({
          col_name: "id",
          datatype: "varchar(750)",
          pk: true,
        })
        .add_column({
          col_name: "platform",
          datatype: "varchar(250)",
          nullable: false,
          indexed: "asc",
        })
        .add_column({
          col_name: "platform_duplicate_id",
          datatype: "varchar(500)",
          nullable: false,
          indexed: "asc",
        })
        .add_column({
          col_name: "create_time",
          datatype: "timestamptz",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "update_time",
          datatype: "timestamptz",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "count_read",
          datatype: "bigint",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "count_like",
          datatype: "bigint",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "count_share",
          datatype: "bigint",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "count_star",
          datatype: "bigint",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "count_comment",
          datatype: "bigint",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "video_total_count_danmaku",
          datatype: "bigint",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "video_total_duration_sec",
          datatype: "bigint",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "title",
          datatype: "text",
          nullable: false,
          indexed: "asc",
        })
        .ok()
        .execute();
    });
  },
  func_down: async () => {},
});
