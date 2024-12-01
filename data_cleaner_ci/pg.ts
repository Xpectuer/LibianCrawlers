import postgres from "postgres";
import ProgressBar from "console-progress-bar";

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
    }
) {
  console.debug("Start read postgres table :", params);
  const { dbname, user, password, host, port, schema, tablename, batch_size } =
    params;
  const sql = postgres({
    host,
    port,
    user,
    password,
    database: dbname,
    // ssl: "require",
    debug: true,
    idle_timeout: 60,
  });
  const total = parseInt(
    Object.values(
      (await sql`SELECT count(*) FROM ${sql(schema)}.${sql(tablename)}`)[0]
    )[0]
  );
  if (isNaN(total)) {
    throw new Error("Count(*) return NAN");
  }
  const bar = new ProgressBar({ maxValue: total });
  const cursor = sql`SELECT * FROM ${sql(schema)}.${sql(tablename)}`.cursor(
    batch_size ?? 1
  );
  for await (const rows of cursor) {
    yield rows;
    bar.addValue(rows.length);
  }
}
