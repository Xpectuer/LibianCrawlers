import path from "node:path";
import config from "./config.ts";
import { read_postgres_table, read_postgres_table_type_wrap } from "./pg.ts";
import { data_cleaner_ci_generated } from "./consts.ts";
import { Jsonatas, Jsons, Nums, ProcessBar, SizeOf, Strs } from "./util.ts";
import ts from "typescript";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { QuickTypeUtil } from "./quicktypeutil.ts";

// console.debug("setGlobalVars is ", setGlobalVars);
// console.debug("createIndexedDB() result", createIndexedDB());

const _TIP = `此文件由 code_gen.ts 生成。
请通过修改 ${data_cleaner_ci_generated}/config.json 来修改此文件，
而不是直接修改此文件。` as const;

function j(o: Jsons.JSONValue) {
  return Jsons.dump(o);
}

export async function generate_repository_api(
  bars: Parameters<Parameters<typeof ProcessBar.create_scope>[1]>[0],
  cmdarg: {
    network: boolean;
    debugopt_logtime: boolean;
    high_water_mark: number;
    batch_size: number | null;
    prevent_oom_batch_mem_size: number;
    only_gen_batches_union_merge_file: boolean;
    skip_existed: boolean;
  }
) {
  const tasks: ((
    param: unknown,
    bar: ProcessBar.SingleBarSetter
  ) => Promise<void>)[] = [];

  await QuickTypeUtil.init_monkey_patch();

  for (const repository of config.repositories) {
    if (repository.typ === "postgres") {
      tasks.push(
        ...repository.dataset_tables.map((table) => {
          return async (_param: unknown, bar: ProcessBar.SingleBarSetter) => {
            const typename = table.dataset_typename;
            const typedesc = `postgres(${repository.param.host}:${repository.param.port}) 的表 ${table.schema}.${table.tablename}`;
            console.info(`正在生成 ${typedesc} 的代码。`);
            const jsonata_exp =
              "group_by_jsonata" in table ? table.group_by_jsonata : null;
            await bar.set_text(`(1/2)reading ${typename}`);
            const cache_by_id_enable =
              table.cache_by_id === true || !cmdarg.network;
            const cache_by_id = {
              typename,
              enable: cache_by_id_enable,
            };
            const step1_total_remember = {
              value: 0,
            };
            const batch_size =
              typeof cmdarg.batch_size === "number" && cmdarg.batch_size > 0
                ? cmdarg.batch_size
                : typeof table.batch_size.code_gen === "number" &&
                  table.batch_size.code_gen > 0
                ? table.batch_size.code_gen
                : 200;
            const rows_gen = read_postgres_table({
              ...repository.param,
              ...table,
              batch_size,
              on_bar: async (bar_render_param) => {
                step1_total_remember.value = bar_render_param.total;
                await bar.set_total(1 + step1_total_remember.value);
                await bar.set_completed(bar_render_param.completed);
              },
              cache_by_id,
              network: cmdarg.network,
              debugopt_logtime: cmdarg.debugopt_logtime,
              prevent_oom_batch_mem_size: cmdarg.prevent_oom_batch_mem_size,
              // deno-lint-ignore require-await
              on_total: async (total) => {
                step1_total_remember.value = total;
                return cmdarg.only_gen_batches_union_merge_file
                  ? "return"
                  : "continue";
              },
            });
            const samples_gen = read_postgres_table_type_wrap({
              jsonata_exp,
              rows_gen,
              cache_by_id,
              with_jsonata_template: table.with_jsonata_template,
              debugopt_logtime: cmdarg.debugopt_logtime,
              high_water_mark: cmdarg.high_water_mark,
            });
            if (cmdarg.only_gen_batches_union_merge_file) {
              const _batch = await rows_gen.next();
              if (!_batch.done) {
                throw new Error("it should no batch output");
              }
              if (step1_total_remember.value === 0) {
                throw new Error("it should be set value");
              }
            }
            await generate_repository_api_type({
              typename,
              typedesc,
              samples_gen,
              debugopt_logtime: cmdarg.debugopt_logtime,
              only_gen_batches_union_merge_file:
                cmdarg.only_gen_batches_union_merge_file
                  ? {
                      total: step1_total_remember.value,
                      batch_size,
                    }
                  : false,
              skip_existed: cmdarg.skip_existed,
            });
            const api_file_path = path.join(
              data_cleaner_ci_generated,
              typename,
              "api.ts"
            );
            const deno_run_script = `deno run --allow-env=PG* --allow-net=${repository.param.host}:${repository.param.port} ${api_file_path}`;
            const api_file_content = `//
            // ${_TIP.split("\n").join("\n// ")}
            //
            // \`\`\`shell
            // ${deno_run_script}
            // \`\`\`
            import jsonata from "jsonata";
            import { read_postgres_table, read_postgres_table_type_wrap } from "../../pg.ts"
            import { ${typename} } from "./index.ts"

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
              enable: ${j(cache_by_id_enable)},
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
            network: ${j(cmdarg.network)},
            debugopt_logtime: ${j(cmdarg.debugopt_logtime)},
            prevent_oom_batch_mem_size: ${j(cmdarg.prevent_oom_batch_mem_size)},
            on_bar: options?.on_bar,
            });

            const jsonata_exp = ${
              "group_by_jsonata" in table
                ? `${j(table.group_by_jsonata)}`
                : `null`
            }

            const with_jsonata_template = ${j(table.with_jsonata_template)}

            return read_postgres_table_type_wrap<${typename}>({
            rows_gen,
            jsonata_exp,
            cache_by_id,
            with_jsonata_template,
            debugopt_logtime: ${j(cmdarg.debugopt_logtime)},
            high_water_mark: ${j(cmdarg.high_water_mark)},
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

            console.debug(
              `\n\nGenerated: ${api_file_path}\n> You can run it's example : \`\`\`shell\n${deno_run_script}\n\`\`\` `
            );
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
  debugopt_logtime: boolean;
  only_gen_batches_union_merge_file:
    | false
    | {
        total: number;
        batch_size: number;
      };
  skip_existed: boolean;
}) {
  const {
    typename,
    typedesc,
    samples_gen,
    debugopt_logtime,
    only_gen_batches_union_merge_file,
    skip_existed,
  } = param;

  let offset = 0;
  const batch_file_name_list: `batch_${number}_${number}.ts`[] = [];
  try {
    const now = () => (debugopt_logtime ? new Date().getTime() : -1);
    let _read_start_at = now();
    if (only_gen_batches_union_merge_file) {
      const { total, batch_size } = only_gen_batches_union_merge_file;
      while (offset < total) {
        const batch_start = offset;
        const batch_end = Math.min(total, batch_start + batch_size) - 1;
        const batch_file_name = `batch_${batch_start}_${batch_end}.ts` as const;
        batch_file_name_list.push(batch_file_name);
        offset = batch_end + 1;
      }
    } else {
      for await (const samples_res of samples_gen) {
        const _read_end_at = now();
        const batch_start = offset;
        const batch_end = batch_start + samples_res.length - 1;
        try {
          const batch_file_name =
            `batch_${batch_start}_${batch_end}.ts` as const;
          const res_file_path = path.join(
            data_cleaner_ci_generated,
            typename,
            batch_file_name
          );
          batch_file_name_list.push(batch_file_name);
          let res_file_existed: boolean;
          try {
            const res_file_stat = await Deno.stat(res_file_path);
            res_file_existed = res_file_stat.isFile;
          } catch (err) {
            if (err instanceof Deno.errors.NotFound) {
              res_file_existed = false;
            } else {
              throw err;
            }
          }
          if (skip_existed && res_file_existed) {
            console.log(`\nSkip existed : ${res_file_path}\n`);
            continue;
          }
          const samples = samples_res.map((it) => JSON.stringify(it));
          const input = {
            debugopt_logtime,
            samples,
            typename,
            typedesc,
            _TIP,
            res_file_path,
          };
          const _subproc_start_at = now();
          const proc = new Deno.Command("deno", {
            args: [
              "run",
              "--allow-env=CI,READABLE_STREAM,NODE_NDEBUG",
              "--allow-write=data_cleaner_ci_generated",
              "--v8-flags=--max-old-space-size=8192",
              "subproc/quicktype_gen.ts",
            ],
            stderr: "inherit",
            stdin: "piped",
            stdout: "inherit",
          }).spawn();
          await Jsons.dump_to({
            obj: input,
            output: {
              writer: proc.stdin,
            },
          });
          const _subproc_write_end_at = now();

          const status = await proc.status;
          if (!status.success) {
            throw new Error(`code gen failed !`);
          }
          const _subproc_run_end_at = now();

          //   new Worker(
          //     new URL("./workers/quicktype_gen.ts", import.meta.url).href,
          //     {
          //       type: "module",
          //       name: "quicktype_gen",
          //     }
          //   )
          // );
          // const {
          //   _samples_stringify_start_at,
          //   _addsource_start_at,
          //   _addinput_start_at,
          //   _quicktype_start_at,
          //   _quicktype_end_at,
          //   lines,
          // } = await quicktype_gen({
          //   debugopt_logtime,
          //   samples_res,
          //   typename,
          //   typedesc,
          //   _TIP,
          // });
          //-----------------------

          // const _samples_stringify_start_at = now();
          // const samples = samples_res.map((it) => JSON.stringify(it));
          // const _addsource_start_at = now();
          // await jsonInput.addSource({
          //   name: typename,
          //   samples,
          //   description: typedesc + `\n\n${_TIP}`,
          // });
          // const _addinput_start_at = now();
          // const inputData = new InputData();
          // inputData.addInput(jsonInput);
          // const _quicktype_start_at = now();
          // const res_quicktype = await quicktype({
          //   inputData,
          //   lang: new QuickTypeUtil.MyTypeScriptTargetLanguage(),
          //   checkProvenance: true,
          //   debugPrintTimes: debugopt_logtime,
          //   fixedTopLevels: true,
          //   rendererOptions: {
          //     declareUnions: true,
          //     preferUnions: true,
          //     preferConstValues: true,
          //     runtimeTypecheck: true,
          //     runtimeTypecheckIgnoreUnknownProperties: true,
          //   },
          //   combineClasses: true,
          //   inferMaps: false,
          //   inferEnums: true,
          //   inferUuids: false,
          //   inferDateTimes: false,
          //   inferIntegerStrings: false,
          //   inferBooleanStrings: false,
          //   ignoreJsonRefs: true,
          // });
          // const _quicktype_end_at = now();
          // ------------------
          // const res_file_content = lines.join("\n");
          // // const res_file_path = path.join(
          // //   data_cleaner_ci_generated,
          // //   typename,
          // //   `batch_${batch_start}_${batch_end}.ts`
          // // );
          // await Deno.mkdir(path.dirname(res_file_path), {
          //   mode: 0o700,
          //   recursive: true,
          // });
          // await Deno.writeTextFile(res_file_path, res_file_content);
          // const _write_text_file_end_at = now();
          console.log(`\nGenarated: ${res_file_path}\n`);
          if (debugopt_logtime) {
            //   const n = await Promise.resolve(SizeOf.sizeof(obj));
            //   return `${(n / 1024 / 1024).toFixed(2)} MB`;
            // };
            // const _batch_mem_size_start_at = now();
            // const [batch_mem_size] = await Promise.all([to_mem_size(samples_res)]);
            // const _batch_mem_size_end_at = now();

            const batch_data_status = {
              cast_read: `${(_read_end_at - _read_start_at) / 1000} s`,
              batch_size: samples_res.length,
              cast_subproc_write: `${
                (_subproc_write_end_at - _subproc_start_at) / 1000
              } s`,
              cast_subproc_run: `${
                (_subproc_run_end_at - _subproc_start_at) / 1000
              } s`,
              // cast_samples_stringify: `${
              //   (_addsource_start_at - _samples_stringify_start_at) / 1000
              // } s`,
              // cast_addsource: `${
              //   (_addinput_start_at - _addsource_start_at) / 1000
              // } s`,
              // cast_addinput: `${
              //   (_quicktype_start_at - _addinput_start_at) / 1000
              // } s`,
              // cast_quicktype: `${
              //   (_quicktype_end_at - _quicktype_start_at) / 1000
              // } s`,
              // cast_write_text_file: `${
              //   (_write_text_file_end_at - _quicktype_end_at) / 1000
              // } s`,
              _deno_mem_after_all: SizeOf.get_deno_mem_loginfo(),
              // batch_mem_size,
              // cast_batch_mem_size: `${
              //   (_batch_mem_size_end_at - _batch_mem_size_start_at) / 1000
              // } s`,
            };
            console.debug("batch data status :", {
              ...batch_data_status,
            });
          }
        } finally {
          offset = batch_end + 1;
          _read_start_at = now();
        }
      }
    }
    const index_file_content = (() => {
      const lines: string[] = [];
      const filename_to_typename = (
        filename: (typeof batch_file_name_list)[number]
      ) => {
        return `${typename}_${Strs.remove_suffix(filename, ".ts")}`;
      };
      lines.push(
        ...batch_file_name_list.map((filename) => {
          return `import {${typename} as ${filename_to_typename(
            filename
          )} from "./${filename}"`;
        })
      );
      lines.push(`export type ${typename} = `);
      lines.push(
        ...batch_file_name_list.map((filename) => {
          return `  | ${filename_to_typename(filename)}`;
        })
      );
      return lines.join("\n");
    })();

    const index_file_path = path.join(
      data_cleaner_ci_generated,
      typename,
      "index.ts"
    );
    const sourcefile = ts.createSourceFile(
      path.basename(index_file_path),
      index_file_content,
      ts.ScriptTarget.Latest
    );
    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
    });
    await Deno.writeTextFile(index_file_path, printer.printFile(sourcefile));
  } finally {
    // idb?.close();
  }
}

export async function code_gen_main() {
  const _args_bool = [
    "network",
    "debugopt-logtime",
    "only-gen-batches-union-merge-file",
    "skip-existed",
  ] as const;
  const _args_str = [
    "high-water-mark",
    "batch-size",
    "prevent-oom-batch-mem-size",
  ] as const;
  const high_water_mark_default = 1 as const;
  const prevent_oom_batch_mem_size_default = 1073741824; // 1024 * 1024 * 1024
  const cmdarg = parseArgs(Deno.args, {
    boolean: [..._args_bool, "help"] as const,
    string: _args_str,
    default: {
      network: true,
      "high-water-mark": `${high_water_mark_default}`,
      "prevent-oom-batch-mem-size": `${prevent_oom_batch_mem_size_default}`,
    } satisfies {
      [P in
        | (typeof _args_bool)[number]
        | (typeof _args_str)[number]]?: P extends (typeof _args_bool)[number]
        ? true
        : string;
    },
    negatable: ["network"] satisfies Array<(typeof _args_bool)[number]>,
    unknown: (arg) => {
      throw new Error(`Invalid cmd arg : ${arg}`);
    },
  });
  if (cmdarg.help) {
    console.info(`
Help for code gen:

--network       (默认使用)
--no-network    不使用任何远程仓库的数据，仅使用本地缓存来类型生成。
                本地缓存位于 ./${data_cleaner_ci_generated}/.cache_by_id 中。

--high-water-mark    原始数据的 batch 会缓存在队列中，若队列未满则会在 timer 中异步继续加载。
                     此值为队列的长度限制。默认值为 ${high_water_mark_default}。可设置为 0 以禁用队列。

--batch-size    覆盖设置每 batch 的最大长度。一般在 ./${data_cleaner_ci_generated}/config.json 中的 **.batch_size 设置。
--prevent-oom-batch-mem-size    每 batch 的原始数据大小超过此值时，将会提前 yield batch。
                                单位为 byte ，默认值为 ${prevent_oom_batch_mem_size_default} （即 ${
      prevent_oom_batch_mem_size_default / 1024 / 1024
    }*1024*1024）
`);
    return 0;
  }

  const _parseInt = <B extends boolean>(
    allow_null: B,
    k: (typeof _args_str)[number]
  ): B extends true ? number | null : number => {
    // deno-lint-ignore no-explicit-any
    const _invalid = (): any => {
      if (allow_null) {
        return null;
      } else {
        throw new Error(`Invalid --${k} : ${Jsons.dump(cmdarg[k])}`);
      }
    };

    const s = cmdarg[k];
    if (typeof s !== "string" || s.trim() == "") {
      return _invalid();
    }
    const v = parseInt(s);
    if (Nums.is_invalid(v)) {
      return _invalid();
    }
    console.debug(`${k} =`, v);
    return v;
  };
  const high_water_mark = _parseInt(false, "high-water-mark");
  const batch_size = _parseInt(true, "batch-size");
  let prevent_oom_batch_mem_size = _parseInt(
    false,
    "prevent-oom-batch-mem-size"
  );
  if (prevent_oom_batch_mem_size === 0) {
    prevent_oom_batch_mem_size = 1024 * 1024 * 1024 * 1024;
  }

  return await ProcessBar.create_scope(
    {
      title: "[The code_gen.ts file is generating code]",
    },
    async (bars) =>
      await generate_repository_api(bars, {
        network: cmdarg.network,
        debugopt_logtime: cmdarg["debugopt-logtime"],
        high_water_mark,
        batch_size,
        prevent_oom_batch_mem_size: prevent_oom_batch_mem_size,
        only_gen_batches_union_merge_file:
          cmdarg["only-gen-batches-union-merge-file"],
        skip_existed: cmdarg["skip-existed"],
      })
  );
}

if (import.meta.main) {
  try {
    await code_gen_main();
  } catch (err) {
    throw err;
  } finally {
    await Jsonatas.shutdown_all_workers();
  }
}
