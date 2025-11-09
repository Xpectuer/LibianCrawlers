# -*- coding: UTF-8 -*-
from typing import Literal, Optional

import aiohttp.client_exceptions
import asyncpg
from loguru import logger


def is_network_problem(err: BaseException) -> Optional[Literal['should_retry']]:
    if str(err).find('指定的网络名不再可用') >= 0:
        return 'should_retry'
    if isinstance(err, aiohttp.client_exceptions.ClientConnectorError):
        logger.debug(
            'ClientConnectorError detail:\n    host     : {}\n    port     : {}\n    ssl      : {}\n    os_error : {}',
            err.host,
            err.port,
            err.ssl,
            err.os_error,
        )
        return 'should_retry'
    if isinstance(err, asyncpg.exceptions.ConnectionDoesNotExistError):
        return 'should_retry'
    if isinstance(err, ConnectionError):
        return 'should_retry'
    return None


if __name__ == '__main__':
    pass
