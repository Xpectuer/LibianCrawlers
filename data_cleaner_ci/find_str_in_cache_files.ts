import path from "node:path";
import { data_cleaner_ci_generated } from "./consts.ts";
import { DataClean, Errors, Jsons, Nums, Strs } from "./util.ts";
import { parseArgs } from "@std/cli/parse-args";

async function find_str_in_cache_files(param: {
  keywords: string;
  count: number | null;
  pause: boolean;
}) {
  let count_total = 0;
  const { keywords, count, pause } = param;
  for await (
    const cache_dir of Deno.readDir(
      path.join(data_cleaner_ci_generated, ".cache_by_id"),
    )
  ) {
    if (!cache_dir.isDirectory) {
      continue;
    }
    const cache_file_list: Array<[number, Deno.DirEntry]> = [];
    for await (
      const cache_file of Deno.readDir(
        path.join(data_cleaner_ci_generated, ".cache_by_id", cache_dir.name),
      )
    ) {
      if (!cache_file.isFile) {
        continue;
      }
      const cache_file_name = cache_file.name;
      if (!Strs.endswith(cache_file_name, ".json")) {
        continue;
      }
      const fname = Strs.remove_suffix(cache_file_name, ".json");
      const gid = parseInt(fname);
      if (!Nums.is_int_num(gid)) {
        continue;
      }
      cache_file_list.push([gid, cache_file]);
    }
    // 从后往前找
    cache_file_list.sort((a, b) => b[0] - a[0]);
    for (const [gid, cache_file] of cache_file_list) {
      const data = await Deno.readTextFile(
        path.join(
          data_cleaner_ci_generated,
          ".cache_by_id",
          cache_dir.name,
          cache_file.name,
        ),
      );
      const idx = data.indexOf(keywords);
      if (idx < 0) {
        continue;
      }
      let line_count = 1;
      let line_head_idx = 0;
      for (let i = 0; i < idx; i++) {
        const ch = data[i];
        if (ch === "\n") {
          line_count++;
          line_head_idx = i;
        }
      }
      let line_tail_idx = line_head_idx + 1;
      for (; line_tail_idx < data.length; line_tail_idx++) {
        const ch = data[line_tail_idx];
        if (ch === "\n") {
          break;
        }
      }
      console.info(`
====================================================
Found data in file ${path.join(cache_dir.name, cache_file.name)}

gid is ${gid}

line number is ${line_count}

data.indexOf(keywords) is ${idx}
line_head_idx          is ${line_head_idx}
line_tail_idx          is ${line_tail_idx}

-------- Line is --------

${data.slice(line_head_idx, line_tail_idx)}

====================================================`);
      if (typeof count === "number" && ++count_total > count) {
        return;
      }
      if (pause) {
        prompt("Pause on found , press to continue ...");
      }
    }
  }
}

async function main() {
  const _args_bool = [
    "pause",
  ] as const;
  const _args_str = [
    "keywords",
    "count",
  ] as const;
  const cmdarg = parseArgs(Deno.args, {
    boolean: [..._args_bool, "help"] as const,
    string: _args_str,
    default: {} satisfies {
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
    console.info(await Deno.readTextFile("find_str_in_cache_files_help.txt"));
    return 0;
  }

  if (!Strs.is_not_blank(cmdarg.keywords)) {
    Errors.throw_and_format("Empty --keywords", { cmdarg });
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

  const count = _parseInt(true, "count");

  await find_str_in_cache_files({
    keywords: cmdarg.keywords,
    count,
    pause: cmdarg.pause,
  });
}

if (import.meta.main) {
  await main();
}
