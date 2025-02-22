# -*- coding: UTF-8 -*-
import os
from typing import List

import aiofiles.ospath
import aiofiles.os as aios
import re

import unicodedata
from aioify import aioify
from loguru import logger

aios = aios

aios_symlink = aioify(obj=os.symlink)
aios_listdir = aioify(obj=os.listdir)


async def mkdirs(dir_name: str, *, mode=0o700, exist_ok=True):
    if await aiofiles.ospath.exists(dir_name):
        if not await aiofiles.ospath.isdir(dir_name):
            logger.warning('mkdirs points to existed file : {}', dir_name)
    else:
        logger.debug('mkdirs at {}', dir_name)
    await aios.makedirs(dir_name, mode=mode, exist_ok=exist_ok)
    return dir_name


def filename_slugify(value, *, allow_unicode: bool):
    """
    Taken from https://github.com/django/django/blob/master/django/utils/text.py
    Convert to ASCII if 'allow_unicode' is False. Convert spaces or repeated
    dashes to single dashes. Remove characters that aren't alphanumerics,
    underscores, or hyphens. Convert to lowercase. Also strip leading and
    trailing whitespace, dashes, and underscores.
    """
    value = str(value)
    if allow_unicode:
        value = unicodedata.normalize('NFKC', value)
    else:
        value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^\w\s-]', '', value.lower())
    return re.sub(r'[-\s]+', '-', value).strip('-_')


if __name__ == '__main__':
    pass
