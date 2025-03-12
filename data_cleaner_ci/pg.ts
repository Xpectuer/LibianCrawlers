import postgres from "postgres";
import { ColumnType, JSONColumnType } from "kysely";
import jsonata from "jsonata";
import {
  DataClean,
  is_deep_equal,
  Jsonatas,
  Jsons,
  Streams,
  Strs,
  Times,
  write_file,
} from "./util.ts";
import { data_cleaner_ci_generated } from "./consts.ts";
import path from "node:path";
import { Nums } from "./util.ts";
import { delay } from "@std/async/delay";
// import { filesize } from "filesize";

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

export async function* read_postgres_table(
  params: PostgresConnectionParam &
    PostgresTableDefine & {
      batch_size?: number;
      idle_timeout?: number;
      on_bar?: (bar_render_param: {
        completed: number;
        total: number;
      }) => Promise<void>;
    } & {
      cache_by_id: {
        typename: string;
        enable: boolean;
      };
    }
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
  } = params;
  const sql = postgres({
    host,
    port,
    user,
    password,
    database: dbname,
    ssl,
    debug: true,
    idle_timeout: idle_timeout ?? 5,
  });
  const { typename } = cache_by_id;
  const batch_size_final = batch_size ?? 1;
  const cached_ids: Array<number> = [];
  const cache_dir = path.join(
    data_cleaner_ci_generated,
    ".cache_by_id",
    typename
  );
  const get_g_id = (cache_file: Deno.DirEntry) => {
    if (!Strs.endswith(cache_file.name, ".json")) {
      console.warn(`ignore invalid file ${cache_file}`);
      return "pass";
    }
    const g_id_str = Strs.remove_suffix(cache_file.name, ".json");
    const g_id = parseInt(g_id_str);
    if (isNaN(g_id) || g_id < 0) {
      throw new Error(`Invalid g_id string ${g_id} , file is ${cache_file}`);
    }
    return g_id;
  };
  let cache_dir_exist: boolean;
  try {
    const e = await Deno.stat(cache_dir);
    cache_dir_exist = e.isDirectory;
  } catch (_err) {
    cache_dir_exist = false;
  }
  console.debug("cache_dir_exist=", cache_dir_exist);
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
        `Can't read ${cache_dir} , maybe it not exist ... error is ${err}`
      );
    }
  }
  console.info("cached_ids.length is", cached_ids.length);
  const total = parseInt(
    Object.values(
      (await sql`SELECT count(*) FROM ${sql(schema)}.${sql(tablename)}`)[0]
    )[0]
  );
  console.debug("total=", total);
  if (isNaN(total)) {
    throw new Error("Count(*) return NAN");
  }
  const completed = {
    value: 0,
  };
  const existed_writer = async function* () {
    if (cache_dir_exist && cache_by_id.enable) {
      let gid_list: number[] = [];
      let memory_limit_guess: number[] = [];
      let buffer: Array<Jsons.JSONObject> = [];
      const gen = (async function* () {
        for await (const cache_file of Deno.readDir(cache_dir)) {
          const g_id = get_g_id(cache_file);
          if (g_id === "pass") {
            continue;
          }
          const cache_file_name = cache_file.name;
          const cache_file_path = path.join(cache_dir, cache_file_name);
          const [cache_file_stat, bytes] = await Promise.all([
            Deno.stat(cache_file_path),
            Deno.readFile(cache_file_path),
          ]);
          yield {
            g_id,
            cache_file_name,
            cache_file_path,
            cache_file_stat,
            bytes,
          };
        }
      })();
      for await (const cache_file of Streams.backpressure({
        gen: gen,
        queue_size: 10,
      })()) {
        const value = Jsons.load(Strs.parse_utf8(cache_file.bytes));
        if (value && typeof value === "object" && !Array.isArray(value)) {
          buffer.push(value);
          memory_limit_guess.push(cache_file.cache_file_stat.size);
          gid_list.push(cache_file.g_id);
        } else {
          throw new Error(
            `obj from load not a object , cache_file.name is ${cache_file.cache_file_name}`
          );
        }
        const preventOOM =
          memory_limit_guess.reduce((p, c) => p + c) >= 50 * 1024 * 1024;
        if (preventOOM || buffer.length >= batch_size_final) {
          if (preventOOM) {
            // console.debug(
            //   "preventOOM",
            //   gid_list
            //     .map((it, idx) => [it, memory_limit_guess[idx]])
            //     .sort((a, b) => b[1] - a[1])
            //     .map(([it, size]) => [it, filesize(size)])
            // );
          }
          yield buffer;
          buffer = [];
          memory_limit_guess = [];
          gid_list = [];
          if (preventOOM) {
            await delay(200);
          }
        }
        completed.value += 1;
        if (on_bar) {
          await on_bar({ completed: completed.value, total });
        }
      }
      yield buffer;
    }

    const create_select_sql = () =>
      sql`SELECT * FROM ${sql(schema)}.${sql(
        tablename
      )} WHERE g_id NOT IN ${sql(
        cached_ids.length > 0 ? cached_ids : [-114514]
      )}`;
    // console.debug(
    //   "Select SQL statement :",
    //   (await create_select_sql()).statement
    // );
    const cursor = create_select_sql().cursor(batch_size_final); //
    for await (const rows of cursor) {
      completed.value += rows.length;
      if (on_bar) {
        await on_bar({ completed: completed.value, total });
      }
      // console.debug("cursor next rows , completed is ", completed.value);
      const write_cache_promise = (async () => {
        if (cache_by_id.enable) {
          await Promise.all(
            rows.map(async (row) => {
              const g_id = row["g_id"];
              if (Nums.is_int(g_id)) {
                await write_file({
                  file_path: path.join(cache_dir, `${g_id}.json`),
                  creator: {
                    mode: "text",
                    // deno-lint-ignore require-await
                    content: async () => Jsons.dump(row, { indent: 2 }),
                  },
                  log_tag: "no",
                });
              } else {
                throw new Error(
                  `g_id is not number , rows[0] is ${JSON.stringify(rows[0])}`
                );
              }
            })
          );
        }
      })();
      yield rows;
      await write_cache_promise;
    }
  };
  const start_at = new Date().getTime();
  for await (const existed of existed_writer()) {
    yield existed;
  }
  console.debug(
    "\n\nCast time of foreach rows iterator from postgres (unit is s):",
    (new Date().getTime() - start_at) / 1000.0
  );
}

