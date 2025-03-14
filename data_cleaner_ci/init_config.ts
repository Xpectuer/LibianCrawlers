import os from "node:os";
import path from "node:path";
import { write_file } from "./util.ts";
import { data_cleaner_ci_generated } from "./consts.ts";

function template_config() {
  return {
    repositories: [
      {
        typ: "postgres",
        param: {
          dbname: "<INPUT>",
          user: "<INPUT>",
          password: "<INPUT>",
          host: "<INPUT>",
          port: 5432,
          ssl: "require",
        },
        dataset_tables: [
          {
            dataset_typename: "PGLibianCrawlerGarbage",
            schema: "libian_crawler",
            tablename: "garbage",
            group_by_jsonata: "g_type & '__' & g_content.crawler_tag",
            batch_size: {
              api: 20,
              code_gen: 1000,
            },
            cache_by_id: true,
            with_inverted_index: true,
          },
        ],
      },
    ],
  };
}

// #region init_config
// ...

/**
 * init_config 将创建符号链接并创建一些模板文件。
 */
export async function init_config() {
  const home_dir = os.homedir();
  // 在家目录中创建配置文件
  const config_file_path = path.join(
    home_dir,
    ".libian",
    "crawler",
    "config",
    "dc_v1.json"
  );
  await write_file({
    file_path: config_file_path,
    creator: {
      mode: "text",
      content: () =>
        new Promise<string>((rs, _) =>
          rs(JSON.stringify(template_config(), null, 2))
        ),
    },
    log_tag: {
      alia_name: "config file",
    },
  });
  // 将家目录下的配置文件符号链接至 data_cleaner_ci_generated
  await write_file({
    file_path: path.join(data_cleaner_ci_generated, "config.json"),
    creator: {
      mode: "symlink",
      old: config_file_path,
      allow_old_not_found: false,
    },
    log_tag: {
      alia_name: "config file symlink",
    },
  });
  // 在家目录下创建 user_code 目录
  const user_code_dir = path.join(
    home_dir,
    ".libian",
    "crawler",
    "data_cleaner_ci",
    "user_code"
  );
  await Deno.mkdir(user_code_dir, {
    recursive: true,
    mode: 0o700,
  });
  console.log("Mkdir user code dir at :", user_code_dir);
  const user_code_dir_link = path.join("user_code");
  // 将家目录下的 user_code 目录符号链接至 data_cleaner_ci_generated
  await write_file({
    file_path: user_code_dir_link,
    creator: {
      mode: "symlink",
      old: user_code_dir,
      allow_old_not_found: false,
    },
    log_tag: {
      alia_name: "user code dir link",
    },
  });
  await write_file({
    file_path: path.join(user_code_dir_link, "readme.md"),
    creator: {
      mode: "text",
      // deno-lint-ignore require-await
      content: async () => `# 用户代码目录

此目录是符号链接，指向 ${user_code_dir}。

并且此目录被父目录的 .gitignore 忽略。

这么做是为了避免程序员个人数仓的代码泄漏到主仓库分支中。

如果有保存个人代码的需要，可将 个人仓库 中的 user_code 目录被软链接 ${user_code_dir} 所指向。
`,
    },
    log_tag: {
      alia_name: "user code readme file",
    },
  });
  await write_file({
    file_path: path.join(user_code_dir_link, "LibianCrawlerGarbage.ts"),
    creator: {
      mode: "text",
      // deno-lint-ignore require-await
      content: async () =>
        `
export type LibianCrawlerGarbage = {} // 自己改成自己数仓的类型;
export const read_LibianCrawlerGarbage = ()=>{} // 自己改成自己数仓的 api;
      `,
    },
    log_tag: {
      alia_name: "user code readme file",
    },
  });
}

// ...
// #endregion init_config
if (import.meta.main) {
  await init_config();
}
