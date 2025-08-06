import { delay } from "@std/async/delay";
import {
  Arrays,
  DataClean,
  Errors,
  is_deep_equal,
  is_nullish,
  Jsons,
  Mappings,
  Nums,
  Streams,
  Strs,
  Times,
  Typings,
} from "../util.ts";

// deno-lint-ignore no-namespace
export namespace NocoDBUtil {
  export type NcBase = ReturnType<typeof NocoDBUtil.list_bases> extends // deno-lint-ignore no-explicit-any
  AsyncGenerator<infer T, any, any> ? T
    : unknown;

  export type NcTable = ReturnType<typeof NocoDBUtil.list_tables> extends // deno-lint-ignore no-explicit-any
  AsyncGenerator<infer T, any, any> ? T
    : unknown;

  export type NcView = ReturnType<typeof NocoDBUtil.list_views> extends // deno-lint-ignore no-explicit-any
  AsyncGenerator<infer T, any, any> ? T
    : unknown;

  export type NcColumn = ReturnType<typeof NocoDBUtil.list_columns> extends // deno-lint-ignore no-explicit-any
  AsyncGenerator<infer T, any, any> ? T
    : unknown;

  export type NcColumnMetaData = Awaited<
    ReturnType<typeof NocoDBUtil.get_column_metadata>
  >;

  export type NcColumnWithMetaData = NocoDBUtil.NcColumn & {
    __metadata__: NocoDBUtil.NcColumnMetaData;
  };

  export type FetchOption = {
    baseurl: DataClean.HttpUrl;
    nocodb_token: string;
    logd_fetch_noco?: boolean;
  };

  export const ui_types = [
    ["ID", "nocodb_id"],
    ["LinkToAnotherRecord", "unknown"],
    ["ForeignKey", "unknown"],
    ["Lookup", "unknown"],
    ["SingleLineText", "string"],
    ["LongText", "string"],
    ["Attachment", "unknown"],
    ["Checkbox", "unknown"],
    ["MultiSelect", "MultiSelect"],
    ["SingleSelect", "unknown"],
    ["Collaborator", "unknown"],
    ["Date", "unknown"],
    ["Year", "unknown"],
    ["Time", "unknown"],
    ["PhoneNumber", "unknown"],
    ["GeoData", "unknown"],
    ["Email", "unknown"],
    ["URL", "string"],
    ["Number", "number"],
    ["Decimal", "number"],
    ["Currency", "unknown"],
    ["Percent", "unknown"],
    ["Duration", "unknown"],
    ["Rating", "unknown"],
    ["Formula", "unknown"],
    ["Rollup", "unknown"],
    ["Count", "unknown"],
    ["DateTime", "string"],
    ["AutoNumber", "unknown"],
    ["Geometry", "unknown"],
    ["JSON", "JSON"],
    ["SpecificDBType", "unknown"],
    ["Barcode", "unknown"],
    ["QrCode", "unknown"],
    ["Button", "unknown"],
    ["Links", "unknown"],
    ["User", "unknown"],
    ["CreatedTime", "CreatedTime"],
    ["LastModifiedTime", "LastModifiedTime"],
    ["CreatedBy", "CreatedBy"],
    ["LastModifiedBy", "LastModifiedBy"],
    ["Order", "unknown"],
  ] as const;

  export function is_ui_types_key(
    s: string,
  ): s is typeof ui_types[number][0] {
    return ui_types.find((it) => it[0] === s) !== undefined;
  }

  export type UITypesValueType<
    T extends string & typeof ui_types[number][1],
  > = T extends "unknown" ? unknown
    : T extends "string" ? string | null
    : T extends "number" ? number | null
    : T extends "nocodb_id" ? number | `${number}`
    : T extends "CreatedTime" ? string | undefined
    : T extends "LastModifiedTime" ? string | undefined
    : T extends "CreatedBy" ? string | undefined
    : T extends "LastModifiedBy" ? string | undefined
    : T extends "MultiSelect" ? string | null
    : T extends "JSON" ? Jsons.JSONValue
    : never;

  export type UITypes = {
    [K in typeof ui_types[number][0]]: UITypesValueType<
      Extract<
        typeof ui_types[number],
        Typings.DeepReadonly<[K, string]>
      >[1]
    >;
  };

  export type CreateTableOpt = {
    table_name?: string;
    columns: Array<
      Omit<
        {
          title: string;
          uidt: keyof UITypes;
          description: string | null;
          /**
           * FieldTypeDefaultValue : Column Default Value. Defaults to NULL
           */
          cdf: string | null;
          /**
           * FieldTypePrimaryValue : Set this column as primary value. Defaults to FALSE
           */
          pv: false;
          /**
           * FieldTypeRequired : Set this column as required. Defaults to FALSE
           */
          rqd: boolean | null;
        },
        never
      >
    >;
    description?: string;
    title: string;
  };
  type RouteOptionalParam<
    S extends string,
    K extends string,
    V extends string | number,
  > =
    | `${S}`
    | `${S}&${K}=${V}`;
  export type CreateColumnsBody =
    & {
      title: string;
      column_name: string;
      description?: string;
    }
    & ({
      uidt: keyof UITypes;
    } | {
      uidt: "MultiSelect";
      colOptions: {
        options: MultiSelectColOptionsCreatingItem[];
      };
    });
  export type Route =
    | {
      method: "GET";
      pth: `/api/v2/meta/bases?page=${number}`;
    }
    | {
      method: "POST";
      pth: `/api/v2/meta/bases`;
      body: {
        title: string;
        description?: string;
      };
    }
    | {
      method: "GET";
      pth: `/api/v2/meta/bases/${string}/tables`;
    }
    | {
      method: "POST";
      pth: `/api/v2/meta/bases/${string}/tables`;
      body: CreateTableOpt;
    }
    | {
      method: "GET";
      pth: `/api/v2/meta/tables/${string}/views`;
    }
    | {
      method: "GET";
      pth: `/api/v2/meta/views/${string}/columns`;
    }
    | {
      method: "GET";
      pth: `/api/v2/meta/columns/${string}`;
    }
    | {
      method: "GET";
      pth: RouteOptionalParam<
        RouteOptionalParam<
          `/api/v2/tables/${string}/records?offset=${number}&limit=${number}`,
          "viewId",
          string
        >,
        "where",
        string
      >;
    }
    | {
      method: "POST";
      pth: `/api/v2/tables/${string}/records`;
      body: {
        [k in string]: unknown;
      }[];
    }
    | {
      method: "PATCH";
      pth: `/api/v2/tables/${string}/records`;
      body: {
        [k in "Id" | string]: k extends "Id" ? string : unknown;
      }[];
    }
    | {
      method: "DELETE";
      pth: `/api/v2/tables/${string}/records`;
      body: {
        Id: number;
      }[];
    }
    | {
      method: "POST";
      pth: `/api/v2/meta/tables/${string}/columns`;
      body: CreateColumnsBody;
    }
    | {
      method: "PATCH";
      pth: `/api/v2/meta/columns/${string}`;
      body: CreateColumnsBody;
    };

