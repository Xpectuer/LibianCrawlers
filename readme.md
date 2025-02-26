# LibianCrawler

使用 playwright + camoufox 爬取浏览器环境下的数据，并使用 typescript + jsonata 进行数据清洗和校验。

## 功能概览

**浏览器模拟**: 基于 Playwright + Camoufox 实现对各类网站的自动化访问。

**数据爬取**: 抓取 HTML 树结构、请求/响应信息、hook 环境等浏览器环境下的详细数据。

**数据处理**: 使用 TypeScript 和 Jsonata 构建流水线，实现数据清洗和校验。

⭐ 亦可以查看 [**项目功能模块化设计与路线图**](#项目功能模块化设计与路线图) 了解详细功能和进度。

## 安装

### 爬虫部分依赖（使用 Poetry 管理）

#### 初始化和安装无需额外配置的库

第一步，如果你还没有安装 Poetry，可以参考 [官方文档](https://python-poetry.org/docs/#installation) 进行安装。

```shell
poetry -V

poetry self update
```

第二步，初始化环境并安装依赖。

```shell
poetry lock

# you can install without some groups
poetry install --all-groups
```

然后进入虚拟环境 (它应当会被 poetry 自动创建):

> 查看 poetry 是否创建了虚拟环境。
>
> ```shell
> poetry env list
> ```

> 进入虚拟环境
>
> ```shell
> .venv/Scripts/activate
> ```
>
> on windows
>
> ```powershell
> .venv\Scripts\activate
> ```
>
> (我不知道在 MacOS 上会创建在哪里)

#### 安装 python-magic 库的二进制文件

在 [python-magic 0.4.27 官方文档](https://pypi.org/project/python-magic/0.4.27/)
中提供了 Windows / OSX / Debian / Ubuntu 下的二进制文件安装方法，如下所述:

> **Debian/Ubuntu**
>
> ```shell
> sudo apt-get install libmagic1
> ```

> **Windows**
>
> You'll need DLLs for libmagic. @julian-r maintains a pypi package with the DLLs, you can fetch it with:
>
> ```powershell
> .venv\Scripts\activate
> 
> pip install python-magic-bin
> ```
>
> > It seems like can't work fine with poetry , so you need run pip.

> **OSX**
>
> When using Homebrew:
>
> ```shell
> brew install libmagic
> ```
>
> When using macports:
>
> ```shell
> port install file
> ```

#### 安装 Camoufox

参考 [官方文档](https://github.com/daijro/camoufox/tree/main/pythonlib#installation) 以安装 Camoufox.

> On Windows:
>
> ```shell
> camoufox fetch
> ```
>
> On Linux or MacOS:
>
> ```shell
> python3 -m camoufox fetch
> ```

##### Use proxies for chinese developer

在下载 `camoufox-132.0.2-beta.16-win.x86_64.zip` 时发现他用的 requests，而且不走系统代理。

所以修改 `venv\Lib\site-packages\camoufox\pkgman.py`, 将其中的 `import requests` 修改为:

```python
import requests

inner_request_get = requests.get


def _request_get(*args, **kwargs):
    print(f'hook get : args={args} , kwargs={kwargs}')
    if kwargs.get('proxies') is None:
        kwargs['proxies'] = dict(
            # Modify it to your proxies
            http='http://localhost:7890',
            https='http://localhost:7890',
        )
    return inner_request_get(*args, **kwargs)


requests.get = _request_get
```

### 数据处理部分依赖（使用 Deno 管理）

See [./data_cleaner_ci/readme.md](data_cleaner_ci/readme.md)

## 使用方法

### 示例: Start a taobao search crawler

```shell
poetry run smart-crawl --url https://www.taobao.com/ --locale zh-CN --wait_steps jsonfile:wait_steps/taobao-search.json5?q=羽绒服
```

## 贡献

想要贡献？从编码到测试和功能规范，所有类型的帮助都值得赞赏。

如果您是开发人员并希望贡献代码，请做以下任意一件事:

1. 在打开 pull request 之前先打开一个 issue 进行讨论。
2. 通过其他方式联系其他贡献者进行讨论。

### 项目功能模块化设计与路线图

以下是详细的项目功能及进度。

#### 核心功能模块

* 爬虫部分
    * 使用 playwright + camoufox 实现浏览器自动化操作
        * 通过指纹检查
            * [x] browser scan
        * [自动使用系统代理](./libiancrawlers/app_util/networks/proxies.py)
            * 在 Windows 上
                * [x] 读取注册表 `Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings`
        * [ ] 优化 geoip , proxy-ip , locale , font 相互集成。
            * [ ] 修复 MacOS 上缺少默认中文字体问题（应当仅在 locale = zh-CN 时启用并提供随机字体列表） 
        * Dump WebPage
            * [x] 读取所有 frame 的 html tree
            * [x] 调用截图功能
                * [ ] 修复 firefox(camoufox) `Cannot take screenshot larger than 32767` 错误。
            * 寻找解决 firefox(camoufox) 无法打印网页为 pdf 的替代方案。
        * Hook
            * [ ] hook 所有 request / response
            * [ ] hook 所有 WebSocket
            * [ ] hook 所有页面创建
            * [ ] hook 所有路由变动
            * [ ] hook 所有 `JSON.parse()`
            * [ ] hook 所有 `fetch()` 和返回值 `.json()`
    * 使用 deno + jsonata 清洗数据
        * [x] 读取 postgres 中的数据并生成类型
        * 优化生成的类型
            * [ ] 更人性化的字符串模板常量
        * [x] 运行 `dev:jsonata` 命令监听 `data_cleaner_ci/jsonata_templates` 下的更新
          并输出清洗结果至 `data_cleaner_ci/user_code`。
    * 清洗后的数据
        * [x] 增量修改到 postgres
        * [x] 自动运行 postgres 迁移
        * [x] 用 typescript 确保 迁移对象 和 数据对象 的类型一致

#### 社交媒体爬虫模块

| 平台  | 域名                   | 爬取搜索菜单 | 清洗搜索菜单 | 爬取商品详情 | 清洗商品详情 |  
|-----|----------------------|--------|--------|--------|--------|
| 淘宝  | taobao.com           | ✔️     | todo   | todo   | todo   |   
| 拼多多 | mobile.yangkeduo.com | ✔️     | todo   | ✔️     | todo   |   

##### 命令示例

淘宝:

```shell
poetry run smart-crawl --debug --url https://www.taobao.com/ --locale zh-CN --wait_steps jsonfile:wait_steps/taobao-search.json5?q=羽绒服
```

拼多多(mobile.yangkeduo.com):

```shell
poetry run smart-crawl --debug --url https://mobile.yangkeduo.com/ --locale zh-CN --wait_steps jsonfile:wait_steps/yangkeduo-mobile-search.json5?q=羽绒服
```

### 运行测试

在你 commit 之前，不要忘了运行测试哟。

```shell
poetry run pytest -s --log-cli-level=DEBUG
```
