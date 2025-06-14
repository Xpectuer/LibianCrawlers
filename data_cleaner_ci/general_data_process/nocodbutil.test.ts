import { NocoDBDataset, NocoDBUtil } from "./nocodbutil.ts";
import { TestUtil } from "../util.ts";

const { nocodb_baseurl, nocodb_token, list_table_records_test_conf } =
  await TestUtil.read_vars();
const ignore = !nocodb_token && !nocodb_baseurl;

Deno.test({
  ignore,
  name: "list_bases_test",
  fn: async () => {
    if (ignore) {
      return;
    }
    for await (
      const item of NocoDBUtil.list_bases({
        baseurl: nocodb_baseurl,
        nocodb_token,
      })
    ) {
      console.debug("item", item);
    }
  },
});

Deno.test({
  ignore,
  name: "list_tables_and_views_test",
  fn: async () => {
    if (ignore) {
      return;
    }
    for await (
      const base_info of NocoDBUtil.list_bases({
        baseurl: nocodb_baseurl,
        nocodb_token,
      })
    ) {
      console.debug("----------------------------------");
      console.debug("base", base_info);
      for await (
        const table_info of NocoDBUtil.list_tables(
          {
            baseurl: nocodb_baseurl,
            nocodb_token,
          },
          base_info.id,
        )
      ) {
        console.debug("table", table_info);
        for await (
          const ncview of NocoDBUtil.list_views({
            baseurl: nocodb_baseurl,
            nocodb_token,
          }, table_info.id)
        ) {
          console.debug("view", ncview);
        }
      }
    }
  },
});

Deno.test({
  ignore,
  name: "list_table_records",
  fn: async () => {
    if (ignore) {
      return;
    }

    if (!list_table_records_test_conf) {
      return;
    }
    let count = 0;
    for await (
      const item of NocoDBUtil.list_table_records(
        {
          baseurl: nocodb_baseurl,
          nocodb_token,
          logd_fetch_noco: true,
        },
        list_table_records_test_conf.tableId,
        list_table_records_test_conf.viewId,
      )
    ) {
      ++count;
      console.debug("item", {
        item,
        count,
      });
      if (count > 60) {
        break;
      }
    }
  },
});