  const _fetch_noco = async <R>(
    param: FetchOption & {
      route: Route;
      on_status_not_200?: (
        resp: Awaited<ReturnType<typeof fetch>>,
      ) => Promise<R> | Promise<"raise">;
    },
  ) => {
    const { route, nocodb_token, logd_fetch_noco, on_status_not_200 } = param;
    const baseurl = Strs.remove_suffix_recursion(param.baseurl, "/");
    const fetch_url = `${baseurl}${route.pth}` as const;
    const req_body = "body" in route ? Jsons.dump(route.body) : null;

    let res_json: unknown = null;
    let res_json_success: boolean = false;

    const resp = await fetch(fetch_url, {
      method: route.method,
      headers: {
        "xc-token": nocodb_token,
        "content-type": "application/json;charset=utf-8",
      },
      body: req_body,
    });

    const raise_err = (reason: string, cause?: unknown) => {
      Errors.throw_and_format(reason, {
        status: resp.status,
        route: param.route,
        fetch_url,
        req_body,
        res_json_success,
        res_json,
        param,
        resp,
      }, cause);
    };

    const resp_body = await resp.bytes();
    let res_text: string;
    try {
      res_text = new TextDecoder().decode(resp_body);
    } catch (err) {
      res_text = "";
      raise_err(`Failed parse resp text , resp body is ${resp_body}`, err);
    }

    if (resp.status !== 200) {
      if (resp.status === 504) {
        // 高频请求使我的 nginx 反代报错 504，这里不管了，无限重试得了。
        console.warn("Retry on fetch nocodb resp 504:", {
          resp,
        });
        await delay(3000);
        return await _fetch_noco(param);
      }
      if (on_status_not_200) {
        const res = await on_status_not_200(resp);
        if (res === "raise") {
          raise_err("Failed fetch nocodb on after call on_status_not_200(resp)");
        } else {
          return {
            res_json: res,
            resp,
          };
        }
      } else {
        raise_err("Failed fetch nocodb");
      }
    }

    try {
      res_json = Jsons.load(res_text);
      res_json_success = true;
    } catch (err) {
      res_json = null;
      res_json_success = false;
      raise_err(`Failed parse json , resp text body is ${res_text}`, err);
    }

    if (logd_fetch_noco) {
      console.debug("Success fetch nocodb", {
        route: param.route,
        code: resp.status,
        res_json_success,
        res_json,
      });
    }
    return {
      res_json,
      resp,
    };
  };

  function _parse_page_info_field(res_json: unknown) {
    if (
      typeof res_json === "object" &&
      res_json &&
      "pageInfo" in res_json &&
      typeof res_json.pageInfo === "object" &&
      res_json.pageInfo &&
      "page" in res_json.pageInfo &&
      typeof res_json.pageInfo.page === "number" &&
      "totalRows" in res_json.pageInfo &&
      typeof res_json.pageInfo.totalRows === "number" &&
      "pageSize" in res_json.pageInfo &&
      typeof res_json.pageInfo.pageSize === "number" &&
      "isFirstPage" in res_json.pageInfo &&
      typeof res_json.pageInfo.isFirstPage === "boolean" &&
      "isLastPage" in res_json.pageInfo &&
      typeof res_json.pageInfo.isLastPage === "boolean"
    ) {
      return {
        totalRows: res_json.pageInfo.totalRows,
        page: res_json.pageInfo.page,
        pageSize: res_json.pageInfo.pageSize,
        isFirstPage: res_json.pageInfo.isFirstPage,
        isLastPage: res_json.pageInfo.isLastPage,
      };
    } else {
      throw new Error(
        `PageInfo invalid , res_json is ${
          Jsons.dump(
            res_json,
            { indent: 2 },
          )
        }`,
      );
    }
  }

  function _parse_list_field<T>(
    res_json: unknown,
    check_item: (it: unknown) => it is T,
  ) {
    if (
      typeof res_json === "object" &&
      res_json &&
      "list" in res_json &&
      Array.isArray(res_json.list)
    ) {
      const list: unknown[] = res_json.list;
      const items: T[] = [];
      for (const item of list) {
        if (check_item(item)) {
          items.push(item);
        } else {
          throw new Error(
            `List Item invalid , item is ${
              Jsons.dump(
                item,
                { indent: 2 },
              )
            } , res_json is ${
              Jsons.dump(
                res_json,
                { indent: 2 },
              )
            }`,
          );
        }
      }
      return items;
    } else {
      throw new Error(`List invalid , res_json is ${
        Jsons.dump(
          res_json,
          { indent: 2 },
        )
      }`);
    }
  }

  async function* _read_pages<T, NoPage extends true | false>(
    param: FetchOption & {
      no_page: NoPage;
      page_check_offset?: NoPage extends false ? boolean | undefined
        : false | undefined;
      get_route: (page: NoPage extends true ? undefined : number) => Route;
      on_pageInfo?: NoPage extends false ? (pageInfo: {
          totalRows: number;
          page: number;
          pageSize: number;
          isFirstPage: boolean;
          isLastPage: boolean;
        }) => Promise<void>
        : undefined;
    },
    typeguard: (it: unknown) => it is T,
  ) {
    let page = 0;
    while (true) {
      const fetch_noco_param = {
        ...param,
        // deno-lint-ignore no-explicit-any
        route: param.get_route((param.no_page ? undefined : page) as any),
      } as const;
      try {
        const { res_json } = await _fetch_noco(fetch_noco_param);

        const pageInfo = param.no_page
          ? null
          : _parse_page_info_field(res_json);
        // if (param.page_check_offset !== true) {
        //   if (pageInfo && pageInfo.page !== page) {
        //     throw new Error(
        //       `Page not match , var value is ${page} , but pageInfo is ${
        //         JSON.stringify(
        //           pageInfo,
        //         )
        //       }`,
        //     );
        //   }
        // } else {
        if (pageInfo) {
          if (pageInfo.page !== page + 1) {
            Errors.throw_and_format(`Page not match`, {
              page,
              pageInfo,
            });
          }
          if (param.on_pageInfo) {
            await param.on_pageInfo(pageInfo);
          }
        }
        // }
        const items = _parse_list_field(res_json, typeguard);
        for (const item of items) {
          yield item;
        }
        if (pageInfo === null || pageInfo.isLastPage) {
          break;
        }
        page++;
      } catch (err) {
        throw new Error(
          `Error on fetch page ${page} , fetch_noco_param is ${
            JSON.stringify(
              fetch_noco_param,
            )
          }`,
          {
            cause: err,
          },
        );
      }
    }
  }

