import { DataClean, Strs } from "../../util.ts";
import { NocoDBUtil } from "./nocodbutil.ts";

// deno-lint-ignore no-namespace
export namespace EditableSheet {
  export type Field = {
    labelname: string;
    data_computed: {
      source: {
        mode: "input_from_nocodb_table";
      };
      //: boolean;
    };
  };

  export function def_sheet(param: {
    output_nocodb: {
      baseurl: DataClean.HttpUrl;
    } & NocoDBUtil.KnownOutputBaseTable;
    fields: Array<Field>;
    logd_fetch_noco: boolean;
  }) {
    const { output_nocodb, fields, logd_fetch_noco } = param;

    return {
      run_create_or_update_nocodb_base_and_table: async (param: {
        nocodb_token: string;
      }) => {
        const baseurl = output_nocodb.baseurl;
        const { nocodb_token } = param;
        const _find_base = async () => {
          for await (const _base_info of NocoDBUtil.list_bases({
            baseurl,
            nocodb_token,
            logd_fetch_noco,
          })) {
            if (_base_info.title === output_nocodb.base_title) {
              return _base_info;
            }
          }
          return null;
        };
        let base_info = await _find_base();
        while (base_info === null) {
          await NocoDBUtil.create_base(
            { baseurl, nocodb_token, logd_fetch_noco },
            { title: output_nocodb.base_title }
          );
          if (logd_fetch_noco) {
            console.debug("retry find after create", {
              base_info,
            });
          }
          base_info = await _find_base();
        }
        if (logd_fetch_noco) {
          console.debug("Success get nocodb base", {
            base_info,
          });
        }
        const _find_table = async () => {
          for await (const table of NocoDBUtil.list_tables(
            { baseurl, nocodb_token, logd_fetch_noco },
            base_info.id
          )) {
            if (table.title === output_nocodb.table_name) {
              return table;
            }
          }
          return null;
        };
        let table_info = await _find_table();
        // while (table_info === null) {
        // await NocoDBUtil.create_table(
        //   { baseurl, nocodb_token, logd_fetch_noco },
        //   base_info.id,
        //   {

        //   }
        // );
        //   table_info = await _find_table();
        // }
        if (logd_fetch_noco) {
          console.debug("Success get nocodb table", {
            base_info,
            table_info,
          });
        }
      },
    };
  }
}
