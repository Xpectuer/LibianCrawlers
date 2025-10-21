import {
  read_LibianCrawlerGarbage,
} from "../../user_code/LibianCrawlerGarbage.ts";
import {
  Arrays,
  Errors,
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
import { ICache } from "../common/caches.ts";
import {
  create_and_init_libian_crawler_database_scope,
} from "./data_storage.ts";
import { parseArgs } from "@std/cli/parse-args";
import { LibianCrawlerCleanAndMergeUtil } from "./clean_and_merge_util.ts";
import path from "node:path";
import { data_cleaner_ci_generated } from "../../consts.ts";
import { create_cache_ctx_of_maxgid } from "./clean_and_merge_cache.ts";
import { create_reducers_and_init } from "./clean_and_merge_reducers.ts";

async function _main() {
  const _args_bool = [
    "use-cache",
    "update-cache",
    "debugopt-pause-on-notmatch",
    "debugopt-pause-on-dbupdate",
  ] as const;
  const _args_str = [
    "cache-ser-batch-size",
    "update-to-db-batch-size",
  ] as const;
  const cmdarg = parseArgs(Deno.args, {
    boolean: [..._args_bool, "help"] as const,
    string: _args_str,
    default: {
      "cache-ser-batch-size": "5000",
      "update-to-db-batch-size": "5000",
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
  const update_cache_flag = cmdarg["update-cache"];
  const cache_ser_batch_size = _parseInt(false, "cache-ser-batch-size");
  const update_to_db_batch_size = _parseInt(false, "update-to-db-batch-size");

  // deno-lint-ignore prefer-const
  let use_cache_on_ser = use_cache_flag || update_cache_flag;
  let use_cache_on_deser = use_cache_flag && !update_cache_flag;
  const cache_ctx = create_cache_ctx_of_maxgid();
  // let maxgid_deser: number | null = null;
  // const cm_cache_dir = path.join(
  //   data_cleaner_ci_generated,
  //   ".libian_crawler_clean_and_merge_cache",
  //   ".cache_by_maxgid",
  // );

  const set_use_cache_on_deser: (
    status: "enable" | "disable",
    // deno-lint-ignore require-await
  ) => Promise<void> = async (s) => {
    switch (s) {
      case "enable":
        use_cache_on_deser = true;
        break;
      case "disable":
        use_cache_on_deser = false;
        console.info(
          "Use cache flag enabled , but no cached existed , disable deser .",
          {
            refs: cache_ctx.refs,
          },
        );
        break;
    }
  };
  await cache_ctx.callbacks.on_init();
  if (use_cache_on_deser) {
    await cache_ctx.callbacks.on_find_latest_cache_on_deser(
      cache_ctx.refs,
      set_use_cache_on_deser,
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
          await reader.next();

          const {
            reducers,
            media_content,
            chat_message,
            shop_good,
            literature,
          } = await create_reducers_and_init();

          if (use_cache_on_deser) {
            await cache_ctx.callbacks.on_deser_cache_to_reducers(
              cache_ctx.refs,
              reducers,
              set_use_cache_on_deser,
            );
          }
          console.info("Use cache status: => ", {
            use_cache_on_deser,
            use_cache_on_ser,
            refs: cache_ctx.refs,
          });

          const render_param: Parameters<typeof bars.render>[0] = [
            { completed: 0, total: 1, text: "Reading garbage" },
            {
              completed: 0,
              total: 1,
              text: "Wait to insert or update to remote database",
            },
          ];

          const cache_ser_count: { value: number } = {
            value: 0,
          };

          for (
            const [datasetid, garbages_iter] of read_LibianCrawlerGarbage
              .toSorted((a, b) => a[0] - b[0])
          ) {
            const dataset_store = cache_ctx.refs.datasets.get(datasetid) ?? {
              maxgid_deser: null,
            };
            let current_maxgid: number | null = null;

            const write_cache = async () => {
              if (current_maxgid === null) {
                Errors.throw_and_format("current_maxgid === null", {
                  refs: cache_ctx.refs,
                  reducers,
                  datasetid,
                  current_maxgid,
                });
              }
              console.debug("Start write cache", {
                use_cache_on_ser,
                cache_ser_count,
                cache_ser_batch_size,
              });
              await cache_ctx.callbacks.write_cache(
                cache_ctx.refs,
                reducers,
                datasetid,
                current_maxgid,
                // deno-lint-ignore require-await
                async () => {
                  cache_ser_count.value = 0;
                },
              );
              console.debug("Finish write cache", {
                use_cache_on_ser,
                cache_ser_count,
                cache_ser_batch_size,
              });
            };

            let is_garbage_not_in_cache_readed = false;
            for await (
              const garbages of garbages_iter({
                on_bar: async (it) => {
                  render_param[0].completed = it.completed;
                  render_param[0].total = it.total;
                  await bars.render(render_param);
                },
                // deno-lint-ignore require-await
                skip_existed: async (g_id, _total) => {
                  if (
                    !use_cache_on_deser ||
                    dataset_store.maxgid_deser === null ||
                    g_id > dataset_store.maxgid_deser
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
                is_garbage_not_in_cache_readed = true;
                const g_id = parseInt(garbage.obj.g_id);
                if (Nums.is_invalid(g_id)) {
                  throw new Error(
                    `Invalid parseInt(g_id) : ${garbage.obj.g_id}`,
                  );
                }
                if (current_maxgid !== null && current_maxgid > g_id) {
                  console.warn("顺序错乱的 garbages 迭代器！\n\n\n");
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
                    "__mode__" in item.value &&
                    "literature" === item.value.__mode__
                  ) {
                    await literature.reducer.next(item.value);
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
                  use_cache_on_ser && is_garbage_not_in_cache_readed &&
                  cache_ser_count.value >= cache_ser_batch_size
                ) {
                  await write_cache();
                }
              }
            }

            if (
              use_cache_on_ser && is_garbage_not_in_cache_readed &&
              cache_ser_count.value !== 0
            ) {
              await write_cache();
            }

            render_param[0].text = "Finish read garbage";
            // 到此处合并及清洗数据已经完成了

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
              let _last_insert_or_update_promise: Promise<unknown> | null =
                null;
              for (const { ctx, all_key, cache } of ctx_list) {
                const _all_key_arr = [...all_key];
                for (
                  const { start, end, sliced } of Streams
                    .split_array_use_batch_size(
                      update_to_db_batch_size,
                      _all_key_arr,
                    )
                ) {
                  const values = await Promise.all(
                    Mappings.object_entries(cache.get_batch(new Set(sliced)))
                      .map(
                        (e) => Promise.resolve(e[1]),
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

                  if (_last_insert_or_update_promise !== null) {
                    await _last_insert_or_update_promise;
                  }
                  _last_insert_or_update_promise = ctx.insert_or_update(
                    db,
                    // deno-lint-ignore no-explicit-any
                    values as any,
                    {
                      on_bar_text,
                      pause_on_dbupdate,
                    },
                  );
                }
                completed_offset += all_key.size;
              }
              if (_last_insert_or_update_promise !== null) {
                await _last_insert_or_update_promise;
              }
            });
          }
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
