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
poetry update --with test,crawler-xiaohongshu,crawler-bilibili,crawler-zhihu
```

### Example

Start xiaohongshu search :

```shell
poetry run xiaohongshu-search -k Python
```

### Run test

```shell
poetry run pytest -s --log-cli-level=DEBUG
```