  export async function* list_bases(param: FetchOption) {
    yield* _read_pages(
      {
        ...param,
        no_page: false,
        get_route(page) {
          return {
            method: "GET",
            pth: `/api/v2/meta/bases?page=${page}`,
          };
        },
      },
      (it): it is { title: string; id: string } => {
        return (
          typeof it === "object" &&
          it !== null &&
          "title" in it &&
          typeof it.title === "string" &&
          "id" in it &&
          typeof it.id === "string"
        );
      },
    );
  }

  export async function create_base(
    param: FetchOption,
    opt: {
      title: string;
      description?: string;
    },
  ) {
    await _fetch_noco({
      ...param,
      route: {
        method: "POST",
        pth: "/api/v2/meta/bases",
        body: opt,
      },
    });
  }

  export async function* list_tables(param: FetchOption, baseId: string) {
    yield* _read_pages(
      {
        ...param,
        no_page: true,
        get_route() {
          return {
            method: "GET",
            pth: `/api/v2/meta/bases/${baseId}/tables`,
          };
        },
      },
      (it): it is { title: string; id: string } => {
        return (
          typeof it === "object"
          // it !== null &&
          // "title" in it &&
          // typeof it.title === "string" &&
          // "id" in it &&
          // typeof it.id === "string"
        );
      },
    );
  }

  export async function create_table(
    param: FetchOption,
    baseId: string,
    opt: CreateTableOpt,
  ) {
    await _fetch_noco({
      ...param,
      route: {
        method: "POST",
        pth: `/api/v2/meta/bases/${baseId}/tables`,
        body: opt,
      },
    });
  }

  export async function* list_views(param: FetchOption, tableId: string) {
    yield* _read_pages(
      {
        ...param,
        no_page: true,
        get_route() {
          return {
            method: "GET",
            pth: `/api/v2/meta/tables/${tableId}/views`,
          };
        },
      },
      (it): it is { title: string; id: string } => {
        return (
          typeof it === "object" &&
          it !== null &&
          "title" in it &&
          typeof it.title === "string" &&
          "id" in it &&
          typeof it.id === "string"
        );
      },
    );
  }

  export async function* list_columns(param: FetchOption, viewId: string) {
    yield* _read_pages(
      {
        ...param,
        no_page: true,
        get_route() {
          return {
            method: "GET",
            pth: `/api/v2/meta/views/${viewId}/columns`,
          };
        },
      },
      (it): it is { fk_column_id: string; id: string; show: boolean } => {
        return (
          typeof it === "object" &&
          it !== null &&
          "fk_column_id" in it &&
          typeof it.fk_column_id === "string" &&
          "id" in it &&
          typeof it.id === "string" &&
          "show" in it &&
          typeof it.show === "boolean"
        );
      },
    );
  }

  export type MultiSelectColOptionsCreatingItem = {
    title: string;
    // fk_column_id: FkColumnId;
    color?: string;
    order?: number;
    // id: string;
    // base_id: BaseId;
  };

  export type MultiSelectColOptions<
    FkColumnId extends string = string,
    BaseId extends string = string,
  > = {
    options: {
      title: string;
      fk_column_id: FkColumnId;
      color: string;
      order: number;
      id: string;
      base_id: BaseId;
    }[];
  };

  export function is_valid_multi_select_col_options(
    o: unknown,
  ): o is MultiSelectColOptions {
    if (
      !(typeof o === "object" && o !== null && "options" in o &&
        Array.isArray(o.options))
    ) {
      return false;
    }
    let fk_column_id: string | undefined = undefined;
    let base_id: string | undefined = undefined;
    for (const _item of o.options) {
      const item: unknown = _item;
      if (
        !(typeof item === "object" &&
          item !== null &&
          "title" in item &&
          typeof item.title === "string" &&
          "fk_column_id" in item &&
          typeof item.fk_column_id === "string" &&
          "color" in item &&
          typeof item.color === "string" &&
          "order" in item &&
          typeof item.order === "number" &&
          "id" in item &&
          typeof item.id === "string" &&
          "base_id" in item &&
          typeof item.base_id === "string")
      ) {
        return false;
      }
      if (typeof fk_column_id === "undefined") {
        fk_column_id = item.fk_column_id;
      }
      if (fk_column_id !== item.fk_column_id) {
        return false;
      }
      if (typeof base_id === "undefined") {
        base_id = item.base_id;
      }
      if (base_id !== item.base_id) {
        return false;
      }
    }
    return true;
  }

  export async function get_column_metadata(
    param: FetchOption,
    fkColumnId: string,
  ) {
    const { res_json, resp } = await _fetch_noco({
      ...param,
      route: { method: "GET", pth: `/api/v2/meta/columns/${fkColumnId}` },
      // deno-lint-ignore require-await
      on_status_not_200: async (resp) => {
        if (resp.status === 404) {
          return null;
        } else {
          return "raise";
        }
      },
    });
    if (res_json === null) {
      return null;
    }
    if (
      typeof res_json === "object" &&
      "title" in res_json && typeof res_json.title === "string" &&
      "uidt" in res_json && typeof res_json.uidt === "string" &&
      NocoDBUtil.is_ui_types_key(res_json.uidt)
    ) {
      if (res_json.uidt === "MultiSelect") {
        if (
          "colOptions" in res_json &&
          is_valid_multi_select_col_options(res_json.colOptions)
        ) {
          return {
            ...res_json,
            title: res_json.title,
            uidt: res_json.uidt,
            colOptions: res_json.colOptions,
          };
        } else {
          Errors.throw_and_format("type assert failed", { res_json });
        }
      } else {
        return {
          ...res_json,
          title: res_json.title,
          uidt: res_json.uidt,
        };
      }
    } else {
      Errors.throw_and_format("type assert failed", { res_json });
    }
  }

