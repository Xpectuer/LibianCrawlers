# 项目功能模块化设计与路线图

以下是详细的项目功能及进度。

:::info
- [**爬虫功能模块完成进度**](./crawler/start-crawl.md)
:::

## 爬虫核心 (Crawler Core)

### 浏览器指纹测试

| 测试平台                                            | 初步测试 | 编写测试用例 |
| --------------------------------------------------- | -------- | ------------ |
| [BrowserScan](https://www.browserscan.net/)         | ✔️        |              |
| [Am I Unique](https://amiunique.org/)               |          |              |
| [CreepJS](https://github.com/abrahamjuliot/creepjs) |          |              |

### 主要功能

- **浏览器自动化 (Playwright + Camoufox)**
  - 自动应用系统代理 
    - 在 Windows 上
      - [x] 读取注册表 `Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings` 项中的代理协议与地址。
  - [ ] 优化 `geoip`, `proxy-ip`, `locale`, `font` 的集成逻辑
    - [ ] 修复 macOS 上缺少默认中文字体的问题
  - [ ] 增加对更多反爬虫技术的对抗策略
    - [ ] reCAPTCHA / hCaptcha 识别与处理
    - [ ] JS 混淆代码（如 akayai）的逆向与模拟执行

- **网页信息转储 (Dump WebPage)**
  - [x] 保存所有 frame 的 HTML 树
  - [x] 调用截图功能
  - [x] 上传资源 (图片/PDF) 到 MinIO
  - [ ] 修复 Firefox (camoufox) `Cannot take screenshot larger than 32767` 的错误
  - [ ] 寻找 Firefox (camoufox) 无法打印网页为 PDF 的替代方案
  - [ ] 增加 HAR (HTTP Archive) 文件生成与保存功能

- **浏览器事件钩子 (Hook)**
  - [ ] Hook 所有 `request` / `response`
  - [ ] Hook 所有 `WebSocket` 消息
  - [ ] Hook 所有页面创建和路由变动
  - [ ] Hook `JSON.parse()` 和 `fetch()` 的调用与返回
  - [ ] Hook `Canvas` 指纹相关的 API 调用

## 数据处理 (Data Cleaner)

- **数据清洗 (Deno + JSONata)**
  - [x] 从 Postgres 读取数据并生成 TypeScript 类型
  - [ ] 优化生成的类型，提供更易用的字符串模板常量
  - [x] 实现 `dev:jsonata` 命令以支持 JSONata 模板的热更新和实时预览
- **数据入库**
  - [x] 增量更新数据到 Postgres
  - [x] 自动化数据库迁移 (Migration)
  - [x] 使用 TypeScript 类型确保迁移对象和数据对象的一致性
  - [ ] 增加对其他数据存储的支持（如 Elasticsearch, ClickHouse）
  - [ ] 建立数据血缘追踪机制，记录数据从采集到入库的全过程

## 任务调度系统 (Worker & Scheduler)

- **任务管理**
  - [ ] 实现任务优先级队列
  - [ ] 增加任务重试机制与失败策略（如指数退避）
  - [ ] 实现分布式锁，防止同一任务被重复执行
  - [ ] 支持任务依赖关系定义（DAG）
  - [ ] 支持定时任务（Cron Job）

- **节点管理**
  - [ ] Worker 节点心跳检测与自动重连机制
  - [ ] 动态增删 Worker 节点
  - [ ] 实现基于节点负载的动态任务分配策略

- **日志与历史**
  - [ ] 记录完整的任务执行历史与日志
  - [ ] 提供按任务 ID 查询日志的接口
  - [ ] 日志归档与清理机制

## 前端用户界面 (Worker-UI)

- **仪表盘与可视化**
  - [ ] 任务管理仪表盘，展示实时任务列表、状态和进度
  - [ ] Worker 节点管理面板，展示所有在线节点及其资源占用情况
  - [ ] 增加数据可视化图表，展示采集数据的统计信息

- **交互功能**
  - [ ] 实现手动触发、暂停、恢复、取消任务的功能
  - [ ] 提供图形化界面用于创建和编辑 `steps/*.json` 任务配置文件
  - [ ] 对接日志接口，在前端展示任务执行日志
  - [ ] 增加系统通知功能（如任务完成、失败告警）

- **用户体系**
  - [ ] 增加用户认证与会话管理
  - [ ] 实现基于角色的访问控制 (RBAC)

## 基础设施与项目维护

- **测试与质量**
  - [ ] 提升 `data_cleaner_ci` 和 `libiancrawlers` 模块的单元测试与集成测试覆盖率
  - [ ] 建立端到端的自动化测试流程
  - [ ] 引入代码静态分析工具（Linter）和格式化工具（Formatter）

- **可观测性 (Observability)**
  - [ ] 引入 `Prometheus` 和 `Grafana` 建立更全面的系统监控体系
  - [ ] 完善结构化日志，方便日志聚合与查询（如 ELK/Loki）
  - [ ] 引入分布式追踪（如 Jaeger, OpenTelemetry）

- **部署 (Deployment)**
  - [ ] 完善部署文档，提供基于 `Docker Compose` 的一键部署方案
  - [ ] 为各模块创建正式的 `Dockerfile`
  - [ ] 提供 Kubernetes (K8s) 部署的 Helm Charts

- **文档与社区**
  - [ ] 补充各核心模块的 API 文档
  - [ ] 撰写更详细的开发者贡献指南
  - [ ] 建立社区论坛或即时通讯群组


