# 了解 LibianCrawler

LibianCrawler通过整合 [Playwright](https://playwright.dev/)、[TypeScript](https://www.typescriptlang.org/)、[Jsonata](https://jsonata.org/)
和 [Quicktype](https://quicktype.io/) 等工具，
构建了一个模块化的、易于维护的Web爬虫与数据清洗框架。

**其架构设计有效解决了传统工具在处理复杂网页、动态内容、接口变化等方面的诸多难题**，
使开发者能够更专注于业务逻辑的实现，而非繁琐的数据抓取和清洗工作。

| 在Web爬虫和数据清洗时的困难之处 | playwright                                      | typescript + jsonata + quicktype                    | 
|-------------------|-------------------------------------------------|-----------------------------------------------------| 
| 接口难以定位与逆向         | 利用 Playwright记录请求和响应、HTML frame树。               | 结合TypeScript和Jsonata的高效数据提取能力，解析并生成相应的类型定义。         |                                   
| 指纹检测              | 使用 [Camoufox](https://camoufox.com/) 规避浏览器指纹检测。 |                                                     |                                 
| 弹出式验证             | 暂停脚本等待用户手动登陆、手动输入验证码。                           |                                                     |                                     
| 平台接口变动、sign升级     | HTML frame 树并不会发生很大变化                           | 利用 quicktype 生成返回值类型，然后利用 typescript 类型系统对业务代码类型检查。 |               

**在完成数据爬取和类型生成后**，通过编写 TypeScript 业务代码，可以高效地完成数据清洗、验证和合并的任务。具体来说：

* 确保新生成的类型与老代码兼容，避免类型推断检查失败。
* 对时间格式、数值范围等关键字段进行严格的验证和清洗，确保数据质量。
* 在合并数据时，灵活处理相同 id 的情况，确保去重或更新逻辑正确。

**在完成数据清洗之后**，会使用 [Kysely](https://kysely.dev/) 框架将数据更新到 PostgreSQL 中的各个结果表，并根据以下规则进行操作：

* 当数据库中不存在新数据的 id 时：插入一条新记录。
* 当数据库中存在旧数据但与新数据不一致时：更新旧数据为新数据。
* 当旧数据和新数据一致时：不会发生任何更改。

**当面对新的数据清洗需求时**，若需新建结果表或在现有表中添加新列，[Kysely Migrations](https://kysely.dev/docs/migrations)
提供了高效且可靠的方式来进行数据库迁移。这种方法不仅确保了代码变更与数据库模式的同步更新，还通过 TypeScript 实现类型安全，确保了
ORM 对象与数据库列之间的类型一致性。





