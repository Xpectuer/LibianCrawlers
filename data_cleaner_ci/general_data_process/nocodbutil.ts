import {
  Arrays,
  DataClean,
  Errors,
  is_nullish,
  Jsons,
  Mappings,
  Strs,
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

  export type FetchOption = {
    baseurl: DataClean.HttpUrl;
    nocodb_token: string;
    logd_fetch_noco?: boolean;
  };
  // export type UITypesStr =
  //   | "ID"
  //   | "LinkToAnotherRecord"
  //   | "ForeignKey"
  //   | "Lookup"
  //   | "SingleLineText"
  //   | "LongText"
  //   | "Attachment"
  //   | "Checkbox"
  //   | "MultiSelect"
  //   | "SingleSelect"
  //   | "Collaborator"
  //   | "Date"
  //   | "Year"
  //   | "Time"
  //   | "PhoneNumber"
  //   | "GeoData"
  //   | "Email"
  //   | "URL"
  //   | "Number"
  //   | "Decimal"
  //   | "Currency"
  //   | "Percent"
  //   | "Duration"
  //   | "Rating"
  //   | "Formula"
  //   | "Rollup"
  //   | "Count"
  //   | "DateTime"
  //   | "CreatedTime"
  //   | "LastModifiedTime"
  //   | "AutoNumber"
  //   | "Geometry"
  //   | "JSON"
  //   | "SpecificDBType"
  //   | "Barcode"
  //   | "QrCode"
  //   | "Button"
  //   | "Links"
  //   | "User"
  //   | "CreatedBy"
  //   | "LastModifiedBy"
  //   | "Order";

  export const ui_types = [
    ["ID", "string"],
    ["LinkToAnotherRecord", "unknown"],
    ["ForeignKey", "unknown"],
    ["Lookup", "unknown"],
    ["SingleLineText", "string"],
    ["LongText", "string"],
    ["Attachment", "unknown"],
    ["Checkbox", "unknown"],
    ["MultiSelect", "unknown"],
    ["SingleSelect", "unknown"],
    ["Collaborator", "unknown"],
    ["Date", "unknown"],
    ["Year", "unknown"],
    ["Time", "unknown"],
    ["PhoneNumber", "unknown"],
    ["GeoData", "unknown"],
    ["Email", "unknown"],
    ["URL", "unknown"],
    ["Number", "unknown"],
    ["Decimal", "unknown"],
    ["Currency", "unknown"],
    ["Percent", "unknown"],
    ["Duration", "unknown"],
    ["Rating", "unknown"],
    ["Formula", "unknown"],
    ["Rollup", "unknown"],
    ["Count", "unknown"],
    ["DateTime", "unknown"],
    ["CreatedTime", "unknown"],
    ["LastModifiedTime", "unknown"],
    ["AutoNumber", "unknown"],
    ["Geometry", "unknown"],
    ["JSON", "unknown"],
    ["SpecificDBType", "unknown"],
    ["Barcode", "unknown"],
    ["QrCode", "unknown"],
    ["Button", "unknown"],
    ["Links", "unknown"],
    ["User", "unknown"],
    ["CreatedBy", "unknown"],
    ["LastModifiedBy", "unknown"],
    ["Order", "unknown"],
  ] as const; // satisfies Array<keyof UITypes>;

  export function is_ui_types_key(
    s: string,
  ): s is typeof ui_types[number][0] {
    return ui_types.find((it) => it[0] === s) !== undefined;
  }

  type UITypesValueType<T> = T extends "unknown" ? unknown
    : T extends "string" ? string | null
    : never;

  export type UITypes = {
    [K in typeof ui_types[number][0]]: UITypesValueType<
      Extract<
        typeof ui_types[number],
        // deno-lint-ignore no-explicit-any
        Readonly<[K, any]>
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
    const raise_err = (reason: string, cause?: unknown) => {
      throw new Error(
        `${reason} , code is ${resp.status}, fetch url is ${fetch_url} , req body is ${
          Jsons.dump(req_body)
        } , ${
          res_json_success
            ? `response json is ${Jsons.dump(res_json)} , `
            : "parse response json failed , "
        }route is ${Jsons.dump(param.route)}`,
        {
          cause,
        },
      );
    };

    const resp = await fetch(fetch_url, {
      method: route.method,
      headers: {
        "xc-token": nocodb_token,
        "content-type": "application/json;charset=utf-8",
      },
      body: req_body,
    });
    const resp_body = await resp.bytes();
    let res_text: string;
    try {
      res_text = new TextDecoder().decode(resp_body);
    } catch (err) {
      res_text = "";
      raise_err(`Failed parse resp text , resp body is ${resp_body}`, err);
    }

    let res_json: unknown;
    let res_json_success: boolean;

    try {
      res_json = Jsons.load(res_text);
      res_json_success = true;
    } catch (err) {
      res_json = null;
      res_json_success = false;
      raise_err(`Failed parse json , resp text body is ${res_text}`, err);
    }

    if (resp.status !== 200) {
      if (on_status_not_200) {
        const res = await on_status_not_200(resp);
        if (res === "raise") {
          raise_err("Failed fetch nocodb");
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
      (it): it is { fk_column_id: string; id: string } => {
        return (
          typeof it === "object" &&
          it !== null &&
          "fk_column_id" in it &&
          typeof it.fk_column_id === "string" &&
          "id" in it &&
          typeof it.id === "string"
        );
      },
    );
  }

  export async function get_column_metadata(
    param: FetchOption,
    columnId: string,
  ) {
    const { res_json, resp } = await _fetch_noco({
      ...param,
      route: { method: "GET", pth: `/api/v2/meta/columns/${columnId}` },
      // deno-lint-ignore require-await
      on_status_not_200: async (resp) => {
        if (resp.status === 404) {
          return null;
        } else {
          return "raise";
        }
      },
    });
    // console.debug("success", { columnId });
    return res_json;
  }

  export async function fetch_ncbases_all_info(param: FetchOption) {
    const ncbases: Array<
      NocoDBUtil.NcBase & {
        "__tables__": Array<
          NocoDBUtil.NcTable & {
            "__views__": Array<
              NocoDBUtil.NcView & {
                "__columns__": Array<
                  NocoDBUtil.NcColumn & {
                    "__metadata__": NocoDBUtil.NcColumnMetaData;
                  }
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
            __columns__.push({
              ...Jsons.copy(nccol),
              "__metadata__": await NocoDBUtil.get_column_metadata({
                ...param,
              }, nccol.fk_column_id),
            });
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
  ) {
    yield* _read_pages(
      {
        ...param,
        no_page: false,
        page_check_offset: true,
        get_route(page) {
          const page_size = 25;
          return {
            method: "GET",
            pth: viewId
              ? `/api/v2/tables/${tableId}/records?offset=${
                page * page_size
              }&limit=${page_size}&viewId=${viewId}`
              : `/api/v2/tables/${tableId}/records?offset=${
                page * page_size
              }&limit=${page_size}`,
          };
        },
        on_pageInfo: async () => {
        },
      },
      (it): it is { id: string } => {
        return (
          typeof it === "object" &&
          it !== null &&
          "id" in it &&
          typeof it.id === "string"
        );
      },
    );
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

  type RowsData<A> = A extends readonly [infer ColHead, ...infer Arr]
    ? ColHead extends
      { __metadata__: { title: infer Title extends string; uidt: infer Uidt } }
      ?
        & Record<
          Title,
          Uidt extends keyof NocoDBUtil.UITypes ? NocoDBUtil.UITypes[Uidt]
            : unknown
        >
        & RowsData<Arr>
    : RowsData<Arr>
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
                  const nccolumns: {
                    fk_column_id: string;
                    id: string;
                    __metadata__: unknown;
                  }[] = [];
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
                      "column_name" in nccolumn.__metadata__ &&
                      typeof nccolumn.__metadata__.column_name === "string" &&
                      "uidt" in nccolumn.__metadata__ &&
                      typeof nccolumn.__metadata__.uidt === "string" &&
                      NocoDBUtil.is_ui_types_key(nccolumn.__metadata__.uidt)
                    ) {
                      return Arrays.of(
                        nccolumn.__metadata__.column_name,
                        {
                          head: nccolumn,
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
    head: {
      fk_column_id: string;
      id: string;
      __metadata__: unknown;
    };
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

    public async map<
      R,
      Row = RowsData<A>,
      QueueSize extends undefined | number = undefined,
    >(_param: {
      cb: (row: Row) =>
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
    }) {
      const { cb, limit, queue_size } = _param;
      let limit_count = 0;
      const results: (R & { __iter_count__: number })[] = [];
      if (is_nullish(limit) || limit > 0) {
        for await (
          const record of NocoDBUtil.list_table_records(
            {
              baseurl: this.ctx.baseurl,
              nocodb_token: this.ctx.nocodb_token,
            },
            this.ctx.nctable.id,
            this.ctx.ncview.id,
          )
        ) {
          const check_row_data_of_column = () => {
          };

          try {
            console.debug("record", record);
          } finally {
            limit_count++;
          }
          if (!is_nullish(limit) && limit_count >= limit) {
            break;
          }
        }
      }
    }
  }
}
