import { LibianCrawlerDatabase, ChatMessageTable } from "../data_storage.ts";
import { create_migration } from "../data_storage_migration.ts";
import { sql } from "kysely";

export default create_migration<LibianCrawlerDatabase>({
  version: "20250520165400",
  ctb_mode: "create_table",
  func_up: async (ctx) => {
    await ctx.create_or_alter_table<
      ChatMessageTable,
      "libian_crawler_cleaned.chat_message"
    >("libian_crawler_cleaned.chat_message", async (ctb) => {
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
          col_name: "content_plain_text",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "content_img_url",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_sendfrom_platform_id",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_sendfrom_nickname",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_sendfrom_avater_url",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_sendto_platform_id",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_sendto_nickname",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_sendto_avater_url",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "group_sendto_platform_id",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "group_sendto_nickname",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "group_sendto_avater_url",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_employer_platform_id",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_employer_nickname",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_employer_avater_url",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_employee_platform_id",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_employee_nickname",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_employee_avater_url",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_customer_platform_id",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_customer_nickname",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .add_column({
          col_name: "user_customer_avater_url",
          datatype: "text",
          nullable: true,
          indexed: "asc",
        })
        .ok()
        .execute();
    });
  },
  func_down: async () => {},
});
