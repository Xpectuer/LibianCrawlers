import path from "node:path";
import config from "./config.ts";
import { read_postgres_table, read_postgres_table_type_wrap } from "./pg.ts";
import { data_cleaner_ci_generated, recommended_batch_size } from "./consts.ts";
import {
  DataClean,
  Jsonatas,
  Jsons,
  Nums,
  PreventTheScreenSaver,
  ProcessBar,
  Processes,
  SizeOf,
  Strs,
  write_file,
} from "./util.ts";
import ts from "typescript";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { QuickTypeUtil } from "./quicktypeutil.ts";
import { NocoDBUtil } from "./general_data_process/nocodbutil.ts";

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
    // prevent_oom_batch_mem_size: number;
    only_gen_batches_union_merge_file: boolean;
    skip_existed: boolean;
    only_gen_nocodb: boolean;
  },
) {
  const tasks: ((
    param: unknown,
    bar: ProcessBar.SingleBarSetter,
  ) => Promise<void>)[] = [];

  await QuickTypeUtil.init_monkey_patch();

  for (const repository of config.repositories) {
    if (
      repository.typ === "postgres" && "dataset_tables" in repository &&
      repository.dataset_tables && !cmdarg.only_gen_nocodb
    ) {
      tasks.push(
        ...repository.dataset_tables.map((table) => {
          return async (_param: unknown, bar: ProcessBar.SingleBarSetter) => {
            const typename = table.dataset_typename;
            const typedesc =
              `postgres(${repository.param.host}:${repository.param.port}) 的表 ${table.schema}.${table.tablename}`;
            console.info(`正在生成 ${typedesc} 的代码。`);
            const jsonata_exp = "group_by_jsonata" in table
              ? table.group_by_jsonata
              : null;
            await bar.set_text(`(1/2)reading ${typename}`);
            const cache_by_id_enable = table.cache_by_id === true ||
              !cmdarg.network;
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
                : "batch_size" in table &&
                    typeof table.batch_size === "object" &&
                    table.batch_size !== null &&
                    "code_gen" in table.batch_size &&
                    typeof table.batch_size.code_gen === "number" &&
                    table.batch_size.code_gen > 0
                ? table.batch_size.code_gen
                : recommended_batch_size;
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
              // prevent_oom_batch_mem_size: cmdarg.prevent_oom_batch_mem_size,
              // deno-lint-ignore require-await
              on_total: async (total) => {
                step1_total_remember.value = total;
                return cmdarg.only_gen_batches_union_merge_file
                  ? "return"
                  : "continue";
              },
              skip_existed: cmdarg.skip_existed
                ? async (count, total) => {
                  if (count < 0) {
                    throw new Error(`Assert count >= 0 but ${count}`);
                  }
                  if (!cache_by_id_enable) {
                    return "no-skip";
                  }
                  const batch_start = Math.floor(count / batch_size) *
                    batch_size;
                  const batch_end = Math.min(total, batch_start + batch_size) -
                    1;
                  const batch_file_path = path.join(
                    data_cleaner_ci_generated,
                    typename,
                    _batch_file_name(batch_start, batch_end),
                  );
                  try {
                    const batch_file_stat = await Deno.stat(batch_file_path);
                    if (batch_file_stat.isFile) {
                      return "skip";
                    } else {
                      throw new Error(
                        `batch file is not file : ${batch_file_path}`,
                      );
                    }
                  } catch (err) {
                    if (err instanceof Deno.errors.NotFound) {
                      return "no-skip";
                    } else {
                      throw new Error(
                        `Why error on batch file name find ? context is ${
                          Jsons.dump(
                            {
                              batch_start,
                              batch_end,
                              batch_size,
                              count,
                            },
                          )
                        }`,
                        {
                          cause: err,
                        },
                      );
                    }
                  }
                }
                : null,
            });
            const samples_gen = read_postgres_table_type_wrap<boolean>({
              jsonata_exp,
              rows_gen,
              cache_by_id,
              with_jsonata_template: table.with_jsonata_template,
              debugopt_logtime: cmdarg.debugopt_logtime,
              high_water_mark: cmdarg.high_water_mark,
              skip_existed: cmdarg.skip_existed,
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
            await generate_postgres_api_type({
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
              "api.ts",
            );
            const deno_run_script =
              `deno run --allow-env=PG* --allow-net=${repository.param.host}:${repository.param.port} ${api_file_path}`;
            const api_file_content = `//
            // ${_TIP.split("\n").join("\n// ")}
            //
            // \`\`\`shell
            // ${deno_run_script}
            // \`\`\`
            import { read_postgres_table, read_postgres_table_type_wrap, ReadPostgresTableSkipExisted } from "../../pg.ts"
            import { ${typename} } from "./index.ts"

            export function read_${typename}<
              SkipExisted extends null | ReadPostgresTableSkipExisted,
              SkipExistedEnable extends boolean = null extends SkipExisted ? false : true,
            >(options?: {
            on_bar?: (bar_render_param: {
              completed: number;
              total: number;
            }) => Promise<void>;
             skip_existed?: SkipExisted
            }){

            const cache_by_id = {
              typename: ${j(typename)},
              enable: ${j(cache_by_id_enable)},
            };

            const skip_existed = options?.skip_existed ?? null;
            const skip_existed_enable: SkipExistedEnable =
              (skip_existed !== null) as SkipExistedEnable;

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
            batch_size: ${
              j(
                "batch_size" in table && typeof table.batch_size === "object" &&
                  table.batch_size !== null && "api" in table.batch_size &&
                  typeof table.batch_size.api === "number"
                  ? table.batch_size.api
                  : recommended_batch_size,
              )
            },
            cache_by_id,
            network: ${j(cmdarg.network)},
            debugopt_logtime: ${j(cmdarg.debugopt_logtime)},
            on_bar: options?.on_bar,
            skip_existed,
            });

            const jsonata_exp = ${
              "group_by_jsonata" in table
                ? `${j(table.group_by_jsonata)}`
                : `null`
            }

            const with_jsonata_template = ${j(table.with_jsonata_template)}

            return read_postgres_table_type_wrap<SkipExistedEnable, ${typename}>({
            rows_gen,
            jsonata_exp,
            cache_by_id,
            with_jsonata_template,
            debugopt_logtime: ${j(cmdarg.debugopt_logtime)},
            high_water_mark: ${j(cmdarg.high_water_mark)},
            skip_existed: skip_existed_enable,
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
              ts.ScriptTarget.Latest,
            );
            const printer = ts.createPrinter({
              newLine: ts.NewLineKind.LineFeed,
            });
            await Deno.writeTextFile(
              api_file_path,
              printer.printFile(sourcefile),
            );

            console.debug(
              `\n\nGenerated: ${api_file_path}\n> You can run it's example : \`\`\`shell\n${deno_run_script}\n\`\`\` `,
            );
          };
        }),
      );
    } else if (
      repository.typ === "nocodb" && "token" in repository &&
      repository.token && "base_url" in repository && repository.base_url
    ) {
      tasks.push(
        async (_param, bar) => {
          // bar.set_total()
          await bar.set_text(`Reading nocodb meta from ${repository.base_url}`);
          await bar.set_total(2);
          const ncbases = await NocoDBUtil.fetch_ncbases_all_info({
            baseurl: DataClean.url_use_https_noempty(repository.base_url),
            nocodb_token: repository.token,
            logd_simple: cmdarg.only_gen_nocodb ? true : false,
          });
          await bar.set_completed(1);
          const api_file_path = path.join(
            data_cleaner_ci_generated,
            repository.dataset_typename,
            "meta.ts",
          );
          await write_file({
            file_path: api_file_path,
            log_tag: "no",
            creator: {
              mode: "text",
              overwrite: true,
              // deno-lint-ignore require-await
              content: async () => {
                const api_file_content = `
export const ncbases = ${Jsons.dump(ncbases, { indent: 2 })} as const;
`;
                const sourcefile = ts.createSourceFile(
                  path.basename(api_file_path),
                  api_file_content,
                  ts.ScriptTarget.Latest,
                );
                const printer = ts.createPrinter({
                  newLine: ts.NewLineKind.LineFeed,
                });
                return printer.printFile(sourcefile);
              },
            },
          });
          await bar.set_completed(2);
        },
      );
    }
  }
  await Promise.all(
    ProcessBar.bind_each(tasks, bars.render).map((task) => task(void 0)),
  );
  // console.info("OK");
}

