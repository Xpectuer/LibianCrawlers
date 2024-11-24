# -*- coding: UTF-8 -*-
import asyncio
import os
from datetime import datetime
from typing import Callable, Optional, Awaitable

from libiancrawlers.common.playwright_util import shutdown_playwright
from libiancrawlers.common.types import Initiator


def is_windows():
    return os.name == 'nt'


async def on_before_retry_default():
    await asyncio.sleep(60)


async def sleep(total: float, *, interval: float = 3, checker: Optional[Callable[[], Awaitable[bool]]] = None):
    start = datetime.utcnow().timestamp()
    end = start + total
    now = start
    while now < end:
        if checker is not None:
            if not await checker():
                return False
        now = datetime.utcnow().timestamp()
        await asyncio.sleep(min(interval, end - now))
        now = datetime.utcnow().timestamp()
    return True


if __name__ == '__main__':
    pass
