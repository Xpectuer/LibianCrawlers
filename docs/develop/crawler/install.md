# 1-安装爬虫

:::info 需要安装 Poetry 包管理器
如果你还没有安装 Poetry，可以参考 [Poetry 官方文档](https://python-poetry.org/docs/#installation) 进行安装。
:::

## 初始化和安装无需额外配置的库

第一步，检查和更新一下你的 Poetry。

```shell
# 您应当全局安装 Poetry ，而不是安装在工程目录下（这会导致依赖的污染），
# 因此，以下命令无需在工程的环境下运行。
poetry -V

poetry self update
```

第二步，进入工程环境，初始化环境并安装依赖。

```shell
cd LibianCrawler

poetry lock

# you can install without some groups.
# venv should be created by `poetry install`.
# 你可以在不安装某些依赖组的情况下进行。
# venv 应该会由 `poetry install` 自动创建。
poetry install --all-groups
```

:::info 检查一下是否自动创建了 venv

查看 poetry 是否创建了虚拟环境。

```shell
poetry env list
```

:::

然后进入虚拟环境。

:::warning TODO
我不知道在 MacOS 上的 venv 会创建在哪里，请自行寻找。
:::

::: code-group

```shell [Linux]
.venv/Scripts/activate
```

```powershell [Windows]
.venv\Scripts\activate
```

:::

## 安装 python-magic 库的二进制文件

在 [python-magic 0.4.27 官方文档](https://pypi.org/project/python-magic/0.4.27/)
中提供了 Windows / OSX / Debian / Ubuntu 下的二进制文件安装方法，如下所述:

::: code-group

```shell [Debian/Ubuntu]
sudo apt-get install libmagic1
```

```powershell [Windows]
# You'll need DLLs for libmagic.
# @julian-r maintains a pypi package with the DLLs, you can fetch it with:

# 下面的命令需要在 venv 虚拟环境中运行。
.venv\Scripts\activate

# It seems like can't work fine with poetry , so you need run pip to install.
# 它似乎无法与 poetry 配合使用，所以你需要使用 pip 安装此库。
pip install python-magic-bin
```

```shell [OSX using Homebrew]
brew install libmagic
```

```shell [OSX using macports]
port install file
```

:::

## 安装 Camoufox

参考 [Camoufox 官方文档](https://github.com/daijro/camoufox/tree/main/pythonlib#installation) 以安装 Camoufox.

:::tip
下面的命令需要在 venv 虚拟环境中运行。
:::

::: code-group

```shell [Linux or MacOS]
python3 -m camoufox fetch
```

```powershell [Windows]
camoufox fetch
```

:::

:::details Use proxies for chinese developer

在下载 `camoufox-132.0.2-beta.16-win.x86_64.zip` 时发现他用的 requests，而且不走系统代理。

所以修改 `venv\Lib\site-packages\camoufox\pkgman.py`, 将其中的 `import requests` 修改为:

```python
import requests
# [!code ++]

# [!code ++]
inner_request_get = requests.get # [!code ++]
# [!code ++]

# [!code ++]
def _request_get(*args, **kwargs): # [!code ++]
    print(f'hook get : args={args} , kwargs={kwargs}') # [!code ++]
    if kwargs.get('proxies') is None: # [!code ++]
        kwargs['proxies'] = dict( # [!code ++]
            http='http://localhost:7890', # [!code ++]
            https='http://localhost:7890', # [!code ++]
        ) # [!code ++]
    return inner_request_get(*args, **kwargs) # [!code ++]
# [!code ++]

# [!code ++]
requests.get = _request_get # [!code ++]
```

:::
