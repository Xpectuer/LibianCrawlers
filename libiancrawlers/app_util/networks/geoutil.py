# -*- coding: UTF-8 -*-
import ipaddress
from typing import Union

from loguru import logger

from libiancrawlers.util.coroutines import blocking_func


async def get_geo(ip_addr: Union[ipaddress.IPv4Address, ipaddress.IPv6Address]):
    logger.debug('start get geolocation for {}', ip_addr)

    @blocking_func(
        disk_accessing_using_blocking_apis=True,
        network_accessing_using_blocking_apis=True,
    )
    def by_camoufox_geoip():
        from camoufox.locale import get_geolocation
        return get_geolocation(ip_addr.compressed)

    # logger.debug('success get geolocation for {} : {}', ip_addr)

    pass


if __name__ == '__main__':
    pass
