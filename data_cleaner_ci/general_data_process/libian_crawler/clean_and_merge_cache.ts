import path from "node:path";
import { data_cleaner_ci_generated } from "../../consts.ts";
import {
  Errors,
  is_nullish,
  Jsons,
  Nums,
  Paths,
  SerAny,
  Strs,
} from "../../util.ts";
import { create_reducers_and_init } from "./clean_and_merge_reducers.ts";

export type MaxGidRefs = {
  datasets: Map<number, { maxgid_deser: number | null }>;
  cm_cache_dir: {
    value: string;
  };
};

export function create_cache_ctx_of_maxgid() {
  return {
    refs: {
      // maxgid_deser: null as number | null,
      datasets: new Map<number, { maxgid_deser: number | null }>(),
      cm_cache_dir: {
        value: path.join(
          data_cleaner_ci_generated,
          ".libian_crawler_clean_and_merge_cache",
          ".cache_by_maxgid",
        ),
      },
    } satisfies MaxGidRefs,
    callbacks: {
      on_init: async () => {
        await SerAny.init();
      },
      on_find_latest_cache_on_deser: async (
        refs: MaxGidRefs,
        set_use_cache_on_deser: (status: "enable" | "disable") => Promise<void>,
      ) => {
        const startwith_head_and_suffiexed_number = <H extends string>(
          text: string,
          head: H,
        ): false | [`${H}${number}`, number] => {
          const t = text;
          const h = head as string;
          if (!Strs.startswith(t, h)) {
            return false;
          }
          const suffix = Strs.remove_prefix(t, h);
          const s = parseInt(suffix);
          if (Nums.is_invalid(s) || s < 0) {
            return false;
          }
          return [t as `${H}${number}`, s];
        };

        try {
          for await (
            const datasetid_dir of Deno.readDir(refs.cm_cache_dir.value)
          ) {
            if (!datasetid_dir.isDirectory) {
              continue;
            }
            const datasetid_dir_name = datasetid_dir.name;
            const datasetid_entry = startwith_head_and_suffiexed_number(
              datasetid_dir_name,
              "datasetid_",
            );
            if (!datasetid_entry) {
              console.debug("ignore invalid datasetid dir :", {
                datasetid_dir_name,
              });
              continue;
            }
            const [datasetid_dir_name2, datasetid] = datasetid_entry;
            const the_config_file_path = path.join(
              refs.cm_cache_dir.value,
              datasetid_dir_name2,
              "config.json",
            );
            let the_config: Jsons.JSONValue;
            try {
              await Deno.stat(the_config_file_path);
              the_config = Jsons.load(
                await Deno.readTextFile(the_config_file_path),
              );
            } catch (err) {
              if (err instanceof Deno.errors.NotFound) {
                the_config = null;
              } else {
                throw err;
              }
            }
            if (!is_nullish(the_config)) {
              if (typeof the_config !== "object") {
                Errors.throw_and_format("Invalid config", {
                  the_config,
                  the_config_file_path,
                });
              }
              if ("freeze" in the_config && the_config.freeze === true) {
                console.info(
                  "Skip find maxgid_dir , because config.freeze === true",
                  { the_config_file_path },
                );
                continue;
              }
            }

            for await (
              const maxgid_dir of Deno.readDir(path.join(
                refs.cm_cache_dir.value,
                datasetid_dir_name2,
              ))
            ) {
              if (!maxgid_dir.isDirectory) {
                continue;
              }
              const maxgid_dir_name = maxgid_dir.name;
              const maxgid_entry = startwith_head_and_suffiexed_number(
                maxgid_dir_name,
                "maxgid_",
              );
              if (!maxgid_entry) {
                console.debug("ignore invalid maxgid dir :", {
                  datasetid_dir_name,
                  maxgid_dir_name,
                });
                continue;
              }
              const [_maxgid_dir_name2, maxgid] = maxgid_entry;
              const old_maxgid = refs.datasets.get(datasetid)?.maxgid_deser ??
                null;
              if (old_maxgid === null || old_maxgid < maxgid) {
                refs.datasets.set(datasetid, { maxgid_deser: maxgid });
              }
            }
            if (!refs.datasets.has(datasetid)) {
              refs.datasets.set(datasetid, { maxgid_deser: null });
            }

            // if (Strs.startswith(cache_dir.name, "maxgid_")) {
            //   const _maxgid = parseInt(
            //     Strs.remove_prefix(cache_dir.name, "maxgid_"),
            //   );
            //   if (Nums.is_invalid(_maxgid) || _maxgid < 0) {
            //     console.error("Invalid maxgid dirname", cache_dir);
            //     continue;
            //   }
            //   refs.maxgid_deser.value = refs.maxgid_deser.value === null
            //     ? _maxgid
            //     : Math.max(_maxgid, refs.maxgid_deser.value);
            // }
          }
        } catch (err) {
          if (err instanceof Deno.errors.NotFound) {
            // ignore
          } else {
            Errors.throw_and_format("Failed read cm_cache_dir", { refs }, err);
          }
        }
        if (refs.datasets.size <= 0) {
          await set_use_cache_on_deser("disable");
        }
      },
      on_deser_cache_to_reducers: async (
        refs: MaxGidRefs,
        reducers: Awaited<
          ReturnType<typeof create_reducers_and_init>
        >["reducers"],
        set_use_cache_on_deser: (status: "enable" | "disable") => Promise<void>,
      ) => {
        for (const datasetid of refs.datasets.keys()) {
          const maxgid_deser = refs.datasets.get(datasetid)!.maxgid_deser;
          if (is_nullish(maxgid_deser) || Nums.is_invalid(maxgid_deser)) {
            console.debug("maxgid empty", {
              datasetid,
              maxgid_deser,
              refs,
              reducers_texts: reducers.map((it) => it.tag_text),
            });
            continue;
            // Errors.throw_and_format("maxgid require valid number", {
            //   datasetid,
            //   maxgid_deser,
            //   refs,
            //   reducers_texts: reducers.map((it) => it.tag_text),
            // });
          }

          const basedir = path.join(
            refs.cm_cache_dir.value,
            `datasetid_${datasetid}`,
            `maxgid_${maxgid_deser}`,
          );

          for (const { tag_text, deser_cache } of reducers) {
            const reducer_cache_file_path = Paths.join2(
              basedir,
              `${tag_text}.serany.json`,
            );
            const status = await deser_cache(reducer_cache_file_path);
            if (status === "DisableCache") {
              await set_use_cache_on_deser("disable");
              return "DisableCache";
            }
          }
        }

        // const maxgid_deser = refs.maxgid_deser.value;
        // if (is_nullish(maxgid_deser) || Nums.is_invalid(maxgid_deser)) {
        //   Errors.throw_and_format("maxgid require valid number", {
        //     maxgid_deser,
        //     refs,
        //   });
        // }

        // const basedir = path.join(
        //   refs.cm_cache_dir.value,
        //   `maxgid_${maxgid_deser}`,
        // );
        // for (const { tag_text, deser_cache } of reducers) {
        //   const reducer_cache_file_path = Paths.join2(
        //     basedir,
        //     `${tag_text}.serany.json`,
        //   );
        //   const status = await deser_cache(reducer_cache_file_path);
        //   if (status === "DisableCache") {
        //     await set_use_cache_on_deser("disable");
        //     break;
        //   }
        // }
      },
      write_cache: async (
        refs: MaxGidRefs,
        reducers: Awaited<
          ReturnType<typeof create_reducers_and_init>
        >["reducers"],
        current_dataset_id: number,
        current_maxgid: number,
        after_write_to_reducer: () => Promise<void>,
      ) => {
        if (current_maxgid === -1) { // ALL Skip
          return;
        }
        if (Nums.is_invalid(current_maxgid) || current_maxgid < 0) {
          Errors.throw_and_format("Why current_maxgid is invalid ?", {
            refs,
            current_dataset_id,
            current_maxgid,
          });
        }
        const basedir = path.join(
          refs.cm_cache_dir.value,
          `datasetid_${current_dataset_id}`,
          `maxgid_${current_maxgid}`,
        );
        for (const redu of reducers) {
          await redu.serial_to_file(basedir, redu.tag_text);
        }
        await after_write_to_reducer();
        // cache_ser_count.value = 0;
      },
    },
  } as const;
}
