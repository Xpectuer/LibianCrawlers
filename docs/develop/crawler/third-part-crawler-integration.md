# 4-第三方数据源集成

为了保护头发，我很想集成一下他人的优秀作品。

## github.com/suqingdong/impactfactor 搜索文献

项目地址:

* https://github.com/suqingdong/impact_factor

启动方法参见文档:

* [github-com-suqingdong-impact-factor](start-crawl.md#github-com-suqingdong-impact-factor)

## MediaCrawler

:::info 客观评价

[MediaCrawler](https://github.com/NanmiCoder/MediaCrawler)
可以爬取 [其声明的平台](https://github.com/NanmiCoder/MediaCrawler?tab=readme-ov-file#-%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)，
**但部分平台仍然会风控账号导致爬取中止**。

* 20251027
    * 快手、微博、知乎 应该是比较稳定能爬的。
    * 小红书、抖音、贴吧 容易风控。
    * B 站本就有API库，不过他既然做了那也行。爬取的也比较稳定。

尚待补充...

:::

:::tip 使用 MediaCrawler 代码必须遵循以下条款

* [免责声明](https://github.com/NanmiCoder/MediaCrawler?tab=readme-ov-file#disclaimer)
* [许可证](https://github.com/NanmiCoder/MediaCrawler?tab=License-1-ov-file#readme)

:::

### 集成方法

在 数据清洗CI 中，可以直接使用 Kysely 工具集读取其保存的 `database/sqlite_tables.db` 数据库文件，并清洗为想要的数据类型。

这里以在 `user_code/` 下的类型定义文件片段示例。

```typescript [user_code/LibianCrawlerGarbage.ts]
import { read_media_crawler_from_sqlite } from "../general_data_process/media_crawler_integration/read_from_sqlite.ts"; // [!code ++]
import { MediaCrawlerYield } from "../general_data_process/media_crawler_integration/util.ts"; // [!code ++]

// 此函数封装了读取 MediaCrawler 项目的本地 sqlite ， 
// 并转换为 AsyncGenerator<MediaCrawlerYield[]>
async function* my_media_crawler_datasets() {  // [!code ++]
  yield* read_media_crawler_from_sqlite({      // [!code ++]
    libsql_url: // [!code ++] 这里默认在 LibianCrawlers/.data 下初始化了一个 MediaCrawler 项目仓库。 
      "file:C:/data/LibianCrawlers/.data/MediaCrawler/database/sqlite_tables.db", // [!code ++]
  });                                          // [!code ++] 
}                                              // [!code ++]

//TJLibianCrawlerGarbage
export type LibianCrawlerGarbage =
  | MediaCrawlerYield; // [!code ++]
export const read_LibianCrawlerGarbage = [
  [1919810, my_media_crawler_datasets], // [!code ++] 这里将 MediaCrawler 的数据集生成器并入总数据集。 
] as const;
```

### 相关代码

从 sqlite 读取数据，并对其格式进行转换的代码参考此处:

* https://github.com/Xpectuer/LibianCrawlers/blob/main/data_cleaner_ci/general_data_process/media_crawler_integration/read_from_sqlite.ts


