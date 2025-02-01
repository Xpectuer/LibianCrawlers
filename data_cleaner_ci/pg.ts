import postgres from "postgres";
import { ColumnType, JSONColumnType } from "kysely";
import jsonata from "jsonata";
import { Jsons, Strs, write_file } from "./util.ts";
import { data_cleaner_ci_generated } from "./consts.ts";
import path from "node:path";
import { Nums } from "./util.ts";
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
  let completed = 0;
  if (cache_dir_exist && cache_by_id.enable) {
    let queue: Array<{
      // deno-lint-ignore no-explicit-any
      [column: string]: any;
    }> = [];
    for await (const cache_file of Deno.readDir(cache_dir)) {
      const g_id = get_g_id(cache_file);
      if (g_id === "pass") {
        continue;
      }
      const cache_file_path = path.join(cache_dir, cache_file.name);
      const obj = await Jsons.load_file(cache_file_path);
      if (obj && typeof obj === "object") {
        queue.push(obj);
      } else {
        throw new Error(
          `obj from load not a object , cache_file.name is ${cache_file.name}`
        );
      }
      if (on_bar) {
        await on_bar({ completed, total });
      }
      completed += 1;
      if (queue.length >= batch_size_final) {
        yield queue;
        queue = [];
      }
    }
    yield queue;
  }
  const create_select_sql = () =>
    sql`SELECT * FROM ${sql(schema)}.${sql(tablename)} WHERE g_id NOT IN ${sql(
      cached_ids.length > 0 ? cached_ids : [-114514]
    )}`;
  // console.debug(
  //   "Select SQL statement :",
  //   (await create_select_sql()).statement
  // );
  const cursor = create_select_sql().cursor(batch_size_final); //
  for await (const rows of cursor) {
    completed += rows.length;
    if (on_bar) {
      await on_bar({ completed, total });
    }
    yield rows;
    if (cache_by_id.enable) {
      for (const row of rows) {
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
      }
    }
  }
}

export async function* read_postgres_table_type_wrap<T>(param: {
  jsonata_exp?: null | ReturnType<typeof jsonata>;
  rows_gen: AsyncGenerator<postgres.Row[], void>;
  cache_by_id: { typename: string; enable: boolean };
}) {
  const { jsonata_exp, rows_gen } = param;
  for await (const rows of rows_gen) {
    yield await Promise.all(
      rows.map(async (it) => {
        const obj = it;
        if (jsonata_exp !== null && jsonata_exp !== undefined) {
          return {
            obj,
            [`group__${await jsonata_exp.evaluate(it)}`]: obj,
          } as T;
        } else {
          return {
            obj,
          } as T;
        }
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
