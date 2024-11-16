# -*- coding: UTF-8 -*-
import os
import sys
import json
import threading
from dataclasses import dataclass
from typing import Callable, Optional, List

from confection import registry, Config
from loguru import logger

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


def isinstance_tls(o: object):
    """
    It's nothing to do with the tls protocol , haha .
    :param o:
    :return:
    """
    return isinstance(o, tuple) or isinstance(o, list) or isinstance(o, set)


def isinstance_dtls(o: object):
    """
    It's nothing to do with the dtls protocol , haha .
    :param o:
    :return:
    """
    return isinstance(o, dict) or isinstance_tls(o)


_READIED_CONFIG = None
_READIED_CONFIG_LOCK = threading.Lock()


def read_config(*args: str, sys_exit: Optional[Callable[[int], None]] = None, ):
    global _READIED_CONFIG
    if _READIED_CONFIG is None:
        with _READIED_CONFIG_LOCK:
            if _READIED_CONFIG is None:
                _READIED_CONFIG = _read_config(sys_exit=sys_exit)
    if len(args) == 0:
        return _READIED_CONFIG
    else:
        o = None
        arg = None
        try:
            o = _READIED_CONFIG
            for arg in args:
                o = o[arg]
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


def random_user_agent():
    from random_user_agent.user_agent import UserAgent
    from random_user_agent.params import SoftwareName, OperatingSystem

    # you can also import SoftwareEngine, HardwareType, SoftwareType, Popularity from random_user_agent.params
    # you can also set number of user agents required by providing `limit` as parameter

    software_names = [SoftwareName.CHROME.value]
    operating_systems = [OperatingSystem.WINDOWS.value]

    user_agent_rotator = UserAgent(software_names=software_names, operating_systems=operating_systems, limit=1)

    # Get list of user agents.
    user_agents = user_agent_rotator.get_user_agents()

    # Get Random User Agent String.
    user_agent = user_agent_rotator.get_random_user_agent()

    return user_agent


if __name__ == '__main__':
    pass
