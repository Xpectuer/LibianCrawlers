import postgres from "postgres";
import ProgressBar from "console-progress-bar";
import jsonata from "jsonata";

export type PostgresConnectionParam = {
  dbname: string;
  user: string;
  password: string;
  host: string;
  port: number;
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
      progress_bar?: boolean;
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
    tablename,
    batch_size,
    idle_timeout,
    progress_bar,
  } = params;
  const sql = postgres({
    host,
    port,
    user,
    password,
    database: dbname,
    // ssl: "require",
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
  const bar: { addValue: (it: number) => void } | null = progress_bar
    ? new ProgressBar({ maxValue: total })
    : null;
  const cursor = sql`SELECT * FROM ${sql(schema)}.${sql(tablename)}`.cursor(
    batch_size ?? 1
  );
  for await (const rows of cursor) {
    yield rows;
    if (bar) {
      bar.addValue(rows.length);
    }
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
