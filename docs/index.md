---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "LibianCrawler"
  text: ""
  tagline: "一个高效、灵活且可扩展的数据采集与处理框架，解决传统工具在复杂工程场景下的不足。"
  actions:
    - theme: brand
      text: "来了解 LibianCrawler"
      link: /guide/learn-about-libiancrawler
    # - theme: alt
    #   text: "项目功能模块化设计与路线图"
    #   link: /api-examples

features:
  - title: 浏览器模拟操作
    details: 基于 Playwright + 指纹浏览器 Camoufox 实现对各类网站的自动化访问，通过编写 json 脚本来操纵浏览器。
  - title: 浏览器数据爬取
    details: 抓取 HTML 树结构、请求/响应信息、hook 环境、截图等浏览器环境下的详细数据。
  - title: API库数据爬取
    details: 内嵌了一些平台的 API 库，这同样也可以用作爬虫的数据来源。
  - title: 数据处理
    details: 利用 TypeScript 生态实现类型生成、数据清洗、类型检查、数据合并去重。
  - title: 数据存储
    details: 将清洗后的数据增量更新到 PostgreSQL 数据库，并自动检查和运行数据库迁移。或是将图片、音频、视频上传到 MinIO。
  - title: 数据展示
    details: 对 nocodb 的数据格式和api进行兼容。nocodb 是一个基于数据库的漂亮的仿电子表格界面，https://nocodb.com 了解更多。
  - title: 数据计算
    details: 读取MinIO中的图片和音视频并运行内容识别，保存结果至数据库。将数据库内的数据接入 ElasticSearch，或是用作 LLM 的训练材料。
---

