import { DataClean, Jsons } from "../../util.ts";
import { NocoDBUtil } from "./nocodbutil.ts";

// deno-lint-ignore no-namespace
export namespace WatchTable {
  type NocoDBTable = {
    baseurl: DataClean.HttpUrl;
    xc_token: string;
    base_name: string;
    table_name: string;
  };
  type NocoDBView = {
    baseurl: DataClean.HttpUrl;
    xc_token: string;
    base_name: string;
    table_name: string;
    view_name: string;
  };
  type CreateCtxParamSource = NocoDBView;
  type CreateCtxParamDistribute = NocoDBTable;
  type CreateCtxParamTaskRowData = {};
  type CreateCtxParamTaskRowDataFields<
    D extends CreateCtxParamTaskRowData = object
  > = string[];
  type JsonSchemaObj = {};
  type CreateCtxParamTaskBase = {};
  type CreateCtxParamTaskLlmreq<D extends CreateCtxParamTaskRowData = object> =
    CreateCtxParamTaskBase & {
      prompt_text_prefix: string;
      jsonschema: JsonSchemaObj;
      jsonschema_prompt: string;
      flatten: boolean;
      reset_on_diff: {
        fields: Array<
          | CreateCtxParamTaskRowDataFields<D>[number]
          | "prompt_text_prefix"
          | "jsonschema"
          | "jsonschema_prompt"
        >;
      };
    };
  type CreateCtxParamTaskManally = CreateCtxParamTaskBase & {
    manual:
      | "users"
      | {
          options: string[];
          multi: boolean;
        };
    reset_on_diff: {
      fields: Array<CreateCtxParamTaskRowDataFields[number]>;
    };
  };
  type CreateCtxParamTask =
    | CreateCtxParamTaskLlmreq
    | CreateCtxParamTaskManally;

  export type CreateCtxParam = {
    source: CreateCtxParamSource;
    distribute: CreateCtxParamDistribute;
    tasks: Array<CreateCtxParamTask>;
  };

  export function create_ctx(param: CreateCtxParam) {
    // const { source, distribute, tasks } = param;

    const _find_base = async (p: {
      baseurl: DataClean.HttpUrl;
      xc_token: string;
      base_name: string;
    }) => {
      for await (const _base_info of NocoDBUtil.list_bases({
        baseurl: p.baseurl,
        nocodb_token: p.xc_token,
      })) {
        if (_base_info.title === p.base_name) {
          return _base_info;
        }
      }
      return null;
    };

    const _find_table = async (p: {
      baseurl: DataClean.HttpUrl;
      xc_token: string;
      baseId: string;
      table_name: string;
    }) => {
      for await (const _table_info of NocoDBUtil.list_tables(
        {
          baseurl: p.baseurl,
          nocodb_token: p.xc_token,
        },
        p.baseId
      )) {
        if (_table_info.title === p.table_name) {
          return _table_info;
        }
      }
      return null;
    };

    const { source, distribute, tasks } = param;
    return {
      start_upgrade: async () => {
        const base_info = await _find_base({
          baseurl: source.baseurl,
          xc_token: source.xc_token,
          base_name: source.base_name,
        });
        if (base_info === null) {
          throw new Error(`NocoDB Base not found : ${Jsons.dump(source)}`);
        }
        const table_info = await _find_table({
          baseurl: source.baseurl,
          xc_token: source.xc_token,
          baseId: base_info.id,
          table_name: source.table_name,
        });
        if (table_info === null) {
          throw new Error(`NocoDB Table not found : ${Jsons.dump(source)}`);
        }
      },
    };
  }
}
