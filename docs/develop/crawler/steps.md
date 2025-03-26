<script setup>
import { data as schema_str } from './steps_api.data.ts'
</script>

# Steps API

在工程目录下的 `./steps` 目录中存放着各个网站的自动化脚本。

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

这两个属性的值可以传入 `Array<Step>` 或 `Step`。

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

### `Step` 指令列表

<div v-for="s in JSON.parse(schema_str)['__api_list__']">
<h4 :id="s['markdown_title']">{{s['markdown_title']}}</h4>
<div v-html="s['markdown_html']" />
</div>
