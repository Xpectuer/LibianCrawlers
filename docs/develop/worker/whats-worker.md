# 1-什么是 Worker

## 1.1 设计动机

:::info

在经典语境下的 Worker 通常是指集群中的执行者 —— 与之相对的，还有一个中心化的控制台。这是大型企业偏爱的架构，但不适合个人或小团队使用，原因如下：

1.  **环境差异**：家用电脑通常只有少数几台，复杂的集群控制和容错机制无用武之地。同时，企业级调度系统往往缺乏针对单个任务的精细化控制，如暂停、恢复、批次流式传输、双向事件传递等。

2.  **动态与不确定性**：家庭环境中的闲置电脑随时可能被他人使用。这要求任务调度策略必须非常灵活，能够应对节点的动态变化。

:::

为了在家庭或小型办公环境中有效部署任务调度服务，我们需要解决以下核心问题：

1.  **复杂的任务生命周期管理**：
    - 必须支持任务的暂停、恢复和中止，以应对计算资源的临时征用。
    - 在某些场景下，需要通过 `OpenCV` 等视觉库监控进程窗口，以处理图形界面的确认对话框或模拟用户点击。
    - 当某个节点下线时，任务需要能够迁移到其他可用节点上，并包含相应的状态恢复和数据去重策略。

2.  **用户友好的交互界面 (GUI)**：
    - 需要为非技术用户（如设备所有者）提供一个直观易用的本地控制界面，提高他们部署和维护节点的意愿。
    - 需要设计合理的资源分配和权限管理机制，以便让内网之外的协作者也能安全地使用系统。

由于以上这些偏向去中心化和灵活性的需求，市面上现有的框架难以完全满足，因此我们决定自行设计和实现 Worker。

## 1.2 核心设计理念

LibianCrawler 的 Worker 基于以下核心理念设计：

- **自治性 (Autonomy)**：每个 Worker 节点都是一个相对独立的单元，能够自主执行任务、管理自身状态，并具备一定的故障自愈能力。

- **对等通信 (Peer-to-Peer Communication)**：尽管存在一个轻量级的任务分发角色，但 Worker 节点之间也具备直接通信的能力，用于任务迁移、状态同步等高级协作场景。

- **资源感知 (Resource-Awareness)**：Worker 能够监控其所在主机的系统资源（CPU、内存），并根据负载情况动态调整任务执行策略，避免对主机造成过度干扰。

- **可扩展性 (Extensibility)**：Worker 的功能是模块化的，可以轻松地通过插件或新模块来扩展其能力，例如增加新的爬虫类型或集成新的数据处理工具。

## 1.3 Worker 的架构与组件

Worker 主要由以下几个核心组件构成，这些组件在 `libiancrawlers/worker/` 目录下实现：

- **`core.py` (执行核心)**：负责任务的实际执行逻辑。它解析 `steps/*.json` 配置文件，调用相应的爬虫模块（如 Playwright），并管理任务的完整生命周期。

- **`node.py` (节点管理器)**：负责 Worker 节点的网络功能，包括：
  - **心跳机制**：定期向调度中心报告自身状态（在线、忙碌、空闲）。
  - **任务接收**：监听来自调度中心的任务指令。
  - **状态同步**：与其他节点同步信息，为任务迁移做准备。

- **`ui.py` (界面接口)**：作为后端逻辑与前端 `worker-ui` 之间的桥梁，通过 `pywebview` 等技术，将任务状态、日志等信息实时推送给本地 GUI，并接收来自 GUI 的用户操作指令（如暂停、恢复任务）。




