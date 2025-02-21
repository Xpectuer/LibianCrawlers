# LibianCrawler

## Setup

This project use `poetry` as package manager.

### How to use poetry

First, You need [install poetry](https://python-poetry.org/docs/#installation).

```shell
poetry -V

poetry self update
```
Second, install all dependencies. 

```shell
# you can install without some groups
poetry install --all-groups
```

Then activate venv:

```shell
.venv/Scripts/activate
```

> or windows

```powershell
.venv\Scripts\activate
```



#### Install camoufox

if the dependencies group contains `camoufox` , you need
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

所以修改 `venv\Lib\site-packages\camoufox\pkgman.py`, 将其中的 `import requests` 修改为:

```python
import requests

inner_request_get = requests.get


def _request_get(*args, **kwargs):
    print(f'hook get : args={args} , kwargs={kwargs}')
    if kwargs.get('proxies') is None:
        kwargs['proxies'] = dict(
            http='http://localhost:7890',
            https='http://localhost:7890',
        )
    return inner_request_get(*args, **kwargs)


requests.get = _request_get
```

### Example

```shell
poetry run smart-crawl --url https://www.taobao.com/ --locale zh-CN --wait_steps jsonfile:wait_steps/taobao-search.json5?q=羽绒服
```

### Run test

```shell
poetry run pytest -s --log-cli-level=DEBUG
```