# libiancrawler

## Setup

This project use poetry.

### How to use poetry

First, create venv and install poetry

```shell
# replace python3.9 to your py39 executable path
python3.9 -m venv venv

venv/Scripts/activate

pip -V

pip install poetry
```

Second, install all dependencies.

```shell
# you can install with all groups
poetry update --with test,crawler-xiaohongshu
```

### Example

Start xiaohongshu search :

```shell
poetry run xiaohongshu-search -k Python
```