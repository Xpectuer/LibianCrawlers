import { LibianCrawlerDatabase, ShopGoodTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";

export default create_migration<LibianCrawlerDatabase>({
  version: "20250307155000",
  ctb_mode: "alter_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      ShopGoodTable,
      "libian_crawler_cleaned.shop_good"
    >("libian_crawler_cleaned.shop_good", async (ctb) => {
      await ctb
        .add_column({
          col_name: "link_url",
          datatype: "varchar(1300)",
          indexed: "asc",
          nullable: true,
        })
        .ok()
        .execute();
    });
  },
  func_down: async () => {},
});