function _batch_file_name<S extends number, E extends number>(
  batch_start: S,
  batch_end: E,
) {
  if (
    typeof batch_start !== "number" ||
    typeof batch_end !== "number" ||
    Nums.is_invalid(batch_start) ||
    Nums.is_invalid(batch_end) ||
    batch_start < 0 ||
    batch_end < 0
  ) {
    throw new Error(`Invalid param : ${batch_start} , ${batch_end}`);
  }
  return `batch_${batch_start}_${batch_end}.ts` as const;
}

export async function generate_postgres_api_type<T>(param: {
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
        const batch_file_name = _batch_file_name(batch_start, batch_end);
        batch_file_name_list.push(batch_file_name);
        offset = batch_end + 1;
      }
    } else {
      for await (const samples_res of samples_gen) {
        const _read_end_at = now();
        const batch_start = offset;
        const batch_end = batch_start + samples_res.length - 1;
        try {
          const batch_file_name = _batch_file_name(batch_start, batch_end);
          const res_file_path = path.join(
            data_cleaner_ci_generated,
            typename,
            batch_file_name,
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
            if (samples_res.find((it) => it !== "skip")) {
              throw new Error(
                `If skip_existed && res_file_existed (Existed ${batch_file_name}) , Assert generator should return all "skip" , item !== \"skip\" items indexes is ${
                  Jsons.dump(
                    samples_res
                      .filter((it) => it !== "skip")
                      .map((_v, idx) => idx),
                    { indent: 2 },
                  )
                }`,
              );
            }
            // console.log(`\nSkip existed : ${res_file_path}\n`);
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
        filename: (typeof batch_file_name_list)[number],
      ) => {
        return `${typename}_${Strs.remove_suffix(filename, ".ts")}`;
      };
      lines.push(
        ...batch_file_name_list.map((filename) => {
          return `import {${typename} as ${
            filename_to_typename(
              filename,
            )
          } from "./${filename}"`;
        }),
      );
      lines.push(`export type ${typename} = `);
      lines.push(
        ...batch_file_name_list.map((filename) => {
          return `  | ${filename_to_typename(filename)}`;
        }),
      );
      return lines.join("\n");
    })();

    const index_file_path = path.join(
      data_cleaner_ci_generated,
      typename,
      "index.ts",
    );
    const sourcefile = ts.createSourceFile(
      path.basename(index_file_path),
      index_file_content,
      ts.ScriptTarget.Latest,
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
    "only-gen-nocodb",
  ] as const;
  const _args_str = [
    "high-water-mark",
    "batch-size",
    // "prevent-oom-batch-mem-size",
  ] as const;
  const high_water_mark_default = 0 as const;
  // const prevent_oom_batch_mem_size_default = 536870912; // 512 * 1024 * 1024
  const cmdarg = parseArgs(Deno.args, {
    boolean: [..._args_bool, "help"] as const,
    string: _args_str,
    default: {
      network: true,
      "high-water-mark": `${high_water_mark_default}`,
      // "prevent-oom-batch-mem-size": `${prevent_oom_batch_mem_size_default}`,
    } satisfies {
      [
        P in
          | (typeof _args_bool)[number]
          | (typeof _args_str)[number]
      ]?: P extends (typeof _args_bool)[number] ? true
        : string;
    },
    negatable: ["network"] satisfies Array<(typeof _args_bool)[number]>,
    unknown: (arg) => {
      throw new Error(`Invalid cmd arg : ${arg}`);
    },
  });
  if (cmdarg.help) {
    console.info(await Deno.readTextFile("code_gen_help.txt"));
    return 0;
  }

  const _parseInt = <B extends boolean>(
    allow_null: B,
    k: (typeof _args_str)[number],
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
  try {
    return await PreventTheScreenSaver.subprocess_scope(async () => {
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
            // prevent_oom_batch_mem_size: prevent_oom_batch_mem_size,
            only_gen_batches_union_merge_file:
              cmdarg["only-gen-batches-union-merge-file"],
            skip_existed: cmdarg["skip-existed"],
            only_gen_nocodb: cmdarg["only-gen-nocodb"],
          }),
      );
    });
  } finally {
    await Jsonatas.shutdown_all_workers();
  }
}

if (import.meta.main) {
  await Processes.set_process_title("CodeGen");
  await code_gen_main();
}
