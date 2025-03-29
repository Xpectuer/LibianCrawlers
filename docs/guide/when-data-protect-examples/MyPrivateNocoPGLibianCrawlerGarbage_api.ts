// 示例: 启动针对私密数仓的代码生成流程
//       下面是一个生成代码文件，可以看到里面封装的都是私人仓库的参数，
//       因此必须将其放置于版本管理外。

//
// 此文件由 code_gen.ts 生成。
// 请通过修改 data_cleaner_ci_generated/config.json 来修改此文件，
// 而不是直接修改此文件。
//
// ```shell
// deno run --allow-env=PG* --allow-net=192.168.1.2:5432 data_cleaner_ci_generated\MyPrivateNocoPGLibianCrawlerGarbage_api.ts
// ```
// @ts-ignore
import jsonata from "jsonata";
// @ts-ignore
import { read_postgres_table, read_postgres_table_type_wrap } from "../pg.ts";
// @ts-ignore
import { MyPrivateNocoPGLibianCrawlerGarbage } from "./MyPrivateNocoPGLibianCrawlerGarbage.ts";
export function read_MyPrivateNocoPGLibianCrawlerGarbage(options?: {
  on_bar?: (bar_render_param: {
    completed: number;
    total: number;
  }) => Promise<void>;
}): AsyncGenerator<MyPrivateNocoPGLibianCrawlerGarbage[], void> {
  const cache_by_id = {
    typename: "MyPrivateNocoPGLibianCrawlerGarbage",
    enable: true,
  };
  const rows_gen = read_postgres_table({
    dbname: "xxxxx",
    user: "postgres",
    password: "xxxxxxxxxxxxxxxxxxxxxx",
    host: "192.168.1.2",
    port: 5432,
    ssl: true,
    schema: "libian_crawler",
    tablename: "garbage",
    batch_size: 200,
    cache_by_id,
    on_bar: options?.on_bar,
  });
  const jsonata_exp = jsonata("g_type & '__' & g_content.crawler_tag");
  const with_jsonata_template = ["parse_html_tree"];
  return read_postgres_table_type_wrap<MyPrivateNocoPGLibianCrawlerGarbage>({
    rows_gen,
    jsonata_exp,
    cache_by_id,
    with_jsonata_template,
  });
}
async function _main() {
  for await (const res of read_MyPrivateNocoPGLibianCrawlerGarbage()) {
    console.log("Generate result is", res);
    break;
  }
  console.log("OK");
}
// @ts-ignore
if (import.meta.main) {
  await _main();
}
