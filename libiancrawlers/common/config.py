# -*- coding: UTF-8 -*-
import asyncio
import json
import os
import sys
from typing import Optional, Callable, Any

from confection import Config
from loguru import logger
from aiofiles import os as aioos

CONFIG_VERSION = 1
CONFIG_TEMPLATE = """
[crawler]

[crawler.database]


[crawler.xiaohongshu]
cookie=

"""


def is_config_truthy(s: Optional[str]):
    y = (s.lower() == 'true'
         or s == 1 or s == '1'
         or s.lower() == 'yes'
         or s.lower() == 'y')
    n = (s.lower() == 'false'
         or s == 0 or s == '0'
         or s.lower() == 'no'
         or s.lower() == 'n')
    if not y and not n:
        raise ValueError('Invalid config boolean %s' % s)
    return y


_READIED_CONFIG = None


def read_config(*args: str,
                sys_exit: Optional[Callable[[int], None]] = None,
                checking: Callable[[Any], Optional[str]] = None):
    """
    绝大多数情况下，此函数只在第一次启动时阻塞协程一次。所以无须在意。

    :param args:
    :param sys_exit:
    :param checking:
    :return:
    """
    global _READIED_CONFIG
    if _READIED_CONFIG is None:
        _READIED_CONFIG = _read_config(sys_exit=sys_exit)
    o = _READIED_CONFIG
    arg = None
    try:
        for arg in args:
            o = o[arg]
        err_msg = checking(o) if checking is not None else None
        if err_msg:
            raise ValueError('Invalid config %s : %s' % (args, err_msg))
        return o
    except BaseException:
        logger.error('Error on read config : config is {}',
                     json.dumps(_READIED_CONFIG, ensure_ascii=False, indent=2))
        logger.exception('Failed read config path {} , current : arg={} , o={}',
                         args, arg, json.dumps(o, ensure_ascii=False, indent=2))
        raise


def _read_config(*, sys_exit: Optional[Callable[[int], None]] = None):
    if sys_exit is None:
        sys_exit = sys.exit
    config_dir = os.path.join(os.path.expanduser("~"), '.libian', 'crawler', 'config')
    if not os.path.exists(config_dir) or not os.path.isdir(config_dir):
        os.makedirs(config_dir, mode=755, exist_ok=True)
    config_file_path = os.path.join(config_dir, 'v1.cfg')
    if not os.path.exists(config_file_path):
        with open(config_file_path, mode='w+', encoding='utf-8') as f:
            logger.warning('Not exist config dir , auto create it at {}', config_file_path)
            f.write(CONFIG_TEMPLATE)
            logger.warning('Please rewrite it !')
        return sys_exit(66)
    logger.debug('Start read config from {}', config_dir)
    # noinspection PyBroadException
    try:
        config = Config().from_disk(config_file_path)
    except BaseException:
        logger.exception('Error on read config file at {}', config_file_path)
        print('Please open the config dir and delete/modify the file:\n\t' + config_file_path)
        return sys_exit(1)
    logger.debug('Config is {}', json.dumps(config, indent=2, ensure_ascii=False))
    return config


async def read_config_get_path(*args: str, create_if_not_exist: bool = False):
    def get_path():
        v: str = read_config(*args, checking=lambda it: None if isinstance(it, str) else 'Should be str')
        p = v.replace('{{HOME}}', os.path.expanduser('~')).replace('/', os.sep)
        logger.debug('get path from config : args={} , v={} , p={}', args, v, p)
        return p

    pth = await asyncio.get_event_loop().run_in_executor(None, get_path)
    if create_if_not_exist and not await aioos.path.exists(pth):
        logger.debug('makedirs {}', pth)
        await aioos.makedirs(pth, mode=755)

    return pth


if __name__ == '__main__':
    pass
