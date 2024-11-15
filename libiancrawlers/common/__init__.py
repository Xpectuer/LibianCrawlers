# -*- coding: UTF-8 -*-
import os
import sys
import json
from dataclasses import dataclass
from typing import Callable, Optional

from confection import registry, Config
from loguru import logger

CONFIG_VERSION = 1
CONFIG_TEMPLATE = """
[crawler]

[crawler.database]


[crawler.xiaohongshu]
cookie=

"""


def read_config(*, sys_exit: Optional[Callable[[int], None]] = None):
    if sys_exit is None:
        sys_exit = sys.exit
    config_dir = os.path.join(os.path.expanduser("~"), 'libian', 'crawler', 'config')
    if not os.path.exists(config_dir) or not os.path.isdir(config_dir):
        os.makedirs(config_dir, mode=644, exist_ok=True)
    config_file_path = os.path.join(config_dir, 'v1.cfg')
    if not os.path.exists(config_file_path):
        with open(config_file_path, mode='w+', encoding='utf-8') as f:
            logger.warning('Not exist config dir , auto create it at {}', config_file_path)
            f.write(CONFIG_TEMPLATE)
            logger.warning('Please rewrite it !')
        return sys_exit(66)
    logger.debug('Start read config from {}', config_dir)
    try:
        config = Config().from_disk(config_file_path)
    except BaseException:
        logger.exception('Error on read config file at {}', config_file_path)
        print('Please open the config dir and delete/modify the file:\n\t' + config_file_path)
        return sys_exit(1)
    logger.debug('Config is {}', json.dumps(config, indent=2, ensure_ascii=False))
    return config


if __name__ == '__main__':
    pass
