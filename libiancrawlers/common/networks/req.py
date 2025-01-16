# -*- coding: UTF-8 -*-
from io import BytesIO
from typing import Literal, Dict, Optional, Union, List, Tuple, Callable, Awaitable, Any
import asyncio

import asyncio

import aiohttp
import curl_cffi.requests
from curl_cffi.requests import ProxySpec, HttpMethod, Response

from libiancrawlers.util.dicts import find_first_value_not_null


async def request(
        method: HttpMethod,
        url: str,
        *,
        loop: Any = None,
        params: Optional[Union[Dict, List, Tuple]] = None,
        data: Optional[Union[Dict[str, str], List[Tuple], str, BytesIO, bytes]] = None,
        timeout: float = 30.0,
        impersonate: str = 'chrome124',
        max_recv_speed=0,
) -> Response:
    if loop is None:
        loop = asyncio.get_event_loop()

    async with curl_cffi.requests.AsyncSession(loop=loop) as s:
        resp = await s.request(
            method=method,
            url=url,
            params=params,
            data=data,
            timeout=timeout,
            impersonate=impersonate,
            max_recv_speed=max_recv_speed,
        )
        return resp


if __name__ == '__main__':
    pass
