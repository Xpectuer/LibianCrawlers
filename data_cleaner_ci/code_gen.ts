import path from "node:path";
import config from "./config.ts";
import { read_postgres_table } from "./pg.ts";
import {
  quicktype,
  InputData,
  jsonInputForTargetLanguage,
} from "quicktype-core";
import jsonata from "jsonata";

export async function code_gen_main() {
  for (const repository of config.repositories) {
    if (repository.typ === "postgres") {
      for (const table of repository.dataset_tables) {
        const typename = table.dataset_typename;
        const typedesc = `postgres(${repository.param.host}:${repository.param.port}) 的表 ${table.schema}.${table.tablename}`;
        const jsonata_exp =
          "group_by_jsonata" in table ? jsonata(table.group_by_jsonata) : null;
        const samples_gen = read_postgres_table({
          ...repository.param,
          ...table,
          batch_size: 1000,
        });
        await generate_type({
          typename,
          typedesc,
          jsonata_exp,
          samples_gen,
        });
      }
    }
  }
}

export async function generate_type<T>(param: {
  typename: string;
  typedesc: string;
  jsonata_exp?: null | ReturnType<typeof jsonata>;
  samples_gen: AsyncGenerator<T[]>;
}) {
  const { typename, typedesc, jsonata_exp, samples_gen } = param;
  const jsonInput = jsonInputForTargetLanguage("typescript");
  console.log(`正在生成 ${typedesc} 的代码。`);
  let rows = await samples_gen.next();
  while (!rows.done) {
    const samples = (
      await Promise.all(
        rows.value.map(async (it) => {
          if (jsonata_exp !== null && jsonata_exp !== undefined) {
            return {
              obj: it,
              [`group__${await jsonata_exp.evaluate(it)}`]: it,
            };
          } else {
            return {
              obj: it,
            };
          }
        })
      )
    ).map((it) => JSON.stringify(it));

    const pm_all = await Promise.all([
      samples_gen.next(),
      jsonInput.addSource({
        name: typename,
        samples,
        description: typedesc + "\n\n此类型由 code_gen.ts 生成，请勿手动修改。",
      }),
    ]);
    rows = pm_all[0];
  }
  const inputData = new InputData();
  inputData.addInput(jsonInput);
  const res_quicktype = await quicktype({
    inputData,
    lang: "typescript",
  });
  const res_file_path = path.join(
    "data-cleaner-ci-generated",
    typename + ".ts"
  );
  await Deno.writeTextFile(res_file_path, res_quicktype.lines.join("\n"));
  console.log(`Genarated: ${res_file_path}`);
}

if (import.meta.main) {
  await code_gen_main();
}
