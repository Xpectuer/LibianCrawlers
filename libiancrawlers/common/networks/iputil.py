# -*- coding: UTF-8 -*-
import asyncio
import ipaddress
from collections import Counter
from typing import TypedDict, Optional

from loguru import logger

from libiancrawlers.common.networks.req import request

MyPublicIpInfo = TypedDict('MyPublicIpInfo', {
    'public_ip_v4': Optional[ipaddress.IPv4Address],
    'public_ip_v6': Optional[ipaddress.IPv6Address],
})


async def get_my_public_ip_info() -> MyPublicIpInfo:
    urls = [
        # Prefers IPv4
        "https://api.ipify.org",
        "https://checkip.amazonaws.com",
        "https://ipinfo.io/ip",
        # IPv4 & IPv6
        "https://icanhazip.com",
        "https://ifconfig.co/ip",
        "https://ipecho.net/plain",
        # other
    ]

    async def get_ip_echo(_url: str):
        resp = await request('GET', _url, timeout=6)
        return dict(
            url=_url,
            resp_text=resp.text.strip(),
        )

    ip_echo_results = await asyncio.gather(
        *[
            get_ip_echo(url) for url in urls
        ],
        return_exceptions=True,
    )
    logger.debug('ip echo results :\n  {}', '\n  '.join([str(v) for v in ip_echo_results]))

    cnt = Counter()
    for v in ip_echo_results:
        if isinstance(v, BaseException):
            continue
        resp_text: str = v['resp_text']
        cnt[resp_text] += 1
    # public_ip = cast(str, cnt.most_common(1)[0][0])
    public_ip_v4: Optional[ipaddress.IPv4Address] = None
    public_ip_v6: Optional[ipaddress.IPv6Address] = None
    for ip_addr, ip_count in cnt.most_common():
        try:
            ip = ipaddress.ip_address(ip_addr)
        except ValueError:
            logger.exception('Failed parse ip address {} , count={}', ip_addr, ip_count)
            continue
        if isinstance(ip, ipaddress.IPv4Address):
            if public_ip_v4 is None:
                public_ip_v4 = ip
            else:
                logger.warning('ip address not same , maybe leak happen : ip={}, ip_count={}, public_ip_v4={}',
                               ip, ip_count, public_ip_v4)
        elif isinstance(ip, ipaddress.IPv6Address):
            if public_ip_v6 is None:
                public_ip_v6 = ip
            else:
                logger.warning('ip address not same , maybe leak happen : ip={}, ip_count={}, public_ip_v6={}',
                               ip, ip_count, public_ip_v6)
        else:
            raise ValueError(f'BUG , neither IPv4Address or IPv6Address of {ip_addr}')
    # if ip != public_ip:
    #     logger.warning('ip address not same , maybe leak happen : ip={}, ip_count={}, public_ip={}',
    #                    ip, ip_count, public_ip)

    return {
        'public_ip_v4': public_ip_v4,
        'public_ip_v6': public_ip_v6,
    }


if __name__ == '__main__':
    pass
