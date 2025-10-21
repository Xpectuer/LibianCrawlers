import postgres from "postgres";
import { ColumnType, JSONColumnType } from "kysely";
import jsonata from "jsonata";
import {
  Arrays,
  DataClean,
  Errors,
  is_deep_equal,
  Jsonatas,
  Jsons,
  Mappings,
  Paths,
  SizeOf,
  Streams,
  Strs,
  Times,
  write_file,
} from "./util.ts";
import { data_cleaner_ci_generated } from "./consts.ts";
import path from "node:path";
import { Nums } from "./util.ts";
import { delay } from "@std/async/delay";
import { isDate } from "node:util/types";

const _PG_DEBUG = false;
const _debug_obj = <T>(msg: string, ctx: unknown, obj: T) => {
  if (_PG_DEBUG) {
    console.debug(`\n${msg}`, {
      ctx,
      obj,
    });
  }
  return obj;
};

export type PostgresConnectionParam = {
  dbname: string;
  user: string;
  password: string;
  host: string;
  port: number;
  ssl: boolean | "require" | "allow" | "prefer" | "verify-full";
};

export type PostgresTableDefine = {
  schema: string;
  tablename: string;
};

export type ReadPostgresTableSkipExisted = (
  g_id: number,
  total: number,
) => Promise<"skip" | "no-skip">;

/**
 * 读取 postgres 数据库的一致接口。
 *
 * @param params.network 为 false 时，将不会读取远程 postgres 数据库，而是仅从本地缓存中读取。
 *
 * 这在postgres服务机崩溃，但是数据计算的开发机正常，需要【数据恢复】时非常有用。
 *
 * 同时也可以用于本地缓存业务代码开发使用。
 *
 * @param params.skip_existed 与跳过读取的业务相关的回调参数.（例如在 code_gen 的过程中， 发现 batch_100_200.ts 已存在，则会跳过读取 100-200 的数据）
 *
 * 传入的回调函数将会影响业务逻辑。
 */