  export async function fetch_ncbases_all_info(
    param: FetchOption & { logd_simple?: boolean },
  ) {
    const { logd_simple } = param;
    const ncbases: Array<
      NocoDBUtil.NcBase & {
        "__tables__": Array<
          NocoDBUtil.NcTable & {
            "__views__": Array<
              NocoDBUtil.NcView & {
                "__columns__": Array<
                  NocoDBUtil.NcColumnWithMetaData
                >;
              }
            >;
          }
        >;
      }
    > = [];
    for await (
      const ncbase of NocoDBUtil.list_bases({
        ...param,
      })
    ) {
      if (logd_simple) {
        console.debug(`Generating base ${ncbase.title} , id is ${ncbase.id}`);
      }
      const __tables__: typeof ncbases[number]["__tables__"] = [];
      ncbases.push({
        ...Jsons.copy(ncbase),
        __tables__,
      });
      for await (
        const nctable of NocoDBUtil.list_tables({
          ...param,
        }, ncbase.id)
      ) {
        if (logd_simple) {
          console.debug(
            `   Generating table ${nctable.title} , id is ${nctable.id}`,
          );
        }
        const __views__:
          typeof ncbases[number]["__tables__"][number]["__views__"] = [];
        __tables__.push({
          ...Jsons.copy(nctable),
          __views__,
        });

        for await (
          const ncview of NocoDBUtil.list_views({
            ...param,
          }, nctable.id)
        ) {
          if (logd_simple) {
            console.debug(
              `      Generating view ${ncview.title} , id is ${ncview.id}`,
            );
          }
          const __columns__:
            typeof ncbases[number]["__tables__"][number]["__views__"][
              number
            ]["__columns__"] = [];

          __views__.push({
            ...Jsons.copy(ncview),
            __columns__,
          });
          for await (
            const nccol of NocoDBUtil.list_columns({
              ...param,
            }, ncview.id)
          ) {
            try {
              __columns__.push({
                ...Jsons.copy(nccol),
                "__metadata__": await NocoDBUtil.get_column_metadata({
                  ...param,
                }, nccol.fk_column_id),
              });
            } catch (err) {
              Errors.throw_and_format(
                "list_columns failed",
                { nccol, ncview, nctable, ncbase },
                err,
              );
            }
          }
        }
      }
    }
    return ncbases;
  }

  export async function* list_table_records(
    param: FetchOption,
    tableId: string,
    viewId: null | string,
    where?: string,
    other_options?: {
      page_size?: null | number;
    },
  ) {
    const page_size = other_options?.page_size ?? 25;
    if (page_size <= 0) {
      Errors.throw_and_format("Invalid page size", {
        other_options,
        param,
        tableId,
        viewId,
        where,
      });
    }
    yield* _read_pages(
      {
        ...param,
        no_page: false,
        page_check_offset: true,
        get_route(page) {
          const pth1 = `/api/v2/tables/${tableId}/records?offset=${
            page * page_size
          }&limit=${page_size}` as const;
          const pth2 = viewId ? `${pth1}&viewId=${viewId}` as const : pth1;
          const pth3 = where ? `${pth2}&where=${where}` as const : pth2;
          return {
            method: "GET",
            pth: pth3,
          };
        },
        on_pageInfo: async () => {
        },
      },
      (it): it is Record<string, unknown> => {
        return (
          typeof it === "object" &&
          it !== null
        );
      },
    );
  }

  export async function create_table_records(
    param: FetchOption & {
      tableId: string;
      rows: Record<string, unknown>[];
    },
  ) {
    const { rows, tableId } = param;
    const { res_json, resp } = await _fetch_noco({
      ...param,
      route: {
        method: "POST",
        pth: `/api/v2/tables/${tableId}/records`,
        body: rows,
      },
    });
    if (!Array.isArray(res_json)) {
      Errors.throw_and_format("res_json should be array", { res_json, resp });
    }
    for (const item of res_json) {
      if (
        typeof item === "object" && item !== null && "Id" in item &&
        typeof item["Id"] === "number"
      ) {
        return {
          ...item,
          "Id": item["Id"],
        };
      } else {
        Errors.throw_and_format("Missing Id number in result object", {
          item,
          res_json,
          resp,
        });
      }
    }
  }

  export async function update_table_records(
    param: FetchOption & {
      tableId: string;
      rows: {
        [k in "Id" | string]: k extends "Id" ? string : unknown;
      }[];
    },
  ) {
    const { rows, tableId } = param;
    const { res_json, resp } = await _fetch_noco({
      ...param,
      route: {
        method: "PATCH",
        pth: `/api/v2/tables/${tableId}/records`,
        body: rows,
      },
    });
    if (!Array.isArray(res_json)) {
      Errors.throw_and_format("res_json should be array", { res_json, resp });
    }
    for (const item of res_json) {
      if (
        typeof item === "object" && item !== null && "Id" in item &&
        typeof item["Id"] === "number"
      ) {
        return {
          ...item,
          "Id": item["Id"],
        };
      } else {
        Errors.throw_and_format("Missing Id number in result object", {
          item,
          res_json,
          resp,
        });
      }
    }
  }

  export async function delete_table_records(
    param: FetchOption & {
      tableId: string;
      ids: { Id: number }[];
    },
  ) {
    const { ids, tableId } = param;
    const { res_json, resp } = await _fetch_noco({
      ...param,
      route: {
        method: "DELETE",
        pth: `/api/v2/tables/${tableId}/records`,
        body: ids,
      },
    });
    if (!Array.isArray(res_json)) {
      Errors.throw_and_format("res_json should be array", { res_json, resp });
    }
    for (const item of res_json) {
      if (
        typeof item === "object" && item !== null && "Id" in item &&
        typeof item["Id"] === "number"
      ) {
        return {
          ...item,
          "Id": item["Id"],
        };
      } else {
        Errors.throw_and_format("Missing Id number in result object", {
          item,
          res_json,
          resp,
        });
      }
    }
  }

  export function check_multi_select_values(
    head: NocoDBUtil.NcColumnWithMetaData,
    value: unknown,
  ) {
    if (head.__metadata__?.uidt !== "MultiSelect") {
      return {
        success: false,
        reason: "uidt_not_match",
      } as const;
    } else {
      if (value === null) {
        return {
          success: true,
          reason: "value_is_null",
        } as const;
      }
      if (typeof value !== "string") {
        return {
          success: false,
          reason: "value_not_string_or_null",
          value,
        };
      }
      for (const multi_select_item of value.split(",")) {
        if (
          "undefined" ===
            typeof (head.__metadata__.colOptions.options.find((
              { title },
            ) => title === multi_select_item))
        ) {
          return {
            success: false,
            reason: "multi_select_item_not_found",
            value,
            multi_select_item,
          } as const;
        }
      }
      return {
        success: true,
        reason: "value_is_valid",
      } as const;
    }
  }

