# -*- coding: UTF-8 -*-
import asyncio
from io import BytesIO
from typing import Dict, Optional, Union, List, Tuple, Any

import curl_cffi.requests
from curl_cffi.requests import HttpMethod, Response


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
