import { MediaPostTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";
import { sql } from "kysely";

export default create_migration({
  version: "20241227",
  ctb_mode: "alter_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      MediaPostTable,
      "libian_crawler_cleaned.media_post"
    >("libian_crawler_cleaned.media_post", async (ctb) => {
      await ctb
        .add_column({
          col_name: "titles",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "title_timeline",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "content_link_url",
          datatype: "text",
          nullable: true,
        })
        .add_column({
          col_name: "content_link_urls",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "from_search_questions",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "ip_location",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "author_first_unique_user_id",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "author_first_platform_user_id",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "author_first_nickname",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "author_first_avater_url",
          datatype: "text",
          nullable: true,
        })
        .add_column({
          col_name: "author_first_home_link_url",
          datatype: "text",
          nullable: true,
        })
        .add_column({
          col_name: "authors",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'{}'::jsonb`,
        })
        .add_column({
          col_name: "cover_first_url",
          datatype: "text",
          nullable: true,
        })
        .add_column({
          col_name: "cover_urls",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "platform_rank_score_timeline",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "tag_texts",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "tag_text_joined",
          datatype: "text",
          nullable: false,
          indexed: "asc",
          default_value: () => "",
        })
        .ok()
        .execute();
    });
  },
  func_down: async () => {},
});
