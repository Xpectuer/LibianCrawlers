import { DataClean, Jsons, Strs } from "../../util.ts";

// deno-lint-ignore no-namespace
export namespace NocoDBUtil {
  export type KnownBaseTable =
    | {
        base_title: "libian_crawler";
        table_name: "";
      }
    | {
        base_title: "libiancrawler_editable_sheet_devtest";
        table_name: "";
      };

  export type KnownOutputBaseTable = Exclude<
    KnownBaseTable,
    {
      base_title: "libian_crawler";
    }
  >;

  export type FetchOption = {
    baseurl: DataClean.HttpUrl;
    nocodb_token: string;
    logd_fetch_noco?: boolean;
  };
  export type UITypesStr =
    | "ID"
    | "LinkToAnotherRecord"
    | "ForeignKey"
    | "Lookup"
    | "SingleLineText"
    | "LongText"
    | "Attachment"
    | "Checkbox"
    | "MultiSelect"
    | "SingleSelect"
    | "Collaborator"
    | "Date"
    | "Year"
    | "Time"
    | "PhoneNumber"
    | "GeoData"
    | "Email"
    | "URL"
    | "Number"
    | "Decimal"
    | "Currency"
    | "Percent"
    | "Duration"
    | "Rating"
    | "Formula"
    | "Rollup"
    | "Count"
    | "DateTime"
    | "CreatedTime"
    | "LastModifiedTime"
    | "AutoNumber"
    | "Geometry"
    | "JSON"
    | "SpecificDBType"
    | "Barcode"
    | "QrCode"
    | "Button"
    | "Links"
    | "User"
    | "CreatedBy"
    | "LastModifiedBy"
    | "Order";
  export type CreateTableOpt = {
    table_name?: string;
    columns: Array<
      Omit<
        {
          title: string;
          uidt: UITypesStr;
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
      };

  const _fetch_noco = async (
    param: FetchOption & {
      route: Route;
    }
  ) => {
    const { route, nocodb_token, logd_fetch_noco } = param;
    const baseurl = Strs.remove_suffix_recursion(param.baseurl, "/");
    const fetch_url = `${baseurl}${route.pth}` as const;
    const req_body = "body" in route ? Jsons.dump(route.body) : null;
    const raise_err = (reason: string, cause?: unknown) => {
      throw new Error(
        `${reason} , code is ${
          resp.status
        }, fetch url is ${fetch_url} , req body is ${Jsons.dump(req_body)} , ${
          res_json_success
            ? `response json is ${Jsons.dump(res_json)} , `
            : "parse response json failed , "
        }route is ${Jsons.dump(param.route)}`,
        {
          cause,
        }
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
      raise_err("Failed fetch nocodb");
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
        `PageInfo invalid , res_json is ${JSON.stringify(res_json)}`
      );
    }
  }

  function _parse_list_field<T>(
    res_json: unknown,
    check_item: (it: unknown) => it is T
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
            `List Item invalid , item is ${JSON.stringify(
              item
            )} , res_json is ${JSON.stringify(res_json)}`
          );
        }
      }
      return items;
    } else {
      throw new Error(`List invalid , res_json is ${JSON.stringify(res_json)}`);
    }
  }

  async function* _read_pages<T, NoPage extends true | false>(
    param: FetchOption & {
      no_page: NoPage;
      get_route: (page: NoPage extends true ? undefined : number) => Route;
    },
    typeguard: (it: unknown) => it is T
  ) {
    let page = 1;
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
        if (pageInfo && pageInfo.page !== page) {
          throw new Error(
            `Page not match , var value is ${page} , but pageInfo is ${JSON.stringify(
              pageInfo
            )}`
          );
        }
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
          `Error on fetch page ${page} , fetch_noco_param is ${JSON.stringify(
            fetch_noco_param
          )}`,
          {
            cause: err,
          }
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
      }
    );
  }

  export async function create_base(
    param: FetchOption,
    opt: {
      title: string;
      description?: string;
    }
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
      }
    );
  }

  export async function create_table(
    param: FetchOption,
    baseId: string,
    opt: CreateTableOpt
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
}
