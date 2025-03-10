# 项目功能模块化设计与路线图

以下是详细的项目功能及进度。

## 核心功能模块

- 爬虫部分
  - 使用 playwright + camoufox 实现浏览器自动化操作
    - 通过指纹检查
      - [x] browser scan
    - 自动使用系统代理
      - 在 Windows 上
        - [x] 读取注册表 `Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings`
    - [ ] 优化 geoip , proxy-ip , locale , font 相互集成。
      - [ ] 修复 MacOS 上缺少默认中文字体问题（应当仅在 locale = zh-CN 时启用并提供随机字体列表）
    - Dump WebPage
      - [x] 读取所有 frame 的 html tree
      - [x] 调用截图功能
        - [ ] 修复 firefox(camoufox) `Cannot take screenshot larger than 32767` 错误。
      - 将图片或 pdf 上传到 MinIO，而不是保存 base64 。
      - 寻找解决 firefox(camoufox) 无法打印网页为 pdf 的替代方案。
    - Hook
      - [ ] hook 所有 request / response
      - [ ] hook 所有 WebSocket
      - [ ] hook 所有页面创建
      - [ ] hook 所有路由变动
      - [ ] hook 所有 `JSON.parse()`
      - [ ] hook 所有 `fetch()` 和返回值 `.json()`
  - 使用 deno + jsonata 清洗数据
    - [x] 读取 postgres 中的数据并生成类型
    - 优化生成的类型
      - [ ] 更人性化的字符串模板常量
    - [x] 运行 `dev:jsonata` 命令监听 `data_cleaner_ci/jsonata_templates` 下的更新
          并输出清洗结果至 `data_cleaner_ci/user_code`。
  - 清洗后的数据
    - [x] 增量修改到 postgres
    - [x] 自动运行 postgres 迁移
    - [x] 用 typescript 确保 迁移对象 和 数据对象 的类型一致
