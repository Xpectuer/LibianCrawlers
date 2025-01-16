# -*- coding: UTF-8 -*-
import os.path

from aioify import aioify
from loguru import logger

from libiancrawlers.common.config import read_config
from libiancrawlers.util.plat import is_windows
from libiancrawlers.util.shell import shell_run_and_show, CmdMulti


async def launch_dns_proxy():
    dnsproxy_path = await read_config('dnsproxy', 'exec-path')
    dnsproxy_path_abs = os.path.abspath(dnsproxy_path)
    logger.debug('dnsproxy abspath : {}', dnsproxy_path_abs)

    _cmdargs = {**(await read_config('dnsproxy', 'cmdargs'))}
    _upstream = _cmdargs.pop('upstream')
    cmd_args = []
    for k in _cmdargs:
        cmd_args.append(f'--{k}')
        v = _cmdargs[k]
        if f'{v}' != '':
            cmd_args.append(f'{v}')
    for u in _upstream:
        cmd_args.append('--upstream')
        cmd_args.append(f'{_upstream[u]}')
    logger.debug('cmd args : {}', cmd_args)

    def _launch_sync():
        shell_run_and_show([
            CmdMulti(cmd=[
                dnsproxy_path_abs,
                *cmd_args,
            ], title='dnsproxy'),
            *([] if not is_windows() else [
                # CmdMulti(
                #     cmd=[
                #         "cmd.exe", "/c", '"FOR /L %N IN () DO nslookup 127.0.0.1:5453 baidu.com"'
                #     ],
                #     title='nslookup-baidu.com',
                # )
            ])
        ], total_title='about dns proxy')

    _aio_launch = aioify(obj=_launch_sync)
    await _aio_launch()


def cli():
    from fire import Fire
    Fire(launch_dns_proxy)


if __name__ == '__main__':
    pass
