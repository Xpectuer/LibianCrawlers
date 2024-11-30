# -*- coding: UTF-8 -*-
import json
import os
import sys

from typing import Optional, Callable, Any, Awaitable, Union, NoReturn

import aiofiles
import async_to_sync
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

SysExitExConfig = Callable[[], Awaitable[Union[None, NoReturn]]]

EX_CONFIG = 78


async def _sys_exit_config() -> NoReturn:
    from libiancrawlers.common import is_windows
    if is_windows():
        # noinspection PyUnresolvedReferences,PyProtectedMember
        os._exit(EX_CONFIG)
    else:
        sys.exit(EX_CONFIG)
    assert not 'Config error but not exit'


async def read_config(*args: str,
                      sys_exit: Optional[SysExitExConfig] = None,
                      checking_sync: Optional[Callable[[Any], Optional[str]]] = None):
    """
    绝大多数情况下，此函数只在第一次启动时阻塞协程一次。所以无须在意。

    :param args:
    :param sys_exit:
    :param checking_sync:
    :return:
    """
    global _READIED_CONFIG
    if _READIED_CONFIG is None:
        _READIED_CONFIG = await _read_config(sys_exit=sys_exit)
    o = _READIED_CONFIG
    arg = None
    try:
        for arg in args:
            o = o[arg]
        err_msg = checking_sync(o) if checking_sync is not None else None
        if err_msg:
            raise ValueError('Invalid config %s : %s' % (args, err_msg))
        return o
    except BaseException:
        logger.error('Error on read config : config is {}',
                     json.dumps(_READIED_CONFIG, ensure_ascii=False, indent=2))
        logger.exception('Failed read config path {} , current : arg={} , o={}',
                         args, arg, json.dumps(o, ensure_ascii=False, indent=2))
        raise


async def _read_config(*, sys_exit: Optional[SysExitExConfig] = None):
    from libiancrawlers.common import mkdirs
    config_dir = os.path.join(os.path.expanduser("~"), '.libian', 'crawler', 'config')
    await mkdirs(config_dir)
    config_file_path = os.path.join(config_dir, 'v1.cfg')
    if not os.path.exists(config_file_path):
        async with aiofiles.open(config_file_path, mode='w+', encoding='utf-8') as f:
            logger.warning('Not exist config dir , auto create it at {}', config_file_path)
            await f.write(CONFIG_TEMPLATE)
        logger.warning('Please rewrite config file at {}', config_file_path)
        return await sys_exit() if sys_exit is not None else await _sys_exit_config()
    logger.debug('Start read config from {}', config_dir)
    # noinspection PyBroadException

    try:
        async with aiofiles.open(config_file_path, mode='r+', encoding='utf-8') as f:
            config_str = await f.read()
        config = Config().from_str(config_str)
    except BaseException:
        logger.exception('Error on read config file at {}', config_file_path)
        logger.error('Please open the config dir and delete/modify the file:\n\t' + config_file_path)
        return await sys_exit() if sys_exit is not None else await _sys_exit_config()
    logger.debug('Config is {}', json.dumps(config, indent=2, ensure_ascii=False))
    return config


async def read_config_get_path(*args: str, create_if_not_exist: bool = False):
    from libiancrawlers.common import mkdirs

    async def get_path():
        v: str = await read_config(*args, checking_sync=lambda it: None if isinstance(it, str) else 'Should be str')
        p = v.replace('{{HOME}}', os.path.expanduser('~')).replace('/', os.sep)
        logger.debug('get path from config : args={} , v={} , p={}', args, v, p)
        return p

    pth = await get_path()
    if create_if_not_exist and not await aioos.path.exists(pth):
        await mkdirs(pth)

    return pth


read_config_sync = async_to_sync.function(read_config)

if __name__ == '__main__':
    pass
