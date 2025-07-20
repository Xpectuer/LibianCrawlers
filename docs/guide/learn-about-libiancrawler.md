# 1-了解 LibianCrawler

LibianCrawler 是一套数据采集、清洗、存储、展示、二开的工具集。

由于具体功能说起来太复杂，所以请放大查看下图。

> 🔗 表示可以点击查看相关文档。
>
> ㊙️ 表示这些私人代码是被排除在框架代码外的，框架不会包含隐私代码，但会提供常用工具。 

```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart TD
    A(["LibianCrawler"]) --> n1["数据采集"] & n4["数据存储"] & n5["数据清洗"] & n51["数据可视化 NocoDB"]
    n1 --> n2["Camoufox 自动化"] & n3["Api库采集"] & n8["非结构化存储 MinIO"]
    n4 --> n6@{ label: "<span style=\"padding-left:\">垃圾Postgres数据湖</span>" } & n8 & n49["NocoDB"] & n50["NocoDB自带或外部的数据集Postgres湖"]
    n2 --> n6 & n23["脚本Json"] & n55["🔗 爬虫大全参考"]
    n3 --> n6 & n55
    n5 --> n10["TypeScript"]
    n10 --> n32["Quicktype类型生成"] & n33["Jsonata开发（通过预转换前的数据）"] & n34["Kysely"] & n35["CleanAndMerge脚本"] & n54@{ label: "<span style=\"padding-left:\">㊙️</span>使用 TypeScript 读取 NocoDB Api 的视图，并作为 const 进行类型体操，生成强类型视图读取Api" }
    n6 --> n26["🔗 ㊙️ 代码生成配置文件"]
    n23 --> n24["脚本JsonSchema生成"] & n25["🔗脚本文档生成"]
    n26 --> n28["㊙️ Postgres数据源读取函数生成"]
    n8 --> n6
    n28 --> n31["读取数仓数据并本地缓存"]
    n29["Jsonata预转换"] --> n30["🔗 ㊙️ 数仓数据（预转换后）读取API代码、类型生成"]
    n31 --> n33
    n32 --> n28 & n30
    n33 --> n29
    n35 --> n36@{ label: "<span style=\"padding-left:\">启动时进行Kysely迁移，更新Postgres Schema</span>" } & n37["启动前对脚本进行 TypeScript 类型检查，以免数仓类型不符合脚本操作"]
    n30 --> n37
    n41["清洗后数据集"] --> n34
    n37 --> n42["启动后对垃圾数据进行提取（㊙️ 只保留公开信息）、去重及合并、分类"]
    n43["KyselyORM"] --> n44["KyselyORM会根据interface生成强类型定义，因此也会类型检查"]
    n44 --> n37
    n42 --> n45["本地缓存清洗后的数据集结果"] & n46@{ label: "<span style=\"padding-left:\">入库数据结构转换</span>以满足KyselyDAO定义" }
    n46 --> n47["使用Kysely写入到清洗后数据集"]
    n34 --> n48["㊙️ 数据清洗输出配置"]
    n48 --> n36
    n49 --> n50
    n50 --> n41
    n36 --> n43
    n51 --> n49 & n52@{ label: "面向用户: 使用 NocoDB 的视图来给傻瓜用户提供<span style=\"padding-left:\">条件查询、分组、分享 等功能</span>" } & n53@{ label: "<span style=\"padding-left:\">㊙️</span>数据二开：基于NocoDB Api的代码生成和视图数据转换" }
    n53 --> n54
    n52 --> n54
    n6@{ shape: rect}
    n54@{ shape: rect}
    n36@{ shape: rect}
    n46@{ shape: rect}
    n52@{ shape: rect}
    n53@{ shape: rect}
    style A fill:#FFFFFF
    style n1 stroke-width:2px,stroke-dasharray: 0,fill:#FFCDD2
    style n4 stroke-width:2px,stroke-dasharray: 0,fill:#FFE0B2,stroke:none
    style n5 fill:#FFF9C4
    style n51 fill:#C8E6C9
    style n2 fill:#FFCDD2
    style n3 fill:#FFCDD2
    style n8 fill:#FFE0B2
    style n6 fill:#FFE0B2
    style n49 fill:#FFD600
    style n50 fill:#FFD600
    style n23 fill:#FFCDD2
    style n55 fill:#FFCDD2
    style n10 stroke:#424242,fill:#FFF9C4
    style n32 fill:#FFF9C4
    style n33 fill:#FFF9C4
    style n34 fill:#FFF9C4
    style n35 fill:#FFD600
    style n54 fill:#C8E6C9
    style n26 fill:#FFF9C4
    style n24 fill:#FFCDD2
    style n25 fill:#FFCDD2
    style n28 fill:#FFF9C4
    style n31 fill:#FFF9C4
    style n29 fill:#FFF9C4
    style n30 fill:#FFF9C4
    style n36 fill:#FFD600
    style n37 fill:#FFD600
    style n41 fill:#FFD600
    style n42 fill:#FFD600
    style n43 fill:#FFD600
    style n44 fill:#FFD600
    style n45 fill:#FFD600
    style n46 fill:#FFD600
    style n47 fill:#FFD600
    style n48 fill:#FFD600
    style n52 fill:#C8E6C9
    style n53 fill:#C8E6C9
    click n55 "https://jiayezheng.tech/LibianCrawlers/develop/crawler/start-crawl.html"
    click n26 "https://jiayezheng.tech/LibianCrawlers/develop/data_cleaner_ci/init-config.html"
    click n25 "https://jiayezheng.tech/LibianCrawlers/develop/crawler/steps.html"
    click n30 "https://jiayezheng.tech/LibianCrawlers/develop/data_cleaner_ci/start-code-gen.html"


```


[//]: # (LibianCrawler 是一个模块化的数据处理框架，专为解决传统工具在 数据采集、数据清洗、数据存储、数据展示 和 数据计算 阶段中常见的工程问题而设计。通过整合一系列先进的技术和工具，LibianCrawler 能够高效地构建并输出高质量的数据集，同时支持与大语言模型（LLM）无缝对接，以实现各阶段脚本的自动化编写和优化。)

[//]: # ()
[//]: # (传统工具在上述五个阶段中通常会遇到以下问题：)

[//]: # ()
[//]: # (- **数据采集**：抓取规则复杂、反反爬虫机制多样、分布式抓取效率低下。)

[//]: # (- **数据清洗**：数据格式混乱、缺失值处理困难、清洗逻辑复杂且难以维护。)

[//]: # (- **数据存储**：海量数据存储与管理效率低下，结构化与非结构化数据处理不统一。)

[//]: # (- **数据展示**：数据可视化工具功能有限，无法满足多样化的展示需求。)

[//]: # (- **数据保护**：配置文件 和 数据结构中敏感字段 会在业务代码的版本管理中泄漏; 运行时没有权限管理。)

[//]: # (- **数据计算**：计算能力受限，难以高效处理大规模数据，且与 LLM 的集成支持不足。)

[//]: # ()
[//]: # (LibianCrawler 针对这些痛点，提供了全面的解决方案。接下来，我们将详细介绍其核心模块和功能。)