  export async function create_column(
    param: FetchOption & {
      tableId: string;
      body: CreateColumnsBody;
    },
  ) {
    const { tableId, body } = param;
    const { res_json, resp } = await _fetch_noco({
      ...param,
      route: {
        method: "POST",
        pth: `/api/v2/meta/tables/${tableId}/columns`,
        body,
      },
    });
    if (resp.status !== 200) {
      Errors.throw_and_format("Failed create column", { res_json, param });
    }
  }

  export async function update_column(
    param: FetchOption & {
      columnId: string;
      body: CreateColumnsBody;
    },
  ) {
    const { columnId, body } = param;
    const { res_json, resp } = await _fetch_noco({
      ...param,
      route: {
        method: "PATCH",
        pth: `/api/v2/meta/columns/${columnId}`,
        body,
      },
    });
    if (resp.status !== 200) {
      Errors.throw_and_format("Failed create column", { res_json, param });
    }
  }

  // export async function get_primary_view(param: {
  //   nocodb_fetch_option: FetchOption;
  //   nctableId: string;
  // }) {
  //   const { nocodb_fetch_option, nctableId } = param;
  //   for await (
  //     const ncview of NocoDBUtil.list_views(nocodb_fetch_option, nctableId)
  //   ) {
  //   }
  // }

  export async function create_or_update_column_ctx(param: {
    nocodb_fetch_option: FetchOption;
    nctableId: string;
    ncviewId: string;
  }) {
    const { nocodb_fetch_option, nctableId, ncviewId } = param;

    // const { nocodb_fetch_option, ncviewId, nctableId } = _param;
    const cols: {
      col: NocoDBUtil.NcColumn;
      col_meta: NocoDBUtil.NcColumnMetaData;
    }[] = [];
    for await (
      const col of NocoDBUtil.list_columns(nocodb_fetch_option, ncviewId)
    ) {
      const col_meta = await NocoDBUtil.get_column_metadata(
        nocodb_fetch_option,
        col.fk_column_id,
      );
      cols.push({ col, col_meta });
    }
    return {
      create_or_update_column: async (_param: { body: CreateColumnsBody }) => {
        const { body } = _param;
        const title = body.title;
        if (title !== body.column_name) {
          Errors.throw_and_format("title should equal body.column_name", {
            param,
          });
        }

        const _llmreq_correct_found_col = cols.find(({ col_meta }) =>
          col_meta?.title === title
        );
        if ("undefined" === typeof _llmreq_correct_found_col) {
          console.debug("Create column", body.title);
          await create_column({
            ...nocodb_fetch_option,
            tableId: nctableId,
            body: body,
          });
        } else {
          await update_column({
            ...nocodb_fetch_option,
            columnId: _llmreq_correct_found_col.col.fk_column_id,
            body: body,
          });
        }
      },
    };
  }
}

// deno-lint-ignore no-namespace
export namespace NocoDBDataset {
  type ColumnsMetaApiFromColumns<
    A,
  > = A extends readonly [infer ColHead, ...infer Arr] ? ColHead extends {
      __metadata__: { title: infer Title extends string; uidt: infer Uidt };
    } ?
        & Record<
          Title,
          Typings.DeepReadonly<{
            head: ColHead;
            uidt: Uidt;
          }>
        >
        & ColumnsMetaApiFromColumns<Arr>
    : ColumnsMetaApiFromColumns<Arr>
    : unknown;

  type _ShowIsTrueOrTitleIsId<
    Show,
    Title extends string,
    Next,
    Uidt,
    Upsert extends boolean,
    T,
  > = Title extends "id" //
    ? T extends Record<Title, infer V> //
      ? T & Record<Title, NonNullable<V>> & Next
    : T & Next
    : _MaybeNotExist<Upsert, Uidt, Show extends boolean ? Show : false> extends
      true //
      ? Next
    : T & Next;

  type _MaybeNotExist<Upsert extends boolean, Uidt, Show extends boolean> =
    Show extends false ? true
      : Upsert extends true ? Uidt extends "Formula" ? true : false
      : false;

  export type RowsData<A, Upsert extends true | false = false> = //
    A extends readonly [infer ColHead, ...infer Arr] //
      ? ColHead extends {
        show: infer Show;
        __metadata__: { title: infer Title extends string; uidt: infer Uidt };
      } //
        ? _ShowIsTrueOrTitleIsId<
          Show,
          Title,
          RowsData<Arr, Upsert>,
          Uidt,
          Upsert,
          Record<
            Title,
            Uidt extends string & keyof NocoDBUtil.UITypes
              ? NocoDBUtil.UITypes[Uidt]
              : unknown
          >
        >
      : RowsData<Arr, Upsert>
      : unknown;

