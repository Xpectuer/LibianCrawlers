import postgres from "postgres";

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

export async function read_postgres_table_unknown_type(
  params: PostgresConnectionParam & PostgresTableDefine
) {
  const { dbname, user, password, host, port, schema, tablename } = params;
  const sql = postgres({
    host,
    port,
    user,
    password,
    database: dbname,
    ssl: "require",
  });
  const cursor = sql`SELECT * FORM ${sql(schema, ".", tablename)}`.cursor();
  for await (const [row] of cursor) {
    console.debug("row is ", { row });
  }
}

export async function code_gen_main() {
  
}

if (import.meta.main) {
  await code_gen_main();
}
