import path from "node:path";
import config from "./config.ts";
import { read_postgres_table, read_postgres_table_type_wrap } from "./pg.ts";
import {
  quicktype,
  InputData,
  jsonInputForTargetLanguage,
} from "quicktype-core";
import jsonata from "jsonata";
import { data_cleaner_ci_generated } from "./consts.ts";

const _TIP = `此文件由 code_gen.ts 生成。
请通过修改 ${data_cleaner_ci_generated}/config.json 来修改此文件，
而不是直接修改此文件。` as const;

function j(o: string | number) {
  return JSON.stringify(o, null, 2).split("\n").join("\n  ");
}

export async function code_gen_main() {
  await generate_repository_api();
}

export async function generate_repository_api() {
  for (const repository of config.repositories) {
    if (repository.typ === "postgres") {
      for (const table of repository.dataset_tables) {
        const typename = table.dataset_typename;
        const typedesc = `postgres(${repository.param.host}:${repository.param.port}) 的表 ${table.schema}.${table.tablename}`;
        const jsonata_exp =
          "group_by_jsonata" in table ? jsonata(table.group_by_jsonata) : null;
        const samples_gen = read_postgres_table_type_wrap({
          jsonata_exp,
          rows_gen: read_postgres_table({
            ...repository.param,
            ...table,
            batch_size: table.batch_size.code_gen,
            progress_bar: true,
          }),
        });
        await generate_repository_api_type({
          typename,
          typedesc,
          jsonata_exp,
          samples_gen,
        });

        const api_file_path = path.join(
          data_cleaner_ci_generated,
          typename + "_api.ts"
        );
        const deno_run_script = `deno run --allow-env=PG* --allow-net=${repository.param.host}:${repository.param.port} ${api_file_path}`;
        const api_file_content = `//
// ${_TIP.split("\n").join("\n// ")}
//
// \`\`\`shell
// ${deno_run_script}
// \`\`\`
import jsonata from "jsonata";
import { read_postgres_table, read_postgres_table_type_wrap } from "../pg.ts"
import { ${typename} } from "./${typename}.ts"

export function read_${typename}():AsyncGenerator<
  ${typename}[],
  void
>{

  const rows_gen = read_postgres_table({
    dbname: ${j(repository.param.dbname)},
    user: ${j(repository.param.user)},
    password: ${j(repository.param.password)},
    host: ${j(repository.param.host)},
    port: ${j(repository.param.port)},
    schema: ${j(table.schema)},
    tablename: ${j(table.tablename)},
    batch_size: ${j(table.batch_size.api)},
  });

  const jsonata_exp = ${
    "group_by_jsonata" in table
      ? `jsonata(${j(table.group_by_jsonata)})`
      : `null`
  }

  return read_postgres_table_type_wrap<${typename}>({
    rows_gen,
    jsonata_exp,
  })
}

async function _main() {
  for await (const res of read_${typename}()) {
    console.log("Generate result is", res);
    break;
  }
  console.log("OK");
}

if (import.meta.main) {
  await _main();
}
`;

        await Deno.writeTextFile(api_file_path, api_file_content);
        console.debug(
          `Generated: ${api_file_path}\n> You can run it's example : \`${deno_run_script}\` `
        );
      }
    }
  }
}

export async function generate_repository_api_type<T>(param: {
  typename: string;
  typedesc: string;
  jsonata_exp?: null | ReturnType<typeof jsonata>;
  samples_gen: AsyncGenerator<T[]>;
}) {
  const { typename, typedesc, samples_gen } = param;
  const jsonInput = jsonInputForTargetLanguage("typescript");
  console.log(`正在生成 ${typedesc} 的代码。`);

  let samples_res = await samples_gen.next();
  while (!samples_res.done) {
    await jsonInput.addSource({
      name: typename,
      samples: samples_res.value.map((it) => JSON.stringify(it)),
      description: typedesc + `\n\n${_TIP}`,
    });
    samples_res = await samples_gen.next();
  }
  const inputData = new InputData();
  inputData.addInput(jsonInput);
  const res_quicktype = await quicktype({
    inputData,
    lang: "typescript",
  });
  const res_file_path = path.join(data_cleaner_ci_generated, typename + ".ts");
  await Deno.writeTextFile(res_file_path, res_quicktype.lines.join("\n"));
  console.log(`Genarated: ${res_file_path}`);
}

if (import.meta.main) {
  await code_gen_main();
}
