import { LibianCrawlerDatabase, ShopGoodTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";
import { sql } from "kysely";

export default create_migration<LibianCrawlerDatabase>({
  version: "20250307003800",
  ctb_mode: "create_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      ShopGoodTable,
      "libian_crawler_cleaned.shop_good"
    >("libian_crawler_cleaned.shop_good", async (ctb) => {
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
          nullable: false,
          indexed: "asc",
        })
        .add_column({
          col_name: "update_time",
          datatype: "timestamptz",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "good_id",
          datatype: "varchar(500)",
          nullable: false,
          indexed: "asc",
        })
        .add_column({
          col_name: "good_name",
          datatype: "text",
          nullable: false,
          indexed: "asc",
        })
        .add_column({
          col_name: "shop_id",
          datatype: "varchar(500)",
          nullable: false,
          indexed: "asc",
        })
        .add_column({
          col_name: "shop_name",
          datatype: "text",
          nullable: false,
          indexed: "asc",
        })
        .add_column({
          col_name: "search_from",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "good_images",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "good_first_image_url",
          datatype: "varchar(1000)",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "sku_list",
          datatype: "jsonb",
          nullable: false,
          default_value: () => sql`'[]'::jsonb`,
        })
        .add_column({
          col_name: "sku_min_price_cny001",
          datatype: "bigint",
          nullable: false,
          indexed: "asc",
        })
        .add_column({
          col_name: "sku_max_price_cny001",
          datatype: "bigint",
          nullable: false,
          indexed: "asc",
        })
        .ok()
        .execute();
    });
  },
  func_down: async () => {},
});