export async function* read_postgres_table(
  params:
    & PostgresConnectionParam
    & PostgresTableDefine
    & {
      batch_size: number;
      idle_timeout?: number;
      on_bar?: (bar_render_param: {
        completed: number;
        total: number;
      }) => Promise<void>;
    }
    & {
      cache_by_id: {
        typename: string;
        enable: boolean;
      };
      network: boolean;
      debugopt_logtime: boolean;
      // prevent_oom_batch_mem_size: number;
      on_total?: (total: number) => Promise<"continue" | "return">;
      skip_existed?:
        | null
        | ReadPostgresTableSkipExisted;
    },
) {
  console.debug("Start read postgres table :", params);
  const {
    dbname,
    user,
    password,
    host,
    port,
    schema,
    ssl,
    tablename,
    batch_size,
    idle_timeout,
    on_bar,
    cache_by_id,
    network,
    debugopt_logtime,
    on_total,
    skip_existed,
  } = params;
  // deno-lint-ignore ban-types
  let sql: postgres.Sql<{}>;
  if (network) {
    sql = postgres({
      host,
      port,
      user,
      password,
      database: dbname,
      ssl,
      debug: true,
      idle_timeout: idle_timeout ?? 5,
    });
  } else {
    // deno-lint-ignore no-explicit-any
    sql = "Disabled on --no-network" as any;
  }
  const { typename } = cache_by_id;
  const cached_ids: Array<number> = [];
  const cache_dir = path.join(
    data_cleaner_ci_generated,
    ".cache_by_id",
    typename,
  );
  /**
   * 识别文件名中的garbage主键id
   * @param cache_file
   * @returns 如果并非json文件，则返回 "pass"。
   */
  const get_g_id = (cache_file: Deno.DirEntry) => {
    if (!Strs.endswith(cache_file.name, ".json")) {
      console.warn(`ignore invalid file ${cache_file}`);
      return "pass";
    }
    const g_id_str = Strs.remove_suffix(cache_file.name, ".json");
    const g_id = parseInt(g_id_str);
    if (Nums.is_invalid(g_id) || g_id < 0) {
      throw new Error(`Invalid g_id string ${g_id} , file is ${cache_file}`);
    }
    return g_id;
  };
  let cache_dir_exist: boolean;
  try {
    const cache_dir_file_info = await Deno.stat(cache_dir);
    cache_dir_exist = cache_dir_file_info.isDirectory;
  } catch (_err) {
    cache_dir_exist = false;
  }
  console.debug("cache_dir_exist = ", cache_dir_exist);
  if (cache_dir_exist && cache_by_id.enable) {
    try {
      for await (const cache_file of Deno.readDir(cache_dir)) {
        const g_id = get_g_id(cache_file);
        if (g_id === "pass") {
          continue;
        }
        cached_ids.push(g_id);
      }
    } catch (err) {
      console.warn(
        `Can't read ${cache_dir} , maybe it not exist ... error is ${err}`,
      );
    }
  }
  console.info("cached_ids.length is", cached_ids.length);
  let total: number;
  if (network) {
    total = parseInt(
      Object.values(
        (await sql`SELECT count(*) FROM ${sql(schema)}.${sql(tablename)}`)[0],
      )[0],
    );
  } else {
    total = cached_ids.length;
  }
  console.debug("total=", total);
  if (Nums.is_invalid(total)) {
    throw new Error(`Count(*) return NAN , total is ${total}`);
  }
  if (on_total) {
    switch (await on_total(total)) {
      case "return":
        return;
      case "continue":
    }
  }
  const completed = {
    value: 0,
  };
  const values_generator = async function* () {
    if (cache_dir_exist && cache_by_id.enable) {
      let gid_list: number[] = [];
      // let memory_limit_guess: number[] = [];
      let buffer: Array<Jsons.JSONObject | "skip"> = [];

      const cache_file_generator = (async function* () {
        let cache_file_list: Array<{
          g_id: number;
          cache_file: Deno.DirEntry;
        }> = [];

        for await (const cache_file of Deno.readDir(cache_dir)) {
          const g_id = get_g_id(cache_file);
          if (g_id === "pass") {
            continue;
          }
          if (!cache_file.isFile) {
            continue;
          }
          const cache_file_path = Paths.join2(cache_dir, cache_file.name);
          const stat_res = await Deno.stat(cache_file_path);
          if (stat_res.size <= 0) {
            // 有时中途异常推出会导致创建空文件。
            await Deno.remove(cache_file_path);
            continue;
          }
          cache_file_list.push({
            g_id,
            cache_file,
          });
        }
        cache_file_list = cache_file_list.sort((a, b) => {
          return a.g_id - b.g_id;
        });

        for (
          const batch of Streams.split_array_use_batch_size(
            batch_size,
            cache_file_list,
          )
        ) {
          let is_skip: "skip" | "no-skip";
          if (total !== batch.total && batch.total === batch.end) {
            is_skip = "no-skip";
          } else if (skip_existed) {
            const check_all_batch_can_skip = await Promise.all(
              batch.sliced.map(
                async (_, idx) => await skip_existed(batch.start + idx, total),
              ),
            );
            if (check_all_batch_can_skip.find((it) => it === "no-skip")) {
              is_skip = "no-skip";
            } else {
              is_skip = "skip";
            }
          } else {
            is_skip = "no-skip";
          }

          for (const { g_id, cache_file } of batch.sliced) {
            const cache_file_name = cache_file.name;
            const cache_file_path = path.join(cache_dir, cache_file_name);
            const cache_file_stat = await Deno.stat(cache_file_path);
            const _log_statu = (obj: object) => {
              if (_PG_DEBUG) {
                return {
                  batch_start: batch.start,
                  batch_end: batch.end,
                  batch_total: batch.total,
                  g_id,
                  cache_file_name,
                  ...obj,
                };
              }
            };
            if (is_skip === "skip") {
              yield _debug_obj(
                "cache_file_generator yield (skip)",
                _log_statu({ is_skip }),
                {
                  g_id,
                  cache_file_name,
                  cache_file_path,
                  cache_file_stat,
                  bytes: null,
                  is_skip: "skip" as const,
                },
              );
            } else {
              const start_at = new Date().getTime();
              const bytes = await Deno.readFile(cache_file_path);
              const end_at = new Date().getTime();
              if (end_at - start_at > 1000) {
                if (debugopt_logtime || end_at - start_at > 5000) {
                  console.debug("WARN: read cache file too slow", {
                    cast_time: `${(end_at - start_at) / 1000} s`,
                    cache_file_name,
                  });
                  console.debug(""); // next line
                }
              }
              yield _debug_obj(
                "cache_file_generator yield (no-skip)",
                _log_statu({ is_skip }),
                {
                  g_id,
                  cache_file_name,
                  cache_file_path,
                  cache_file_stat,
                  bytes,
                  is_skip: "no-skip" as const,
                },
              );
            }
          }
        }
      })();

      for await (const cache_file of cache_file_generator) {
        let value: Jsons.JSONValue;
        if (cache_file.is_skip === "skip") {
          value = "skip";
        } else {
          if (cache_file.bytes === null) {
            throw new Error("Assert cache_file.bytes not null");
          }

          try {
            value = Jsons.load(Strs.parse_utf8(cache_file.bytes));
          } catch (err) {
            Errors.throw_and_format("Failed parse json from cache_file", {
              cache_file_path: cache_file.cache_file_path,
              err,
              bytes_len: cache_file.bytes.length,
            }, err);
          }
        }
        if (
          value === "skip" ||
          (value && typeof value === "object" && !Array.isArray(value))
        ) {
          buffer.push(value);
          // memory_limit_guess.push(cache_file.cache_file_stat.size);
          gid_list.push(cache_file.g_id);
        } else {
          throw new Error(
            `obj from load not a object , cache_file.name is ${cache_file.cache_file_name}`,
          );
        }

        if (buffer.length >= batch_size) {
          if (debugopt_logtime) {
            console.debug("yield batch");
          }
          yield buffer;
          buffer = [];
          // memory_limit_guess = [];
          gid_list = [];
          // if (preventOOM) {
          // await delay(4);
          // }
        }
        completed.value += 1;
        if (on_bar) {
          await on_bar({ completed: completed.value, total });
        }
      }
      yield buffer;
    }

    const _create_select_sql = () =>
      sql`SELECT * FROM ${sql(schema)}.${
        sql(
          tablename,
        )
      } WHERE g_id NOT IN ${
        sql(
          cached_ids.length > 0 ? cached_ids : [-114514],
        )
      }`;

    if (network) {
      const cursor = _create_select_sql().cursor(batch_size);
      for await (const rows of cursor) {
        completed.value += rows.length;
        // 将 postgres 日期列的 Date对象 转为字符串，以便 Jsons.dump
        for (const row of rows) {
          for (const k of Mappings.object_keys(row)) {
            if (row[k] instanceof Date) {
              row[k] = row[k].toISOString();
            }
          }
        }
        if (on_bar) {
          await on_bar({ completed: completed.value, total });
        }
        // console.debug("cursor next rows , completed is ", completed.value);
        const add_to_cache_promise = (async () => {
          if (cache_by_id.enable) {
            await Promise.all(
              rows.map(async (row) => {
                const g_id = row["g_id"];
                if (Nums.is_int(g_id)) {
                  const json_content = Jsons.dump(row, { indent: 2 });
                  await write_file({
                    file_path: path.join(cache_dir, `${g_id}.json`),
                    creator: {
                      mode: "text",
                      // deno-lint-ignore require-await
                      content: async () => json_content,
                    },
                    log_tag: "no",
                  });
                } else {
                  throw new Error(
                    `g_id is not number , rows[0] is ${
                      JSON.stringify(rows[0])
                    }`,
                  );
                }
              }),
            );
          }
        })();
        yield rows;
        await add_to_cache_promise;
      }
    } else {
      console.info("Not read postgres because --no-network");
    }
  };
  const start_at = new Date().getTime();
  let batch_cached_start_at = new Date().getTime();
  let buffer: (Jsons.JSONObject | "skip" | postgres.Row)[] = [];
  for await (const values of values_generator()) {
    if (debugopt_logtime) {
      console.debug("batch cached yield status :", {
        cast_time: `${(new Date().getTime() - batch_cached_start_at) / 1000} s`,
        batch_size: values.length,
      });
    }
    for (const value of values) {
      buffer.push(value);
      if (buffer.length >= batch_size) {
        yield buffer;
        buffer = [];
      }
    }
    batch_cached_start_at = new Date().getTime();
  }
  if (buffer.length > 0) {
    yield buffer;
  }

  console.debug(
    `\n\nCast time of foreach rows iterator from ${
      [
        ...(network ? ["postgres"] : []),
        ...(cache_by_id.enable
          ? [
            `./${data_cleaner_ci_generated}/cache_by_id/${cache_by_id.typename}`,
          ]
          : []),
      ].join(" and ")
    }(unit is s):`,
    (new Date().getTime() - start_at) / 1000.0,
  );
}

