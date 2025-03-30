---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "LibianCrawler"
  text: ""
  tagline: "一个高效、灵活且可扩展的数据 采集-清洗-存储-展示-保护-计算 框架。"
  actions:
    - theme: brand
      text: "来了解 LibianCrawler"
      link: /guide/learn-about-libiancrawler
    # - theme: alt
    #   text: "项目功能模块化设计与路线图"
    #   link: /api-examples
features:
  - title: 数据采集
    details: 基于 Playwright 和 Camoufox ，通过脚本操控浏览器进行网站数据采集。内置多平台API库，可作为爬虫数据来源。
  - title: 数据清洗
    details: TypeScript + Jsonata + Quicktype 实现的数据处理，包含类型生成与缓存、数据转换与检查等功能。
  - title: 数据存储
    details: 将清洗后的数据更新到 PostgreSQL ，或上传多媒体文件至 MinIO 。
  - title: 数据展示
    details: 部署和支持 NocoDB ，提供类似电子表格的可视化界面。
  - title: 数据保护
    details: 从工程架构上为个人开发者保护数据安全。
  - title: 数据计算
    details: 执行内容识别并存储结果，或将数据用于搜索引擎或LLM训练。
---
