# -*- coding: UTF-8 -*-
import pytest
from loguru import logger

from libiancrawlers.crawlers.apilib.bilibili.credential_store import latest_bilibili_credential


@pytest.mark.asyncio
async def test_read_credential():
    logger.debug('Credential is {}', await latest_bilibili_credential())


if __name__ == '__main__':
    pass
