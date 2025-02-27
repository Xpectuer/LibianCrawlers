import path from "node:path";
import config from "./config.ts";
import { read_postgres_table, read_postgres_table_type_wrap } from "./pg.ts";
import { jsonInputForTargetLanguage } from "quicktype-core";
import jsonata from "jsonata";
import { data_cleaner_ci_generated } from "./consts.ts";
import { Jsons, ProcessBar } from "./util.ts";
import {
  quicktype,
  InputData,
  TypeScriptTargetLanguage,
  TypeScriptRenderer,
  RenderContext,
  getOptionValues,
  tsFlowOptions,
  EnumType,
  Name,
} from "quicktype-core";
import { utf16StringEscape } from "quicktype-core/dist/support/Strings.js";
import ts from "typescript";
import { fastype, OnTopLevelInput } from "./fastype/index.ts";

// https://github.com/glideapps/quicktype/issues/1234
export class MyTypeScriptTargetLanguage extends TypeScriptTargetLanguage {
  protected override makeRenderer(
    renderContext: RenderContext,
    untypedOptionValues: { [name: string]: any }
  ): MyTypeScriptRenderer {
    console.debug("untypedOptionValues : ", untypedOptionValues);
    return new MyTypeScriptRenderer(
      this,
      renderContext,
      getOptionValues(tsFlowOptions, untypedOptionValues)
    );
  }

  // public override get supportsUnionsWithBothNumberTypes(): boolean {
  //   return true;
  // }
}

export class MyTypeScriptRenderer extends TypeScriptRenderer {
  protected override emitEnum(e: EnumType, enumName: Name): void {
    this.emitDescription(this.descriptionForType(e));
    this.emitLine(["export type ", enumName, " = "]);
    this.forEachEnumCase(e, "none", (_name, jsonName, position) => {
      const suffix = position === "last" || position === "only" ? ";" : " | ";
      this.indent(() =>
        this.emitLine(`"${utf16StringEscape(jsonName)}"`, suffix)
      );
    });
  }
}

const _TIP = `此文件由 code_gen.ts 生成。
请通过修改 ${data_cleaner_ci_generated}/config.json 来修改此文件，
而不是直接修改此文件。` as const;

function j(o: Jsons.JSONValue) {
  return Jsons.dump(o);
}

export async function code_gen_main() {
  return await ProcessBar.create_scope(
    {
      title: "The code_gen.ts file is generating code",
    },
    async (bars) => await generate_repository_api(bars)
  );
}

