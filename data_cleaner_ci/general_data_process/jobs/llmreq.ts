import type { FromSchema, JSONSchema } from "json-schema-to-ts";
import {
  Arrays,
  DataClean,
  Errors,
  Jsons,
  Mappings,
  Strs,
} from "../../util.ts";
import OpenAI from "openai";
import { NocoDBUtil } from "../common/nocodbutil.ts";

// deno-lint-ignore no-namespace
export namespace LLMReq {
  export type RemoteConfig = {
    mode: "openai";
    base_url: string;
    api_key: string;
  } | {
    mode: "openwebui";
    url_of_api_chat_completions: DataClean.HttpUrl;
    authorization: `Bearer ${string}`;
  };

  export function is_valid_remote_config(o: unknown): o is RemoteConfig {
    if (typeof o !== "object" || o === null) {
      return false;
    }
    if (!("mode" in o) || o.mode !== "openai" && o.mode !== "openwebui") {
      return false;
    }
    if (o.mode === "openai") {
      if (
        !("base_url" in o && "api_key" in o) ||
        typeof o.base_url !== "string" || typeof o.api_key !== "string"
      ) {
        return false;
      } else {
        return true;
      }
    } else {
      if (
        !("url_of_api_chat_completions" in o && "authorization" in o) ||
        typeof o.url_of_api_chat_completions !== "string" ||
        typeof o.authorization !== "string"
      ) {
        return false;
      }
      try {
        DataClean.url_use_https_noempty(o.url_of_api_chat_completions);
      } catch (_e) {
        return false;
      }
      if (!Strs.startswith(o.authorization, "Bearer ")) {
        return false;
      }
      return true;
    }
  }

  export async function llmreq(_param: {
    http_client: Deno.HttpClient;
    remote: RemoteConfig;
    model: string;
    question: string;
    output_json_schema?: JSONSchema;
  }) {
    const { http_client, remote, model, question } = _param;
    if (!is_valid_remote_config(remote)) {
      Errors.throw_and_format("Invalid remote config", { remote });
    }
    let output = "";
    if (remote.mode === "openai") {
      const client = new OpenAI({
        fetchOptions: {
          client: http_client,
        },
        baseURL: remote.base_url,
        apiKey: remote.api_key,
      });
      const response = await client.chat.completions.create({
        model: model,
        stream: true,
        n: 1,
        messages: [
          { role: "user", content: question },
        ],
      });
      for await (const chunk of response) {
        // console.debug("chunk", chunk);
        for (const choise of chunk.choices) {
          const { content } = choise.delta;
          if (content) {
            output += content;
          }
        }
      }
      // console.debug("output", output);
      return {
        output,
      };
    } else if (remote.mode === "openwebui") {
      // TODO
    } else {
      throw new Error(`Invalid remote ${Jsons.dump(remote)}`);
    }
  }

  export async function create_cols_mapper_ctx<
    Properties extends string[],
    Columns extends (
      & {
        title: string;
        propmt_template: (
          string | { property: Properties[number] }
        )[];
      }
      & ({
        typ: "integer";
      } | {
        typ: "string";
      })
    )[],
  >(
    _param: {
      nocodb_fetch_option: NocoDBUtil.FetchOption;
      nctableId: string;
      ncviewId: string;
      columns: Columns;
      watch_properties: Properties;
    },
  ) {
    const { nocodb_fetch_option, ncviewId, nctableId, columns } = _param;
    if (!Arrays.length_greater_then_0(columns)) {
      Errors.throw_and_format("columns empty", _param);
    }
    for (const col of columns) {
      if (!new RegExp("([a-z0-9_])+").test(col.title)) {
        Errors.throw_and_format("Invalid col.title", { _param, col });
      }
    }
    const create_or_update_column_ctx = await NocoDBUtil
      .create_or_update_column_ctx({
        nocodb_fetch_option,
        nctableId,
        ncviewId,
      });
    const to_col_title = <S extends string>(title: S) => {
      return `llmreq_col_${title}` as const;
    };
    const init_columns = async () => {
      await create_or_update_column_ctx.create_or_update_column({
        body: {
          title: "llmreq_correct",
          column_name: "llmreq_correct",
          uidt: "MultiSelect",
          colOptions: {
            options: [
              ...columns.map((col) => ({
                title: to_col_title(col.title),
              })),
            ],
          },
        },
      });
      await create_or_update_column_ctx.create_or_update_column({
        body: {
          title: "llmreq_cache",
          column_name: "llmreq_cache",
          uidt: "JSON",
        },
      });
      for (const col of columns) {
        const title = to_col_title(col.title);
        await create_or_update_column_ctx.create_or_update_column({
          body: {
            title,
            column_name: title,
            uidt: col.typ === "string"
              ? "LongText"
              : col.typ === "integer"
              ? "Number"
              : Errors.throw_and_format("Invalid col.typ", _param),
          },
        });
      }
    };

    // deno-lint-ignore require-await
    const _create_llmreq_map_row_function = async () => {
      const llmreq_map_row = async <
        Property extends string = Properties[number],
        Row extends Record<Property, unknown> = Record<
          Property[number],
          unknown
        >,
      >(row: Row) => {
        const output_schema: JSONSchema = {
          type: "object",
          required: columns.map((col) => col.title),
          properties: Mappings.object_from_entries(columns.map((col) => {
            return [
              col.title,
              {
                type: col.typ,
              } satisfies JSONSchema,
            ] as const;
          })),
        };

        for (const column of columns) {
          const propmt_text = column.propmt_template.map((it) => {
            if (typeof it === "string") {
              return it;
            } else {
              const prop: Property = it.property as Property;
              if (prop in row) {
                const value = row[prop];
                if (typeof value === "string") {
                  return value;
                }
                if (typeof value === "undefined" || value === null) {
                  return "";
                }
                return `${Jsons.dump(value)}`;
              } else {
                Errors.throw_and_format("Not found property in row", {
                  prop,
                  row,
                });
              }
            }
          }).join("");
        }
      };
      return llmreq_map_row;
    };

    const create_llmreq_map_row_scope = async <R>(
      _param: {},
      cb: (
        _param: {
          llmreq_map_row: Awaited<
            ReturnType<typeof _create_llmreq_map_row_function>
          >;
        },
      ) => Promise<R>,
    ) => {
      try {
        const llmreq_map_row = await _create_llmreq_map_row_function();
        return await cb({
          llmreq_map_row,
        });
      } finally {
        //
      }
    };

    return {
      init_columns,
      create_llmreq_map_row_scope,
    } as const;
  }
}
