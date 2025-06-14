import { LibianCrawlerDatabase, LiteratureTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";
import { sql } from "kysely";

export default create_migration<LibianCrawlerDatabase>({
  version: "20250614192800",
  ctb_mode: "create_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      LiteratureTable,
      "libian_crawler_cleaned.literature"
    >("libian_crawler_cleaned.literature", async (ctb) => {
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
          datatype: "text",
          nullable: false,
          indexed: "asc",
        })
        .add_column({
          col_name: "last_crawl_time",
          datatype: "timestamptz",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "crawl_from_platform",
          datatype: "varchar(250)",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "title",
          datatype: "text",
          nullable: false,
          indexed: "asc",
        })
        .add_column({
          col_name: "languages",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "languages_joined",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "create_year",
          datatype: "integer",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "international_standard_serial_number",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "international_standard_book_number",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "china_standard_serial_number",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "publication_organizer",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "publication_place",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "keywords",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "keywords_joined",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "count_published_documents",
          datatype: "integer",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "count_download_total",
          datatype: "integer",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "count_citations_total",
          datatype: "integer",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "impact_factor_latest",
          datatype: "decimal",
          nullable: true,
          indexed: "asc",
        })
        .ok()
        .execute();
    });
  },
  func_down: async () => {},
});