export type JsonataTemplate = string;

export async function* read_postgres_table_type_wrap<
  SkipExisted extends boolean,
  T extends { obj: unknown } = { obj: unknown },
>(param: {
  jsonata_exp?: null | string;
  rows_gen: AsyncGenerator<(postgres.Row | "skip")[], void>;
  cache_by_id: { typename: string; enable: boolean };
  with_jsonata_template: JsonataTemplate[] | null | undefined;
  debugopt_logtime: boolean;
  high_water_mark: number;
  skip_existed: SkipExisted;
}): AsyncGenerator<
  (SkipExisted extends true ? "skip" | T : T)[],
  void,
  unknown
> {
  const {
    jsonata_exp,
    rows_gen,
    with_jsonata_template,
    debugopt_logtime,
    high_water_mark,
    skip_existed: code_gen_skip_existed,
  } = param;

  const rows_gen_queued = high_water_mark <= 0
    ? rows_gen
    : Streams.queue_cached({
      gen: rows_gen,
      queue_size: high_water_mark,
      before_event(ev) {
        if (_PG_DEBUG || debugopt_logtime) {
          if (ev === "reader_delay_queue_full") {
            console.debug("\nread_postgres_table_type_wrap queue full");
          }
          if (ev === "write_pop") {
            console.debug("\nread_postgres_table_type_wrap queue consume");
          }
        }
      },
    })();

  for await (const rows of rows_gen_queued) {
    if (_PG_DEBUG) {
      console.debug("\nread_postgres_table_type_wrap debug", {
        len: rows.length,
        first: rows[0],
      });
    }
    const typing_wrap_start_at = new Date().getTime();
    const typing_wrap_result = await Promise.all(
      rows.map(async (it) => {
        if (it === "skip") {
          if (code_gen_skip_existed) {
            return it;
          } else {
            throw new Error("Disallow skip");
          }
        }
        const _after_jsonata_template = await (async () => {
          if (!with_jsonata_template) {
            return it;
          }
          const _it: postgres.Row = it;
          const res = { ..._it };
          for (const template_name of with_jsonata_template) {
            res[`template_${template_name}` as const] = await Jsonatas
              .evaluate_in_worker({
                script: { template_name },
                data: _it,
                debugopt_logtime_for_jsonata_evalute_too_slow: -1,
              });
          }
          return res;
        })();

        const _after_jsonate_group = await (async () => {
          if (jsonata_exp) {
            return {
              obj: _after_jsonata_template,
              [
                `group__${await Jsonatas.evaluate_in_worker({
                  script: { content: jsonata_exp },
                  data: it,
                  debugopt_logtime_for_jsonata_evalute_too_slow: -1,
                })}` as const
              ]: _after_jsonata_template,
            };
          } else {
            return {
              obj: _after_jsonata_template,
            };
          }
        })();

        return _after_jsonate_group as T;
      }),
    );
    if (_PG_DEBUG || debugopt_logtime) {
      console.debug("batch typing wrap status", {
        cast_time: `${(new Date().getTime() - typing_wrap_start_at) / 1000} s`,
        typing_wrap_batch_size: typing_wrap_result.length,
      });
    }
    const _typing_wrap_result: (SkipExisted extends true ? "skip" | T
      // deno-lint-ignore no-explicit-any
      : T)[] = typing_wrap_result as any;
    yield _typing_wrap_result;
  }
}