  export class NcApi<
    NcBases extends Typings.DeepReadonly<
      Awaited<
        ReturnType<typeof NocoDBUtil.fetch_ncbases_all_info>
      >
    >,
  > {
    constructor(
      // private ncbases: NcBases,
      private baseurl: DataClean.HttpUrl,
      private nocodb_token: string,
    ) {}

    public async select_view<
      BaseTitle extends NcBases[number]["title"],
      TableTitle extends Base["__tables__"][number]["title"],
      ViewTitle extends Table["__views__"][number]["title"],
      Base extends Extract<NcBases[number], { title: BaseTitle }>,
      Table extends Extract<Base["__tables__"][number], { title: TableTitle }>,
      View extends Extract<Table["__views__"][number], { title: ViewTitle }>,
      ColumnsMetaApi extends ColumnsMetaApiFromColumns<View["__columns__"]>,
      RowsApi extends RowsApiFromColumns<View["__columns__"]>,
    >(_param: {
      base_title: BaseTitle;
      table_title: TableTitle;
      view_title: ViewTitle;
    }) {
      const { base_title, table_title, view_title } = _param;
      for await (
        const ncbase of NocoDBUtil.list_bases({
          baseurl: this.baseurl,
          nocodb_token: this.nocodb_token,
        })
      ) {
        if (ncbase.title === base_title) {
          for await (
            const nctable of NocoDBUtil.list_tables({
              baseurl: this.baseurl,
              nocodb_token: this.nocodb_token,
            }, ncbase.id)
          ) {
            if (nctable.title === table_title) {
              for await (
                const ncview of NocoDBUtil.list_views({
                  baseurl: this.baseurl,
                  nocodb_token: this.nocodb_token,
                }, nctable.id)
              ) {
                if (ncview.title === view_title) {
                  const nccolumns: NocoDBUtil.NcColumnWithMetaData[] = [];
                  for await (
                    const nccolumn of NocoDBUtil.list_columns({
                      baseurl: this.baseurl,
                      nocodb_token: this.nocodb_token,
                    }, ncview.id)
                  ) {
                    const nccolmeta = await NocoDBUtil.get_column_metadata({
                      baseurl: this.baseurl,
                      nocodb_token: this.nocodb_token,
                    }, nccolumn.fk_column_id);
                    nccolumns.push({
                      ...nccolumn,
                      __metadata__: nccolmeta,
                    });
                  }
                  const nccolumn_to_metaapi = (
                    nccolumn: typeof nccolumns[number],
                  ) => {
                    if (
                      !("__metadata__" in nccolumn) ||
                      is_nullish(nccolumn.__metadata__) ||
                      typeof nccolumn.__metadata__ !== "object"
                    ) {
                      return null;
                    }
                    if (
                      "show" in nccolumn &&
                      typeof nccolumn.show === "boolean" &&
                      "title" in nccolumn.__metadata__ &&
                      typeof nccolumn.__metadata__.title === "string" &&
                      "uidt" in nccolumn.__metadata__ &&
                      typeof nccolumn.__metadata__.uidt === "string" &&
                      NocoDBUtil.is_ui_types_key(nccolumn.__metadata__.uidt)
                    ) {
                      return Arrays.of(
                        nccolumn.__metadata__.title,
                        {
                          head: {
                            ...nccolumn,
                            show: nccolumn.show,
                          },
                          uidt: nccolumn.__metadata__.uidt,
                        },
                      );
                    } else {
                      Errors.throw_and_format("Invalid nccolumn", nccolumn);
                    }
                  };
                  const columns_meta_entries = nccolumns.map(
                    nccolumn_to_metaapi,
                  ).filter((it) => it !== null);
                  const columns_meta: ColumnsMetaApi = Mappings
                    .object_from_entries(
                      columns_meta_entries,
                      // deno-lint-ignore no-explicit-any
                    ) as any;

                  const rows: RowsApi = new RowsApiFromColumns<
                    View["__columns__"]
                  >({
                    baseurl: this.baseurl,
                    nocodb_token: this.nocodb_token,
                    ncbase,
                    nctable,
                    ncview,
                    columns_meta_entries,
                  }) as RowsApi;
                  return {
                    columns_meta,
                    rows,
                    ncbase: ncbase as Base,
                    nctable: nctable as Table,
                    ncview: ncview as View,
                  };
                }
              }
              throw new Error(
                `Not found ncview titled ${view_title} in ncbase ${base_title} nctable ${table_title}`,
              );
            }
          }
          throw new Error(
            `Not found nctitle titled ${table_title} in ncbase ${base_title}`,
          );
        }
      }
      throw new Error(`Not found ncbase titled ${base_title}`);
    }
  }

  type NcApiColEntry = [string, {
    head: NocoDBUtil.NcColumnWithMetaData;
    uidt: keyof NocoDBUtil.UITypes;
  }];

