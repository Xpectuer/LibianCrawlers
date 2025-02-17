# -*- coding: UTF-8 -*-
import asyncio
from typing import NoReturn

from camoufox.server import launch_server
from loguru import logger

from libiancrawlers.camoufox_server.best_launch_options import get_best_launch_options


async def launch_camoufox_server(
        **launch_options,
):
    from libiancrawlers.common.app_init import exit_app

    try:
        logger.debug('launch param : {}', locals())
        if launch_options is None:
            launch_options = await get_best_launch_options()

        def _launch() -> NoReturn:
            return launch_server(
                **launch_options
            )

        from concurrent.futures import ThreadPoolExecutor
        await asyncio.get_event_loop().run_in_executor(ThreadPoolExecutor(), _launch)
    finally:
        await exit_app()


def cli():
    from fire import Fire
    from libiancrawlers.common.app_init import init_app, Initiator
    init_app(Initiator(
        playwright=False,
        postgres=False,
    ))
    Fire(launch_camoufox_server)


if __name__ == '__main__':
    pass
