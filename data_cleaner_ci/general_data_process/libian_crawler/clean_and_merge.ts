import {
  read_LibianCrawlerGarbage,
} from "../../user_code/LibianCrawlerGarbage.ts";
import {
  Arrays,
  Jsonatas,
  Jsons,
  Mappings,
  Nums,
  Paths,
  PreventTheScreenSaver,
  ProcessBar,
  Processes,
  SerAny,
  Streams,
  Strs,
} from "../../util.ts";
import { ICache } from "../caches.ts";
import {
  create_and_init_libian_crawler_database_scope,
} from "./data_storage.ts";
import { parseArgs } from "@std/cli/parse-args";
import { LibianCrawlerCleanAndMergeUtil } from "./clean_and_merge_util.ts";
import path from "node:path";
import { data_cleaner_ci_generated } from "../../consts.ts";

async function _main() {
  const _args_bool = [
    "use-cache",
    "debugopt-pause-on-notmatch",
    "debugopt-pause-on-dbupdate",
  ] as const;
  const _args_str = [
    "cache-ser-batch-size",
  ] as const;
  const cmdarg = parseArgs(Deno.args, {
    boolean: [..._args_bool, "help"] as const,
    string: _args_str,
    default: {
      "cache-ser-batch-size": "5000",
    } satisfies {
      [
        P in
          | (typeof _args_bool)[number]
          | (typeof _args_str)[number]
      ]?: P extends (typeof _args_bool)[number] ? true
        : string;
    },
    // negatable: ["network"] satisfies Array<(typeof _args_bool)[number]>,
    unknown: (arg) => {
      throw new Error(`Invalid cmd arg : ${arg}`);
    },
  });
  if (cmdarg.help) {
    console.info(
      await Deno.readTextFile(
        "general_data_process/libian_crawler/clean_and_merge_help.txt",
      ),
    );
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
  const pause_on_dbupdate = cmdarg["debugopt-pause-on-dbupdate"];
  const use_cache_flag = cmdarg["use-cache"];
  const cache_ser_batch_size = _parseInt(false, "cache-ser-batch-size");

  // deno-lint-ignore prefer-const
  let use_cache_on_ser = use_cache_flag;
  let use_cache_on_deser = use_cache_flag;
  let maxgid_deser: number | null = null;
  const cm_cache_dir = path.join(
    data_cleaner_ci_generated,
    ".libian_crawler_clean_and_merge_cache",
    ".cache_by_maxgid",
  );

  await SerAny.init();
  if (use_cache_on_deser) {
    try {
      for await (const cache_dir of Deno.readDir(cm_cache_dir)) {
        if (!cache_dir.isDirectory) {
          continue;
        }
        if (Strs.startswith(cache_dir.name, "maxgid_")) {
          const _maxgid = parseInt(
            Strs.remove_prefix(cache_dir.name, "maxgid_"),
          );
          if (Nums.is_invalid(_maxgid) || _maxgid < 0) {
            console.error("Invalid maxgid dirname", cache_dir);
            continue;
          }
          maxgid_deser = maxgid_deser === null
            ? _maxgid
            : Math.max(_maxgid, maxgid_deser);
        }
      }
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        // ignore
      } else {
        throw new Error("Failed read cm_cache_dir", { cause: err });
      }
    }
  }

  if (maxgid_deser === null) {
    use_cache_on_deser = false;
    console.info(
      "Use cache flag enabled , but no cached existed , disable deser .",
      {
        maxgid_deser,
        use_cache_on_deser,
      },
    );
  }

  try {
    return await PreventTheScreenSaver.subprocess_scope(async () => {
      return await ProcessBar.create_scope(
        { title: "LibianCrawler" },
        async (bars) => {
          console.debug("try connect to cleaned db");
          // deno-lint-ignore require-await
          await create_and_init_libian_crawler_database_scope(async (db) => {
            console.debug("success connect to cleaned db", db);
          });

          const reader = LibianCrawlerCleanAndMergeUtil
            .read_garbage_for_libian_crawler();

          // console.debug('start next merger reader')
          await reader.next();
          // console.debug('success next merger reader')

          const media_content = LibianCrawlerCleanAndMergeUtil
            .create_reducer_for_media_content();
          const shop_good = LibianCrawlerCleanAndMergeUtil
            .create_reducer_for_shop_good();
          const chat_message = LibianCrawlerCleanAndMergeUtil
            .create_reducer_for_chat_message();

          //  create_context_of_insert_or_update_reduced_data
          const reducers = [
            (() => {
              const r = {
                tag_text: "media_content",
                ...media_content,
                insert_or_update: LibianCrawlerCleanAndMergeUtil
                  .insert_or_update_media_content,
              };
              return {
                ...r,
                db_ctx: create_context_of_insert_or_update_reduced_data(r),
              };
            })(),
            (() => {
              const r = {
                tag_text: "shop_good",
                ...shop_good,
                insert_or_update: LibianCrawlerCleanAndMergeUtil
                  .insert_or_update_shop_good,
              };
              return {
                ...r,
                db_ctx: create_context_of_insert_or_update_reduced_data(r),
              };
            })(),
            (() => {
              const r = {
                tag_text: "chat_message",
                ...chat_message,
                insert_or_update: LibianCrawlerCleanAndMergeUtil
                  .insert_or_update_chat_message,
              };
              return {
                ...r,
                db_ctx: create_context_of_insert_or_update_reduced_data(r),
              };
            })(),
          ] as const;

          await Promise.all(
            reducers.map((it) => it.reducer.next()),
          );

          if (use_cache_on_deser) {
            const basedir = path.join(cm_cache_dir, `maxgid_${maxgid_deser}`);
            for (const { tag_text, deser_cache } of reducers) {
              const reducer_cache_file_path = Paths.join2(
                basedir,
                `${tag_text}.serany.json`,
              );
              const status = await deser_cache(reducer_cache_file_path);
              if (status === "DisableCache") {
                use_cache_on_deser = false;
                break;
              }
            }
          }

          const render_param: Parameters<typeof bars.render>[0] = [
            { completed: 0, total: 1, text: "Reading garbage" },
            {
              completed: 0,
              total: 1,
              text: "Wait to insert or update to remote database",
            },
          ];

          console.info("Use cache => ", {
            use_cache_on_deser,
            maxgid_deser,
            use_cache_on_ser,
          });
          const cache_ser_count: { value: number } = {
            value: 0,
          };
          let current_maxgid: number = -1;

          const write_cache = async (current_maxgid: number) => {
            if (current_maxgid === -1) { // ALL Skip
              return;
            }
            if (Nums.is_invalid(current_maxgid) || current_maxgid < 0) {
              throw new Error(
                `Why current_maxgid is invalid ? value is ${current_maxgid}`,
              );
            }
            const basedir = path.join(
              cm_cache_dir,
              `maxgid_${current_maxgid}`,
            );
            for (const redu of reducers) {
              await redu.serial_to_file(basedir, redu.tag_text);
            }
            cache_ser_count.value = 0;
          };

          for await (
            const garbages of read_LibianCrawlerGarbage({
              on_bar: async (it) => {
                render_param[0].completed = it.completed;
                render_param[0].total = it.total;
                await bars.render(render_param);
              },
              // deno-lint-ignore require-await
              skip_existed: async (g_id, _total) => {
                if (
                  !use_cache_on_deser || maxgid_deser === null ||
                  g_id > maxgid_deser
                ) {
                  return "no-skip";
                }
                return "skip";
              },
            })
          ) {
            for (const garbage of garbages) {
              cache_ser_count.value++;
              if (garbage === "skip") {
                continue;
              }
              const g_id = parseInt(garbage.obj.g_id);
              if (Nums.is_invalid(g_id)) {
                throw new Error(
                  `Invalid parseInt(g_id) : ${garbage.obj.g_id}`,
                );
              }
              if (current_maxgid > g_id) {
                console.warn("顺序错乱的 garbages 迭代器！");
              } else {
                current_maxgid = g_id;
              }

              let item = await reader.next(garbage);
              while (true) {
                // console.debug("AAAAAAAA", item);
                if (
                  typeof item.value === "object" &&
                  "title" in item.value &&
                  "content_link_url" in item.value
                ) {
                  await media_content.reducer.next(item.value);
                } else if (
                  typeof item.value === "object" &&
                  "good_name" in item.value &&
                  "shop_name" in item.value
                ) {
                  await shop_good.reducer.next(item.value);
                } else if (
                  typeof item.value === "object" &&
                  "__mode__" in item.value &&
                  "chat_message" === item.value.__mode__
                ) {
                  await chat_message.reducer.next(item.value);
                } else if (
                  typeof item.value === "object" &&
                  "related_questions" in item.value &&
                  "tip_text" in item.value
                ) {
                  // 相关搜索
                  // ignore
                } else if (typeof item.value === "undefined") {
                  break;
                } else {
                  if (cmdarg["debugopt-pause-on-notmatch"]) {
                    console.warn(
                      "----------------------------------------------------\n\nSkip unknown type reader item",
                      {
                        garbage,
                        item,
                      },
                    );
                    prompt(
                      "--debugopt-pause-on-notmatch 选项会在不知道如何归类的数据时暂停，输入任意字符继续...",
                    );
                  }
                  // ignore
                }
                item = await reader.next();
              }
              if (
                use_cache_on_ser &&
                cache_ser_count.value >= cache_ser_batch_size
              ) {
                await write_cache(current_maxgid);
              }
            }
          }

          await write_cache(current_maxgid);

          render_param[0].text = "Finish read garbage";

          function create_context_of_insert_or_update_reduced_data<
            Prev,
            Cur,
          >(params: {
            tag_text: string;
            reducer: AsyncGenerator<
              undefined,
              readonly [Set<string>, ICache<string, Prev>] | undefined,
              Cur | "stop"
            >;
            insert_or_update:
              LibianCrawlerCleanAndMergeUtil.InsertOrUpdateProvider<
                Prev
              >;
          }) {
            const { tag_text, reducer, insert_or_update } = params;
            return {
              tag_text,
              stop: async () => {
                const reduced_result = await reducer.next("stop");
                // const res = reducer.return
                if (!reduced_result.done || !reduced_result.value) {
                  throw new Error(
                    `Generator should return after pass "stop" to it , but reduced_result.done=${reduced_result.done}, params.tag_text=${params.tag_text}, reduced_result.value=${reduced_result.value}`,
                  );
                }
                const [all_key, cache] = reduced_result.value;
                return {
                  all_key,
                  cache,
                };
              },
              insert_or_update: async (
                db: Parameters<
                  LibianCrawlerCleanAndMergeUtil.InsertOrUpdateProvider<Prev>
                >[0],
                values: Parameters<
                  LibianCrawlerCleanAndMergeUtil.InsertOrUpdateProvider<Prev>
                >[1],
                options: Parameters<
                  LibianCrawlerCleanAndMergeUtil.InsertOrUpdateProvider<Prev>
                >[2],
              ) => {
                try {
                  return await insert_or_update(db, values, options);
                } catch (err) {
                  throw new Error(`Insert or update failed`, {
                    cause: err,
                  });
                }
              },
            };
          }

          const ctx_list = await Promise.all(
            reducers.map((it) => it.db_ctx).map(async (ctx) => {
              const { all_key, cache } = await ctx.stop();
              return {
                ctx,
                all_key,
                cache,
              };
            }),
          );
          const total = ctx_list.reduce(
            (prev, cur) => prev + cur.all_key.size,
            0,
          );
          await create_and_init_libian_crawler_database_scope(async (db) => {
            let completed_offset = 0;
            for (const { ctx, all_key, cache } of ctx_list) {
              for (
                const { start, end, sliced } of Streams
                  .split_array_use_batch_size(
                    100,
                    [...all_key],
                  )
              ) {
                const values = await Promise.all(
                  Mappings.object_entries(cache.get_batch(new Set(sliced))).map(
                    (
                      e,
                    ) => Promise.resolve(e[1]),
                  ),
                );
                const on_bar_text = async (text: string) => {
                  render_param[1].completed = completed_offset + end;
                  render_param[1].total = total;
                  render_param[1].text =
                    `${ctx.tag_text} Batch(${start}~${end}) ${text}`;
                  await bars.render(render_param);
                };
                // 只要不乱改，这的类型就没问题。
                // 我只想偷懒。
                // deno-lint-ignore no-explicit-any
                await ctx.insert_or_update(db, values as any, {
                  on_bar_text,
                  pause_on_dbupdate,
                });
              }
              completed_offset += all_key.size;
            }
          });
        },
      );
    });
  } finally {
    await Jsonatas.shutdown_all_workers();
  }
}

if (import.meta.main) {
  await Processes.set_process_title("LibianCrawlerCleanAndMerge");
  await _main();
}
