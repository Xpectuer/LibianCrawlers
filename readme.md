# libiancrawler

## Setup

This project use poetry.

### How to use poetry

First, create venv and install poetry

```shell
# replace python3.9 to your py39 executable path
python3.9 -m venv venv

venv/Scripts/activate

pip3.9 -V

pip install poetry
```

Second, install all dependencies.

```shell
# you can install without some groups
poetry update --with test,camoufox-server,crawler-xiaohongshu,crawler-bilibili,crawler-zhihu
```

### Example

Start xiaohongshu search :

```shell
poetry run xiaohongshu-search -k Python
```

#### Install camoufox

if the crawler dependencies contains `camoufox` , you need
run [script in here](https://github.com/daijro/camoufox/tree/main/pythonlib#installation) .

- On Windows:

```shell
camoufox fetch
```

- On Linux or MacOS:

```shell
python3 -m camoufox fetch
```

##### Chinese user

在下载 `camoufox-132.0.2-beta.16-win.x86_64.zip` 时发现他用的 requests，而且不走系统代理。

所以不得不修改 `venv\Lib\site-packages\camoufox\pkgman.py`，在 `webdl` 函数中指定了 `requests.get` 的代理地址。

### Run test

```shell
poetry run pytest -s --log-cli-level=DEBUG
```