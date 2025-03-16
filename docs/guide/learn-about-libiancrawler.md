# 了解 LibianCrawler

LibianCrawler 通过整合一系列工具，
构建了一个模块化的、易于维护的 Web 爬虫与数据清洗框架。

## LibianCrawler 的架构设计

LibianCrawler 的架构设计有效解决了传统工具在处理复杂网页、动态内容、接口变化等方面的诸多难题，
使开发者能够更专注于业务逻辑的实现，而非繁琐的数据抓取和清洗工作。

### 1-处理传统工具的诸多难题

| 在 Web 爬虫和数据清洗时的困难之处 | playwright                                                                 | typescript + jsonata + quicktype                                                |
| --------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 接口难以定位与逆向                | 利用 [Playwright](https://playwright.dev/) 记录请求和响应、HTML frame 树。 | 结合 TypeScript 和 Jsonata 的高效数据提取能力，解析并生成相应的类型定义。       |
| 指纹检测                          | 使用 [Camoufox](https://camoufox.com/) 规避浏览器指纹检测。                |                                                                                 |
| 弹出式验证                        | 暂停脚本等待用户手动登陆、手动输入验证码。                                 |                                                                                 |
| 平台接口变动、sign 升级           | HTML frame 树并不会发生很大变化                                            | 利用 quicktype 生成返回值类型，然后利用 typescript 类型系统对业务代码类型检查。 |

### 2-使用 typescript 生态进行检查和清洗数据

**在完成数据爬取和类型生成后**，通过编写 [TypeScript](https://www.typescriptlang.org/) 业务代码，可以高效地完成数据清洗、验证和合并的任务。具体来说：

- 确保新生成的类型与老代码兼容，避免类型推断检查失败。
- 对时间格式、数值范围等关键字段进行严格的验证和清洗，确保数据质量。
- 在合并数据时，灵活处理相同 id 的情况，确保去重或更新逻辑正确。

诚然，尽管类型检查能够确保数据类型在变更过程中的兼容性，但如果原始数据的类型不整洁，则需要预先进行数据转换处理。此时，作为 JSON **查询和转换**语言的 [Jsonata](https://jsonata.org/) 将派上用场：它会在保留原始数据的基础上生成新的字段。而这些新字段也将在后续的 [Quicktype](https://quicktype.io/) **类型生成**中被输入，这样就可以让生成的类型保持整洁。

### 3-完成数据清洗之后增量更新

**在完成数据清洗之后**，会使用 [Kysely](https://kysely.dev/) 框架将数据更新到 PostgreSQL 中的各个用于存放清洗后的数据的表中，这会根据以下规则进行操作：

- 当数据库中不存在新数据的 id 时：插入一条新记录。
- 当数据库中存在旧数据但与新数据不一致时：更新旧数据为新数据。
- 当旧数据和新数据一致时：不会发生任何更改。

### 4-面对新的数据清洗需求进行迁移

**当面对新的数据清洗需求时**，若需新建结果表或在现有表中添加新列，[Kysely Migrations](https://kysely.dev/docs/migrations)
提供了高效且可靠的方式来进行数据库迁移。这种方法不仅确保了代码变更与数据库模式的同步更新，还通过 TypeScript 实现类型安全，确保了
ORM 对象与数据库列之间的类型一致性。

## LibianCrawler 的最佳实践

### 对比 LibianCrawler 的数据清洗方案和 pandas/polars 的数据清洗方案

| 特性                    | LibianCrawler                                                                                                                       | Pandas/Polars                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 类型安全                | 利用 Quicktype 对 原始数据+jsonata 转换后的数据 生成类型定义代码，利用 Typescript 强类型语言做静态检查——这可以轻松发现 type error。 | 动态类型，依赖外部工具（如 Pydantic），容易在处理到一半时发生 type error ！_（在你大叫“jupyter 启动”然后等待 5 分钟前功尽弃，因为发现一个数字类型的列里居然有“1 万”、或是神秘的 NaN、或是 crlf 和字符集问题）_ |
| 性能                    | 中，适合中小规模数据清洗                                                                                                            | 高，尤其是 Polars 在大规模数据处理中表现优异                                                                                                                                                                   |
| 学习成本                | 中等，需要熟悉 TypeScript ，VSCode 会提示。Jsonata 不难而且可以渐进式学习。                                                         | 中等，我很讨厌 Jupyter 这种没有好用的提示的半成品。而且 Pandas API 的面向魔术方法编程令人烦躁（但 Polars 还不错）。                                                                                            |
| 数据合并&存储&筛选&展示 | 编程处理数据合并；实现了数据库数据增量更新；配合 [NocoDB](https://nocodb.com/) 可以给预览者提供开箱即用的筛选器和各类视图。         | 这些方面都没有提供很好的方案。在数据筛选时容易在项目目录中产生数个体积巨大的清洗结果文件——而且体积巨大的 excel 有严重卡顿，不便展示。                                                                          |
| 适用场景                | Typescript 适合 类型未知或杂乱、有增量数据、控制流复杂的数据清洗。NocoDB 适合给想法很多又很闲又不懂技术的甲方提供数据筛选和展示。   | 适合类型固定、无增量数据、控制流简单的数据清洗。适合懂技术的人群（实验室里的老登）自己动手的数据筛选和分析。                                                                                                   |

### 在数据清洗时管理私密数据

在执行数据清洗任务之前，用户可以通过 `deno task init:config` 命令:

- 在用户家目录下创建工程文件和目录，并在项目根目录中生成它的的符号链接(symlink)。

- 这些目录会被.gitignore 规则排除，确保用户的敏感信息不被纳入版本控制。

:::code-group

<<< @/../.gitignore#output_dirs{1 txt} [.gitignore]

<<< @/../data_cleaner_ci/.gitignore{txt} [data_cleaner_ci/.gitignore]

<<< @/../data_cleaner_ci/init_config.ts#init_config{1 ts:line-numbers} [data_cleaner_ci/init_config.ts]

:::

用户可以在私有代码目录中做任何保护和封装私人代码的操作，下面是一些便于理解的示例：

:::code-group

```typescript [example1]
// 示例: 编写私密业务逻辑代码

const _read_my_private_db_and_find_user_info = async () => {
  // ...
};

// 在公共代码中使用此api
export const find_user_info = _read_my_private_file_and_find_user_info
```

```typescript [MyPrivateNocoPGLibianCrawlerGarbage_api.ts]
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
import jsonata from "jsonata";
import { read_postgres_table, read_postgres_table_type_wrap } from "../pg.ts";
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
if (import.meta.main) {
    await _main();
}
```

```typescript [example3]
// 示例: 定义类型名称以隐藏原始数据的数据结构和读取方式

// 这是代码生成后在 data_cleaner_ci/data_cleaner_ci_generated 下的私人代码
import { MyPrivateNocoPGLibianCrawlerGarbage } from "../data_cleaner_ci_generated/MyPrivateNocoPGLibianCrawlerGarbage.ts";
import { MyPrivate2NocoPGLibianCrawlerGarbage } from "../data_cleaner_ci_generated/MyPrivate2NocoPGLibianCrawlerGarbage.ts";
import { read_MyPrivateNocoPGLibianCrawlerGarbage } from "../data_cleaner_ci_generated/MyPrivateNocoPGLibianCrawlerGarbage_api.ts";
import { read_MyPrivate2NocoPGLibianCrawlerGarbage } from "../data_cleaner_ci_generated/MyPrivate2NocoPGLibianCrawlerGarbage_api.ts";

// 在公共代码中使用类型别名，隐藏和封装原本的类型名。
export type LibianCrawlerGarbage = MyPrivateNocoPGLibianCrawlerGarbage | MyPrivate2NocoPGLibianCrawlerGarbage;
export const read_LibianCrawlerGarbage = async function* (...args: any[]){
    yield* read_MyPrivateNocoPGLibianCrawlerGarbage(...args);
    yield* read_MyPrivate2NocoPGLibianCrawlerGarbage(...args);
};
```

:::

这种设计确保了用户的原始数据特征能够被有效保护，避免敏感信息暴露在公开代码中。