export async function generate_repository_api(
  bars: Parameters<Parameters<typeof ProcessBar.create_scope>[1]>[0]
) {
  const tasks: ((
    param: unknown,
    bar: ProcessBar.SingleBarSetter
  ) => Promise<void>)[] = [];
  for (const repository of config.repositories) {
    if (repository.typ === "postgres") {
      tasks.push(
        ...repository.dataset_tables.map((table) => {
          return async (_param: unknown, bar: ProcessBar.SingleBarSetter) => {
            const typename = table.dataset_typename;
            const typedesc = `postgres(${repository.param.host}:${repository.param.port}) 的表 ${table.schema}.${table.tablename}`;
            const jsonata_exp =
              "group_by_jsonata" in table
                ? jsonata(table.group_by_jsonata)
                : null;
            await bar.set_text(`(1/2)reading ${typename}`);
            const cache_by_id = {
              typename,
              enable: table.cache_by_id === true,
            };
            const step1_total_remember = {
              value: 0,
            };
            const samples_gen = read_postgres_table_type_wrap({
              jsonata_exp,
              rows_gen: read_postgres_table({
                ...repository.param,
                ...table,
                batch_size: table.batch_size.code_gen,
                on_bar: async (bar_render_param) => {
                  step1_total_remember.value = bar_render_param.total;
                  await bar.set_total(1 + step1_total_remember.value);
                  await bar.set_completed(bar_render_param.completed);
                },
                cache_by_id,
              }),
              cache_by_id,
              with_jsonata_template: table.with_jsonata_template,
            });
            await generate_repository_api_type({
              typename,
              typedesc,
              samples_gen,
              fastype_on_top_level_input: async (idx) => {
                // console.debug('bar.get_completed()',bar.get_completed())
                await bar.set_completed(step1_total_remember.value + idx);
              },
              fastype_on_inputs: async (inputs) => {
                await bar.set_total(inputs.length * 2);
                await bar.set_text(`(2/2)typing ${typename}`);
              },
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
  
  export function read_${typename}(options?: {
  on_bar?: (bar_render_param: {
    completed: number;
    total: number;
  }) => Promise<void>;
  }):AsyncGenerator<
  ${typename}[],
  void
  >{
  
  const cache_by_id = {
    typename: ${j(typename)},
    enable: ${j(table.cache_by_id === true)},
  };

  const rows_gen = read_postgres_table({
  dbname: ${j(repository.param.dbname)},
  user: ${j(repository.param.user)},
  password: ${j(repository.param.password)},
  host: ${j(repository.param.host)},
  port: ${j(repository.param.port)},
  ssl: ${
    typeof repository.param.ssl === "string"
      ? j(repository.param.ssl)
      : repository.param.ssl
  },
  schema: ${j(table.schema)},
  tablename: ${j(table.tablename)},
  batch_size: ${j(table.batch_size.api)},
  cache_by_id,
  on_bar: options?.on_bar,
  });
  
  const jsonata_exp = ${
    "group_by_jsonata" in table
      ? `jsonata(${j(table.group_by_jsonata)})`
      : `null`
  }
  
  const with_jsonata_template = ${j(table.with_jsonata_template)}

  return read_postgres_table_type_wrap<${typename}>({
  rows_gen,
  jsonata_exp,
  cache_by_id,
  with_jsonata_template,
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
            const sourcefile = ts.createSourceFile(
              path.basename(api_file_path),
              api_file_content,
              ts.ScriptTarget.Latest
            );
            const printer = ts.createPrinter({
              newLine: ts.NewLineKind.LineFeed,
            });
            await Deno.writeTextFile(
              api_file_path,
              printer.printFile(sourcefile)
            );

            // console.debug(
            //   `Generated: ${api_file_path}\n> You can run it's example : \`${deno_run_script}\` `
            // );
          };
        })
      );
    }
  }
  await Promise.all(
    ProcessBar.bind_each(tasks, bars.render).map((task) => task(void 0))
  );
  // console.info("OK");
}

export async function generate_repository_api_type<T>(param: {
  typename: string;
  typedesc: string;
  samples_gen: AsyncGenerator<T[]>;
  use_lib?: "quicktype" | "fastype";
  fastype_on_top_level_input?: OnTopLevelInput;
  fastype_on_inputs?: (inputs: unknown[]) => Promise<void>;
}) {
  const {
    typename,
    typedesc,
    samples_gen,
    use_lib,
    fastype_on_top_level_input,
    fastype_on_inputs,
  } = param;
  console.info(`正在生成 ${typedesc} 的代码。`);
  let res_file_content: string;
  if (!use_lib || use_lib === "quicktype") {
    const jsonInput = jsonInputForTargetLanguage("typescript");
    for await (const samples_res of samples_gen) {
      await jsonInput.addSource({
        name: typename,
        samples: samples_res.map((it) => JSON.stringify(it)),
        description: typedesc + `\n\n${_TIP}`,
      });
    }
    const inputData = new InputData();
    inputData.addInput(jsonInput);
    const res_quicktype = await quicktype({
      inputData,
      lang: new MyTypeScriptTargetLanguage(),
      checkProvenance: true,
      debugPrintTimes: true,
      fixedTopLevels: true,
      rendererOptions: {
        declareUnions: true,
        preferUnions: true,
        preferConstValues: true,
        runtimeTypecheck: true,
        runtimeTypecheckIgnoreUnknownProperties: true,
      },
      combineClasses: true,
      // inferMaps: false,
      // inferEnums: true,
      // inferUuids: false,
      // inferDateTimes: false,
      // inferIntegerStrings: false,
      // inferBooleanStrings: false,
      // ignoreJsonRefs: true,
    });
    res_file_content = res_quicktype.lines.join("\n");
  } else {
    const inputs = [];
    for await (const samples_res of samples_gen) {
      for (const sample_res of samples_res) {
        inputs.push(sample_res);
      }
    }
    if (fastype_on_inputs) {
      await fastype_on_inputs(inputs);
    }
    res_file_content = await fastype({
      inputs,
      typename,
      on_top_level_input: fastype_on_top_level_input,
    });
  }
  const res_file_path = path.join(data_cleaner_ci_generated, typename + ".ts");

  await Deno.writeTextFile(res_file_path, res_file_content);
  console.log(`Genarated: ${res_file_path}`);
}

if (import.meta.main) {
  await code_gen_main();
}