// deno-lint-ignore no-namespace
export namespace PostgresColumnType {
  export type Numeric = ColumnType<string, number | string, number | string>;

  export type JSON<T extends null | Jsons.JSONArray | Jsons.JSONObject> =
    JSONColumnType<T, T, T>;
}

/**
 * 由于 SelectObject 和 InsertObject 存在不同，因此这里要特殊处理。
 * @param dto1
 * @param dto2
 * @returns
 */
export function pg_dto_equal(dto1: object, dto2: object): boolean {
  if (is_deep_equal(dto1, dto2)) {
    return true;
  }
  const keys1 = new Set(Object.keys(dto1));
  const keys2 = new Set(Object.keys(dto2));
  // for (const keys of [keys1, keys2]) {
  //   // don't compare keys
  //   for (const not_cmp of ["id", "__mode__"]) {
  //     if (keys.has(not_cmp)) {
  //       keys.delete(not_cmp);
  //     }
  //   }
  // }
  if (!is_deep_equal(keys1, keys2)) {
    return false;
  }
  for (const key of keys1) {
    const v1: unknown = dto1[key];
    // deno-lint-ignore no-explicit-any
    const v2: unknown = (dto2 as any)[key];
    if (is_deep_equal(v1, v2)) {
      continue;
    }
    if (
      (typeof v1 === "string" || typeof v1 === "number") &&
      (typeof v2 === "string" || typeof v2 === "number")
    ) {
      const num1 = DataClean.parse_number(v1, "allow_nan");
      const num2 = DataClean.parse_number(v2, "allow_nan");
      if (Nums.is_invalid(num1) || Nums.is_invalid(num2)) {
        return false;
      }
      if (num1 !== num2) {
        return false;
      }
      continue;
    }
    const _v1: unknown = v1;
    const _v2: unknown = v2;
    if (isDate(_v1) && isDate(_v2)) {
      // 时区问题很难搞
      const delta = Math.abs(_v1.getTime() - _v2.getTime());
      if (
        delta === 0 ||
        delta === Math.abs(new Date().getTimezoneOffset() * 60 * 1000)
      ) {
        continue;
      } else {
        return false;
      }
    }
    return false;
  }
  return true;
}
