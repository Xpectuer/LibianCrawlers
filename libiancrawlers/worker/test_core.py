# -*- coding: UTF-8 -*-
import asyncio

import pytest

from libiancrawlers.util.coroutines import CountDownLaunch
from libiancrawlers.worker.core import *


async def _create_core(*, loop: asyncio.AbstractEventLoop, addrs: List[str], enable_noisy_debug_logger: bool = False):
    core1 = WorkerCore(loop=loop)
    core1.sonar.enable_noisy_debug_logger = enable_noisy_debug_logger
    for addr in addrs:
        await core1.sonar.add_detection_addr(addr)
    return core1


@pytest.mark.asyncio
async def test_launch_two_node_on_localhost_and_discover_other():
    loop = asyncio.get_event_loop()

    # init core0
    core0 = await _create_core(loop=loop,
                               addrs=[f'|udp-server|bind|:8642|sendto|127.0.0.1:8643-8645|'],
                               enable_noisy_debug_logger=True, )
    cdl0 = CountDownLaunch(1)
    core0.sonar.set_handler_of_receive_packet_on_detection_from_udp_server(
        ('count down cdl', lambda pak, host, port: [
            logger.info('{} receive from {}:{} >>> {}', core0.sonar, host, port, pak),
            cdl0.count_down_sync()
        ]))

    # init core1
    core1 = await _create_core(loop=loop,
                               addrs=[f'|udp-server|bind|:8643|sendto|127.0.0.1:8640-8642|'],
                               enable_noisy_debug_logger=True, )
    cdl1 = CountDownLaunch(1)
    core1.sonar.set_handler_of_receive_packet_on_detection_from_udp_server(
        ('count down cdl', lambda pak, host, port: [
            logger.info('{} receive from {}:{} >>> {}', core1.sonar, host, port, pak),
            cdl1.count_down_sync()
        ]))

    # start these
    try:
        await core0.start()
        await core1.start()
        # await core1.sonar.manually_activate_once()
        logger.debug('start wait cdl0')
        if not await cdl0.wait_async(loop=loop, timeout=3):
            raise TimeoutError('cdl0 not count down')
        logger.debug('start wait cdl1')
        if not await cdl1.wait_async(loop=loop, timeout=3):
            raise TimeoutError('cdl1 not count down')
    finally:
        await core0.stop()
        await core1.stop()


@pytest.mark.asyncio
async def test_launch_many_node_on_localhost_and_discover_other():
    loop = asyncio.get_event_loop()

    addrs = [
        '|udp-server|bind|:7001|sendto|127.0.0.1:7002-7009|',
        '|udp-server|bind|:7002|sendto|127.0.0.1:7001,7003-7009|',
        '|udp-server|bind|:7003|sendto|127.0.0.1:7001-7002,7004-7009|',
        '|udp-server|bind|:7004|sendto|127.0.0.1:7001-7003,7005-7009|',
        '|udp-server|bind|:7005|sendto|127.0.0.1:7001-7004,7006-7009|',
        '|udp-server|bind|:7006|sendto|127.0.0.1:7001-7005,7007-7009|',
        '|udp-server|bind|:7007|sendto|127.0.0.1:7001-7006,7008-7009|',
        '|udp-server|bind|:7008|sendto|127.0.0.1:7001-7007,7009|',
        '|udp-server|bind|:7009|sendto|127.0.0.1:7001-7008|',
    ]

    async def _addr_to_node(_addr: str):
        _core = await _create_core(loop=loop,
                                   addrs=[_addr],
                                   enable_noisy_debug_logger=False, )
        _cdl = CountDownLaunch(addrs.__len__() - 1)
        _cdl_countdown_addrs = set()

        _core.sonar.set_handler_of_receive_packet_on_detection_from_udp_server(
            ('count down cdl', lambda pak, host, port: [
                logger.info('{} receive from {}:{} >>> {}', _core.sonar, host, port, pak),
                [
                    _cdl.count_down_sync(),
                    _cdl_countdown_addrs.add((host, port)),
                    logger.debug('add ({}, {}) to set , _cdl is {}', host, port, _cdl)
                ] if (host, port) not in _cdl_countdown_addrs else logger.debug('existed'),
            ]))
        return _addr, _core, _cdl

    nodes = await asyncio.gather(*list(map(_addr_to_node, addrs)))

    # start these
    try:
        for addr, core, _ in nodes:
            await core.start()
        for addr, core, cdl in nodes:
            if not await cdl.wait_async(loop=loop, timeout=10):
                raise TimeoutError('cdl not count down')
    finally:
        for addr, core, _ in nodes:
            await core.stop()


if __name__ == '__main__':
    pass
