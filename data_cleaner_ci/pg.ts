import postgres from "postgres";
import { ColumnType, JSONColumnType } from "kysely";
import jsonata from "jsonata";
import { Json } from "./util.ts";

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
  const total = parseInt(
    Object.values(
      (await sql`SELECT count(*) FROM ${sql(schema)}.${sql(tablename)}`)[0]
    )[0]
  );
  if (isNaN(total)) {
    throw new Error("Count(*) return NAN");
  }
  // const bar: { addValue: (it: number) => void } | null = progress_bar
  //   ? new ProgressBar({ maxValue: total })
  //   : null;
  const cursor = sql`SELECT * FROM ${sql(schema)}.${sql(tablename)}`.cursor(
    batch_size ?? 1
  );
  let completed = 0;
  for await (const rows of cursor) {
    completed += rows.length;
    if (on_bar) {
      await on_bar({ completed, total });
    }
    yield rows;
  }
}

export async function* read_postgres_table_type_wrap<T>(param: {
  jsonata_exp?: null | ReturnType<typeof jsonata>;
  rows_gen: AsyncGenerator<postgres.Row[], void>;
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

  export type JSON<T extends null | Json.JSONArray | Json.JSONObject> =
    JSONColumnType<T, T, T>;
}