  class RowsApiFromColumns<
    A,
    _Row extends RowsData<A> = RowsData<A>,
  > {
    public constructor(
      private ctx: {
        baseurl: DataClean.HttpUrl;
        nocodb_token: string;
        ncbase: NocoDBUtil.NcBase;
        nctable: NocoDBUtil.NcTable;
        ncview: NocoDBUtil.NcView;
        columns_meta_entries: NcApiColEntry[];
      },
    ) {
    }

    private check_row_data_of_column<Row extends RowsData<A>>(
      record: unknown,
    ): record is Row {
      const { columns_meta_entries } = this.ctx;
      if (typeof record !== "object" || record === null) {
        Errors.throw_and_format("record should be object", { record });
      }
      const record_keys = Object.keys(record);

      for (const key of record_keys) {
        const column_meta = columns_meta_entries.find((it) => it[0] === key);
        if (!column_meta) {
          Errors.throw_and_format(
            "There is no column found in record keys",
            { record, key, columns_meta_entries },
          );
        }
        const [_, column_meta_info] = column_meta;
        const { uidt, head } = column_meta_info;
        const ui_type_entry = NocoDBUtil.ui_types.find((it) => it[0] === uidt);
        if (!ui_type_entry) {
          Errors.throw_and_format(
            "Invalid uidt",
            { record, key, uidt, column_meta },
          );
        }

        // deno-lint-ignore no-explicit-any
        const value: unknown = (record as any)[key];
        switch (ui_type_entry[1]) {
          case "nocodb_id":
            if (
              !(typeof value === "string" && Nums.is_int(value) ||
                typeof value === "number")
            ) {
              Errors.throw_and_format(
                "TypeError on value",
                {
                  record,
                  key,
                  value,
                  uidt,
                  column_meta,
                  ui_type_entry,
                },
              );
            }
            continue;
          case "string":
            if (
              !(typeof value === "string" ||
                (key !== "id" && value === null))
            ) {
              Errors.throw_and_format(
                "TypeError on value",
                {
                  record,
                  key,
                  value,
                  uidt,
                  column_meta,
                  ui_type_entry,
                },
              );
            }
            continue;
          case "number":
            if (
              typeof value !== "number" && value !== null
            ) {
              Errors.throw_and_format(
                "TypeError on value",
                {
                  record,
                  key,
                  value,
                  uidt,
                  column_meta,
                  ui_type_entry,
                },
              );
            }
            continue;
          case "CreatedTime":
          case "LastModifiedTime":
          case "CreatedBy":
          case "LastModifiedBy":
            if (
              !(typeof value === "undefined" || typeof value === "string")
            ) {
              Errors.throw_and_format(
                "TypeError on value",
                {
                  record,
                  key,
                  value,
                  uidt,
                  column_meta,
                  ui_type_entry,
                },
              );
            }
            continue;
          // deno-lint-ignore no-case-declarations, no-fallthrough
          case "MultiSelect":
            const _multi_select_check_result = NocoDBUtil
              .check_multi_select_values(head, value);
            if (_multi_select_check_result.success) {
              continue;
            } else {
              Errors.throw_and_format(
                "TypeError on value",
                {
                  record,
                  key,
                  value,
                  uidt,
                  column_meta,
                  ui_type_entry,
                  _multi_select_check_result,
                },
              );
            }
            // Errors.throw_and_format("TODO", { column_meta });
          case "JSON":
            if (!is_deep_equal(value, Jsons.load(Jsons.dump(value)))) {
              Errors.throw_and_format(
                "TypeError on value",
                {
                  record,
                  key,
                  value,
                  uidt,
                  column_meta,
                  ui_type_entry,
                },
              );
            }
            continue;
          case "unknown":
            continue;

          default:
            Errors.throw_and_format(
              "Invalid ui_type_entry[1]",
              {
                record,
                key,
                columns_meta_entries,
                uidt,
                column_meta,
                ui_type_entry,
              },
            );
        }
      }
      for (const column_meta of columns_meta_entries) {
        const [meta_key, col_def] = column_meta;
        // deno-lint-ignore no-explicit-any
        const value: unknown = (record as any)[meta_key];
        if (meta_key === "id" || col_def.head.show) {
          if (
            (record_keys.indexOf(meta_key) < 0 ||
              typeof value === "undefined") &&
            ["CreatedTime", "LastModifiedTime", "CreatedBy", "LastModifiedBy"]
                .indexOf(col_def.uidt) < 0
          ) {
            Errors.throw_and_format(
              "There has some column should existed in record but not exist",
              { column_meta, record, value },
            );
          }
        } else {
          if (
            record_keys.indexOf(meta_key) >= 0 ||
            typeof value !== "undefined"
          ) {
            Errors.throw_and_format(
              "There has some column should not existed in record but exist",
              { column_meta, record, value },
            );
          }
        }
      }
      return true;
    }

    public async map<
      R,
      Row extends RowsData<A, false> = RowsData<A, false>,
      QueueSize extends undefined | number = undefined,
    >(_param: {
      cb: (row: Row, iter_count: number) =>
        | "filter"
        | (QueueSize extends undefined ? {
            result: R;
          }
          : {
            result: R;
          } | {
            result_future: Promise<R>;
          });
      limit?: number | null;
      queue_size?: QueueSize;
      page_size?: number | null;
    }) {
      const { cb, limit, queue_size } = _param;
      let { page_size } = _param;
      if (
        typeof page_size === "number" && typeof limit === "number" &&
        limit > 0 && page_size > limit
      ) {
        page_size = limit;
      }
      let iter_count = 0;
      const results: ({ iter_count: number; result: R })[] = [];
      if (is_nullish(limit) || limit > 0) {
        const queue: {
          iter_count: number;
          result_future: Promise<R>;
        }[] = [];
        for await (
          const record of NocoDBUtil.list_table_records(
            {
              baseurl: this.ctx.baseurl,
              nocodb_token: this.ctx.nocodb_token,
            },
            this.ctx.nctable.id,
            this.ctx.ncview.id,
            undefined,
            {
              page_size,
            },
          )
        ) {
          if (!this.check_row_data_of_column<Row>(record)) {
            Errors.throw_and_format("check record type falied", { record });
          }
          // 上面的类型检查理应保证此处的类型安全。
          // const _record = record as Row;

          try {
            // console.debug(record);
            const res = cb(record, iter_count);
            if (res === "filter") {
              // ignore
            } else if ("result" in res) {
              results.push({
                iter_count: iter_count,
                result: res.result,
              });
            } else if ("result_future" in res) {
              if (
                typeof queue_size === "undefined" || queue_size === null ||
                queue_size < 0
              ) {
                Errors.throw_and_format(
                  "Queue size invalid but result future received",
                  {
                    queue_size,
                  },
                );
              }
              while (1) {
                if (queue.length < queue_size) {
                  queue.push({
                    iter_count,
                    result_future: res.result_future,
                  });
                  break;
                } else {
                  const [out] = queue.splice(0, 1);
                  const out_res = await out.result_future;
                  results.push({
                    iter_count: out.iter_count,
                    result: out_res,
                  });
                }
              }
            }
          } finally {
            iter_count++;
          }
          if (!is_nullish(limit) && queue.length + results.length >= limit) {
            break;
          }
        }
        results.push(
          ...(await Promise.all(
            queue.map(async (it) => {
              const out_res = await it.result_future;
              return {
                iter_count: it.iter_count,
                result: out_res,
              };
            }),
          )),
        );
      }

      results.sort((a, b) => a.iter_count - b.iter_count);
      return {
        columns_meta_entries: this.ctx.columns_meta_entries,
        results,
      };
    }

    public async upsert<
      Row extends RowsData<A, true> = RowsData<A, true>,
      RowCreate extends Omit<
        Row,
        "Id" | "CreatedAt" | "UpdatedAt" | "nc_created_by" | "nc_updated_by"
      > = Omit<
        Row,
        "Id" | "CreatedAt" | "UpdatedAt" | "nc_created_by" | "nc_updated_by"
      >,
    >(_param: {
      duplicate_col:
        & string
        & keyof RowCreate;
      rows: RowCreate[];
      batch_size_find_existed?: number | null;
      batch_size_upsert?: number | null;
      on_before_create?: (row: RowCreate) => Promise<void>;
      on_equal?: (
        _ctx: {
          existed_content: unknown;
          row: RowCreate;
          existed: unknown;
        },
      ) => Promise<void>;
      on_before_update?: (_ctx: {
        existed_content: unknown;
        row: RowCreate;
        existed: unknown;
        not_equal_reason: unknown;
      }) => Promise<void>;
      on_before_map_row_to_existed_info_batch?: (_ctx: {
        existed_slice: {
          start: number;
          end: number;
          total: number;
          sliced: RowCreate[];
        };
      }) => Promise<void>;
      on_before_create_rows?: (_ctx: {
        rows: RowCreate[];
      }) => Promise<void>;
      on_before_update_rows?: (_ctx: {
        rows: (RowCreate & {
          Id: number;
        })[];
      }) => Promise<void>;
    }) {
      const {
        rows,
        duplicate_col,
        on_before_create,
        on_equal,
        on_before_update,
        on_before_map_row_to_existed_info_batch,
        on_before_create_rows,
        on_before_update_rows,
      } = _param;
      const baseurl = this.ctx.baseurl;
      const nocodb_token = this.ctx.nocodb_token;
      const tableId = this.ctx.nctable.id;

      const batch_size_find_existed = _param.batch_size_find_existed ?? 10;
      if (batch_size_find_existed <= 0) {
        Errors.throw_and_format("Invalid batch_size_find_existed", { _param });
      }
      const batch_size_upsert = _param.batch_size_upsert ?? 25;
      if (batch_size_upsert <= 0) {
        Errors.throw_and_format("Invalid batch_size_upsert", { _param });
      }
      const _map_row_to_existed_info = async (row: typeof rows[number]) => {
        if (!(duplicate_col in row)) {
          Errors.throw_and_format("not found duplicate col in row", {
            duplicate_col,
            row,
          });
        }
        const duplicate_value = row[duplicate_col];
        if (
          is_nullish(duplicate_value) ||
          typeof duplicate_value !== "string" &&
            typeof duplicate_value !== "number"
        ) {
          Errors.throw_and_format("Invalid duplicate value", {
            row,
            duplicate_col,
            duplicate_value,
          });
        }

        const records: Record<string, unknown>[] = [];
        for await (
          const record of NocoDBUtil.list_table_records(
            {
              baseurl,
              nocodb_token,
            },
            tableId,
            null,
            `(${encodeURIComponent(duplicate_col)},eq,${
              encodeURIComponent(duplicate_value)
            })`,
          )
        ) {
          records.push(record);
        }

        if (records.length <= 0) {
          return {
            duplicate_col,
            duplicate_value,
            existed: false,
            row,
          } as const;
        } else if (records.length > 1) {
          let err: Error;
          try {
            Errors.throw_and_format("Duplicated key", {
              records_length: records.length,
              records,
            });
          } catch (_err) {
            err = _err as Error;
          }
          const delete_res = await NocoDBUtil.delete_table_records({
            baseurl,
            nocodb_token,
            tableId,
            ids: records.slice(1).map((record) => {
              if ("Id" in record && typeof record["Id"] === "number") {
                return {
                  Id: record["Id"],
                };
              } else {
                throw err;
              }
            }),
          });
          const record = records[0];
          console.warn("Success delete duplicated key records : ", {
            delete_res,
            duplicate_col,
            duplicate_value,
          });
          return {
            duplicate_col,
            duplicate_value,
            existed: record,
            row,
          } as const;
        } else {
          const record = records[0];
          return {
            duplicate_col,
            duplicate_value,
            existed: record,
            row,
          } as const;
        }
      };
      const deduplicete_values = new Set();
      const existed_list: Array<
        Awaited<ReturnType<typeof _map_row_to_existed_info>>
      > = [];
      for await (
        const existed_slice of Streams.split_array_use_batch_size(
          batch_size_find_existed,
          rows,
        )
      ) {
        const existed_list_slice = await Promise.all(
          existed_slice.sliced.map(_map_row_to_existed_info),
        );
        if (on_before_map_row_to_existed_info_batch) {
          await on_before_map_row_to_existed_info_batch({
            existed_slice,
          });
        }
        for (const existed_item of existed_list_slice) {
          if (deduplicete_values.has(existed_item.duplicate_value)) {
            continue;
          }
          existed_list.push(existed_item);
          deduplicete_values.add(existed_item.duplicate_value);
        }
      }

      const rows_to_create: Array<typeof existed_list[number]["row"]> = [];
      const rows_to_update: Array<
        typeof existed_list[number]["row"] & { Id: number }
      > = [];

      const create_rows = async () => {
        if (rows_to_create.length <= 0) {
          return;
        }
        const rows = rows_to_create.splice(0, rows_to_create.length);
        if (rows.length <= 0) {
          return;
        }
        if (on_before_create_rows) {
          await on_before_create_rows({ rows });
        }
        await NocoDBUtil.create_table_records({
          baseurl,
          nocodb_token,
          tableId,
          rows,
        });
      };

      const update_rows = async () => {
        if (rows_to_update.length <= 0) {
          return;
        }
        const rows = rows_to_update.splice(0, rows_to_update.length);
        if (rows.length <= 0) {
          return;
        }
        if (on_before_update_rows) {
          await on_before_update_rows({ rows });
        }
        await NocoDBUtil.update_table_records({
          baseurl,
          nocodb_token,
          tableId,
          rows,
        });
      };

      for (
        const { existed, row } of existed_list
      ) {
        if (existed === false) {
          if (on_before_create) {
            await on_before_create(row);
          }
          rows_to_create.push(row);
          if (rows_to_create.length >= batch_size_upsert) {
            await create_rows();
          }
        } else {
          const existed_content = Mappings.filter_keys(existed, "omit", [
            "Id",
            "CreatedAt",
            "UpdatedAt",
            "nc_created_by",
            "nc_updated_by",
          ]);

          const is_not_equal = (
            _ex: Record<string, unknown>,
            _row: Record<string, unknown>,
          ) => {
            for (const key of Mappings.object_keys(_row)) {
              if (!(key in _ex) || typeof _ex[key] === "undefined") {
                return {
                  reason: "key_not_match",
                  key,
                } as const;
              }
              const _ex_value = _ex[key];
              const _row_value = _row[key];
              const col_meta = this.ctx.columns_meta_entries.find((it) =>
                it[0] === key
              );
              if (!col_meta) {
                Errors.throw_and_format("Not found col_meta for key", {
                  key,
                  col_meta,
                  _row,
                  _ex,
                  "this.ctx.columns_meta_entries":
                    this.ctx.columns_meta_entries,
                });
              }
              const { uidt } = col_meta[1];
              if (is_deep_equal(_ex_value, _row_value)) {
                continue;
              }

              if (
                (uidt === "Date" || uidt === "DateTime") &&
                typeof _ex_value === "string" && typeof _row_value === "string"
              ) {
                const _parse_inst = (v: string) => {
                  try {
                    return Times.parse_text_to_instant(v);
                  } catch (_err) {
                    return null;
                  }
                };
                const _ex_time = _parse_inst(_ex_value);
                const _row_time = _parse_inst(_row_value);
                if (_ex_time && _row_time) {
                  if (
                    uidt === "DateTime" &&
                    _ex_time.epochMilliseconds === _row_time.epochMilliseconds
                  ) {
                    continue;
                  }
                  if (uidt === "Date") {
                    const to_ymd = (inst: Temporal.Instant) => {
                      const d = Times.instant_to_date(inst);
                      return [
                        d.getUTCFullYear(),
                        d.getUTCMonth(),
                        d.getUTCDate(),
                      ] as const;
                    };
                    if (is_deep_equal(to_ymd(_ex_time), to_ymd(_row_time))) {
                      continue;
                    }
                  }
                }
              }
              return {
                reason: "value not match",
                key,
                _ex_value,
                _row_value,
              } as const;
            }
            return false;
          };

          const not_equal_reason = is_not_equal(existed_content, row);

          if (!not_equal_reason) {
            if (on_equal) {
              await on_equal({
                existed_content,
                row,
                existed,
              });
            }
            continue;
          }

          if (on_before_update) {
            await on_before_update({
              existed_content,
              row,
              existed,
              not_equal_reason,
            });
          }
          if (
            !("Id" in existed) ||
            typeof existed["Id"] !== "number"
          ) {
            Errors.throw_and_format("Why Id not in existed", {
              existed_content,
              row,
              existed,
              not_equal_reason,
            });
          }
          rows_to_update.push({
            Id: existed["Id"],
            ...row,
          });
          if (rows_to_update.length >= batch_size_upsert) {
            // Errors.throw_and_format("Why update", {
            //   existed_content,
            //   row,
            //   not_equal_reason,
            // });
            await update_rows();
          }
        }
      }

      await create_rows();
      await update_rows();
    }
  }
}