export type JsonataTemplate = string;

export async function* read_postgres_table_type_wrap<T>(param: {
  jsonata_exp?: null | ReturnType<typeof jsonata>;
  rows_gen: AsyncGenerator<postgres.Row[], void>;
  cache_by_id: { typename: string; enable: boolean };
  with_jsonata_template: JsonataTemplate[] | null | undefined;
}) {
  const { jsonata_exp, rows_gen, with_jsonata_template } = param;
  Jsonatas.register_common_function_on_exp(jsonata_exp);
  for await (const rows of rows_gen) {
    yield await Promise.all(
      rows.map(async (it) => {
        const _after_jsonata_template = await (async () => {
          if (!with_jsonata_template) {
            return it;
          }
          const res = { ...it };
          for (const template_name of with_jsonata_template) {
            const jsonata_template_exp = jsonata(
              await Deno.readTextFile(
                path.join("jsonata_templates", `${template_name}.jsonata`)
              )
            );
            Jsonatas.register_common_function_on_exp(jsonata_template_exp);
            res[`template_${template_name}`] =
              await jsonata_template_exp.evaluate(it);
          }
          return res;
        })();

        const _after_jsonate_group = await (async () => {
          if (jsonata_exp !== null && jsonata_exp !== undefined) {
            return {
              obj: _after_jsonata_template,
              [`group__${await jsonata_exp.evaluate(it)}` as const]:
                _after_jsonata_template,
            };
          } else {
            return {
              obj: _after_jsonata_template,
            };
          }
        })();

        return _after_jsonate_group as T;
      })
    );
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
  const keys = new Set(Object.keys(dto1));
  if (!is_deep_equal(keys, new Set(Object.keys(dto2)))) {
    return false;
  }
  for (const key of keys) {
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
    return false;
  }
  return true;
}
