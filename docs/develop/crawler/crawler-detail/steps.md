<script setup>
import { data as step_api_metas_html } from './steps_api.data.ts'
</script>

# Steps API

在工程目录下的 [steps 目录](https://github.com/Xpectuer/LibianCrawlers/tree/main/steps) 中存放着各个网站的自动化脚本。

这些脚本用于 smart-crawl 爬虫的 [--steps 参数](./smart-crawl-document.md#steps) 。

## 原理

这些脚本均为 json 格式。其使用 `{ "$schema": "./schemas/v2.json" }` 来进行校验。

### 自动生成

而 `steps/schemas/v2.json` 这个文件又是被 下面这个命令 来生成的:

```shell
poetry run generate-steps-api-documents
```

这个命令会根据 [
`libiancrawlers/crawlers/smart_crawl/steps_api.py`](https://github.com/Xpectuer/LibianCrawlers/blob/main/libiancrawlers/crawlers/smart_crawl/steps_api.py)
代码中的 python 装饰器信息 和 python 函数元信息:

- 生成 `steps/schemas/v2.json` 文件，以提供 jsonschema 约束:
    - 来自动化测试各个脚本是否符合规范。
    - 来为支持 jsonschema 的编辑器提供检查。

- 生成 `docs/develop/crawler/crawler-detail/step_api_metas.json` 文件。以便自动生成本 vitepress
  文档中的 [Step 指令列表](#step-指令列表)。

## API 指南

### 杂项

#### 异常处理

每个形如 `{"fn":"function_name"}` 的指令都可以传入 `on_success_steps` 与 `on_timeout_steps` 属性，例如:

```json
{
  "fn": "page_random_mouse_move",
  "on_success_steps": "continue",
  "on_timeout_steps": "continue"
}
```

这两个属性的值可以传入 [StepsBlock](#stepsblock)。

`on_timeout_steps` 将会在函数抛出 常见的超时异常 时发生作用。

> 常见的超时异常如 `playwright.async_api.TimeoutError`,`asyncio.TimeoutError`, `TimeoutError` 。

- 当未指定 `on_timeout_steps` 时，异常将会继续抛出，这很有可能会直接中止爬虫。
- 当指定 `on_timeout_steps` 后。将会继续执行 `on_timeout_steps` 值的指令。

而 `on_success_steps` 会于没有任何异常抛出时执行，通常用作 `on_timeout_steps` 的 else 分支

#### description

每个形如 `{"fn":"function_name"}` 的指令都可以传入 `description` 属性，例如:

```json
{
  "fn": "page_random_mouse_move",
  "description": "正在模拟人类移动鼠标"
}
```

`description` 属性不会起任何作用，它仅用于便于人类阅读。

### Ref

<!-- #### StepsBlock

#### XY

#### LocatorBlock -->

### Step 指令列表

<div v-html="step_api_metas_html" />


