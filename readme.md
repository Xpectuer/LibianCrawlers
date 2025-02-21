# LibianCrawler

## Setup

This project use `poetry` as package manager.

### Use poetry start project

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
>
> ```powershell
> .venv\Scripts\activate
> ```

#### Install python-magic

See: https://pypi.org/project/python-magic/0.4.27/

It tells you install binary library on Windows / OSX / Debian / Ubuntu

> Debian/Ubuntu
>
> ```shell
> sudo apt-get install libmagic1
> ```

> Windows
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

> OSX
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

#### Install camoufox

you need run [script in here](https://github.com/daijro/camoufox/tree/main/pythonlib#installation) to download camoufox.

> On Windows:
>
> ```shell
> camoufox fetch
> ```

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

### Example: Start a taobao search crawler

```shell
poetry run smart-crawl --url https://www.taobao.com/ --locale zh-CN --wait_steps jsonfile:wait_steps/taobao-search.json5?q=羽绒服
```

### Run test

```shell
poetry run pytest -s --log-cli-level=DEBUG
```