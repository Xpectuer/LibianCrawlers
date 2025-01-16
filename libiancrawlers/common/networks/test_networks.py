# -*- coding: UTF-8 -*-
import asyncio

import pytest
from loguru import logger

from libiancrawlers.common.app_init import init_app
from libiancrawlers.common.networks.iputil import get_my_public_ip_info


@pytest.mark.asyncio
async def test_get_my_public_ip_info():
    from libiancrawlers.common.networks.proxies import clear_schema_proxies, update_proxies
    await clear_schema_proxies()
    info = await get_my_public_ip_info()
    logger.debug('my public ip info no proxy : {}', info)
    await update_proxies()
    info = await get_my_public_ip_info()
    logger.debug('my public ip info with proxy : {}', info)


if __name__ == '__main__':
    pass
