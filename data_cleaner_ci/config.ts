import _config from "./data_cleaner_ci_generated/config.json" with {
  type: "json",
};
import { DataClean, Errors } from "./util.ts";

export type ConnectParam = {
  dbname: string;
  user: string;
  password: string;
  host: string;
  port: number;
  ssl: false | "require" | "allow" | "prefer" | "verify-full";
};

export type LibianDataCleanerCiConfig = {
  repositories: ({
    typ: "postgres";
    param: ConnectParam;
    dataset_tables: {
      dataset_typename: string;
      schema: string;
      tablename: string;
      group_by_jsonata: string;
      cache_by_id: boolean;
      with_jsonata_template: ("parse_html_tree")[];
    }[];
  } | {
    typ: "nocodb";
    base_url: DataClean.HttpUrl;
    token: string;
    dataset_typename: string;
  })[];
  libian_crawler: {
    data_storage: {
      connect_param: ConnectParam;
      migration: {
        schema: string;
        table: string;
        lock_table: string;
      };
    };
  };
};

export function config_check<
  C extends typeof _config,
>(
  c: C,
): c is LibianDataCleanerCiConfig & C {
  // TODO: check config file
  return true;
}

export function get_config(): LibianDataCleanerCiConfig {
  return config_check(_config)
    ? _config
    : Errors.throw_and_format("Invalid config", { _config });
}

//
// 有时 vscode 的 deno 插件并没有在配置更新后更新类型提示，
// 可以重新 剪切 保存 粘贴 保存 一遍代码来解决。
//
// export default _config;
