---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "LibianCrawler"
  text: ""
  tagline: "一套数据采集、清洗、存储、展示、二开的工具集。"
  actions:
    - theme: brand
      text: "了解 LibianCrawler"
      link: /guide/learn-about-libiancrawler
    # - theme: alt
    #   text: "项目功能模块化设计与路线图"
    #   link: /api-examples
features:
  - title: 数据采集
    details: 可基于 Camoufox + 脚本 进行浏览器数据采集；也可以直接使用 API库进行数据采集。
  - title: 数据清洗
    details: TypeScript + Jsonata + Quicktype 实现多阶段数据处理，实现 存量缓存、格式转换、类型生成及检查。
  - title: 数据存储
    details: 将清洗完成后的数据 upsert 到 Postgres ，新增非格式化数据至 MinIO 。
  - title: 数据展示
    details: 使用 NocoDB 提供类似电子表格的可视化界面。
  - title: 数据二开
    details: 基于 NocoDB Api 封装数据集二开工具。
---
