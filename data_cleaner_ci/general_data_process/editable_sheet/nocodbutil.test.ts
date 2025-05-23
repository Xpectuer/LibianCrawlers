import { NocoDBUtil } from "./nocodbutil.ts";
import { TestUtil } from "../../util.ts";

const { nocodb_baseurl, nocodb_token } = await TestUtil.read_vars();

Deno.test({
  ignore: !nocodb_token && !nocodb_baseurl,
  name: "list_bases_test",
  fn: async () => {
    for await (const item of NocoDBUtil.list_bases({
      baseurl: nocodb_baseurl,
      nocodb_token,
    })) {
      console.debug("item", item);
    }
  },
});

Deno.test({
  ignore: !nocodb_token && !nocodb_baseurl,
  name: "list_tables_and_views_test",
  fn: async () => {
    for await (const base_info of NocoDBUtil.list_bases({
      baseurl: nocodb_baseurl,
      nocodb_token,
    })) {
      console.debug("----------------------------------");
      console.debug("base", base_info);
      for await (const table_info of NocoDBUtil.list_tables(
        {
          baseurl: nocodb_baseurl,
          nocodb_token,
        },
        base_info.id
      )) {
        console.debug("table", table_info);
      }
    }
  },
});
// Deno.test({
//   ignore: !nocodb_token,
//   name: "def_and_run_my_test_editable_sheet",
//   fn: async () => {
//     //
//   },
// });
