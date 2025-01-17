# -*- coding: UTF-8 -*-
import datetime
import json
import os.path
import random
from typing import Literal, Optional

import aiofiles.os
import aiofiles.ospath
import playwright.async_api
from loguru import logger

from libiancrawlers.common.networks import update_proxies
from libiancrawlers.common.networks.iputil import get_my_public_ip_info
from libiancrawlers.common.playwright_util import get_browser, response_to_dict, \
    page_info_to_dict, BlobOutput
from libiancrawlers.common.postgres import require_init_table, insert_to_garbage_table
from libiancrawlers.common.types import LaunchBrowserParam, LibianCrawlerBugException
from libiancrawlers.util.coroutines import sleep
from libiancrawlers.util.fs import mkdirs, aios_listdir

_valid_smart_extract_mode = ['insert_to_db', 'save_file', 'save_file_and_insert_to_db']


async def smart_extract(*,
                        url: str,
                        mode: Literal['insert_to_db', 'save_file', 'save_file_and_insert_to_db'] = 'save_file',
                        output_dir: Optional[str] = None,
                        tag_group: str = 'dev',
                        tag_version: Optional[str] = None,
                        locale: Literal['zh-CN'],
                        browser_data_dir_id='smart-extract-default',
                        wait_until_close_browser=False,
                        _should_init_app=True,
                        html_extract_detect_by_cjk: Optional[bool] = None,
                        save_file_json_indent=2,
                        ):
    _param_json = json.dumps(locals(), ensure_ascii=False, indent=save_file_json_indent)

    from libiancrawlers.common.types import Initiator
    from libiancrawlers.common.app_init import init_app
    from libiancrawlers.common.magic_util import get_magic_info
    from libiancrawlers.camoufox_server.best_launch_options import get_best_launch_options
    from libiancrawlers.camoufox_server.best_launch_options import read_proxy_server

    if mode not in _valid_smart_extract_mode:
        raise ValueError(f'Invalid mode {mode} , valid value should in {_valid_smart_extract_mode}')

    is_insert_to_db = mode == 'insert_to_db' or mode == 'save_file_and_insert_to_db'
    if _should_init_app:
        init_app(Initiator(postgres=is_insert_to_db, playwright=True))

    if output_dir is None:
        output_dir = os.path.join('.data', 'webpage-smart-extract')

    if html_extract_detect_by_cjk is None:
        html_extract_detect_by_cjk = locale in ['zh-CN']

    b_page = None
    browser_context = None
    try:
        if is_insert_to_db:
            logger.debug('start init postgres')
            await require_init_table()
        logger.debug('start get browser')

        await update_proxies()
        proxy_server = await read_proxy_server()
        my_public_ip_info = await get_my_public_ip_info()

        browser_context, _ = await get_browser(
            mode=LaunchBrowserParam(browser_data_dir_id=browser_data_dir_id),
            my_public_ip_info=my_public_ip_info,
            launch_options=await get_best_launch_options(
                my_public_ip_info=my_public_ip_info,
                proxy_server=proxy_server,
                locale=locale,
            )
        )
        logger.debug('start new page')
        b_page = await browser_context.new_page()

        logger.debug('start page goto')
        _resp_goto = await b_page.goto(url=url)

        for waited in [
            {
                'fn': 'bring_to_front',
            }, {
                'fn': 'wait_for_load_state',
                'args': ['networkidle'],
                'kwargs': {
                    'timeout': 1,
                },
                'on_timeout': 'continue',
            }, {
                'fn': 'wait_for_load_state',
                'args': ['domcontentloaded'],
                'kwargs': {
                    'timeout': 30,
                },
            }, {
                'fn': 'wait_for_load_state',
                'args': ['load'],
                'kwargs': {
                    'timeout': 30,
                }
            },
            *([
                {
                    'fn': 'sleep',
                    'args': [0.2],
                }, {
                    'fn': 'mouse_move',
                    'args': [random.randint(0, 1920), random.randint(0, 1080)],
                    'kwargs': {
                        'steps': 5
                    }
                }
            ].__mul__(4))
        ]:
            timeout = waited['timeout'] * 1000 if waited.get('timeout') is not None else None
            try:
                logger.debug('start wait , param is {}', waited)
                if waited.get('fn') is not None:
                    fn_map = {
                        'sleep': sleep,
                        'wait_for_load_state': b_page.wait_for_load_state,
                        'bring_to_front': b_page.bring_to_front,
                        'wait_for_function': b_page.wait_for_function,
                        'mouse_move': b_page.mouse.move
                    }
                    _waited_args = waited.get('args')
                    _waited_kwargs = waited.get('kwargs')
                    if _waited_args is None:
                        _waited_args = []
                    if _waited_kwargs is None:
                        _waited_kwargs = dict()
                    await fn_map[waited['fn']](*_waited_args, **_waited_kwargs)
            except playwright.async_api.TimeoutError as err_timeout:
                if waited.get('on_timeout') == 'continue':
                    logger.debug('wait timeout but continue , err_timeout is {}', err_timeout)
                    continue
                raise

        logger.debug('finished all waiter')
        if is_insert_to_db:
            logger.debug('start build page_info for insert_to_db')
            page_info_smart_wait_insert_to_db = await page_info_to_dict(
                b_page,
                on_screenshot=BlobOutput(mode='base64',
                                         base_dir=None,
                                         filename=None)
            )
        else:
            page_info_smart_wait_insert_to_db = None

        base_dir = None
        is_save_file = mode == 'save_file' or mode == 'save_file_and_insert_to_db'
        logger.debug('is_save_file is {}', is_save_file)
        if is_save_file:
            def get_ymd_hms_str():
                n = datetime.datetime.now()
                return f'at{str(n.year).rjust(5, "_")}{str(n.month).rjust(2, "0")}{str(n.day).rjust(2, "0")}{str(n.hour).rjust(2, "0")}{str(n.minute).rjust(2, "0")}{str(n.second).rjust(2, "0")}'

            if tag_version is None:
                while True:
                    tag_version_2 = get_ymd_hms_str()
                    base_dir = os.path.join(output_dir, tag_group, tag_version_2)
                    logger.debug('try base_dir at {}', base_dir)
                    if await aiofiles.ospath.isdir(base_dir) and len(await aios_listdir(base_dir)) > 0:
                        logger.debug('base_dir is not empty , try next tag version , current is {}', tag_version_2)
                        await sleep(1)
                        continue
                    break
            else:
                tag_version_2 = tag_version
                base_dir = os.path.join(output_dir, tag_group, tag_version_2)
            logger.debug('base dir is {}', base_dir)
            await mkdirs(base_dir)
            _param_json_file_path = os.path.join(base_dir, 'param.json')
            logger.debug('start save _param_json to {}', _param_json_file_path)
            async with aiofiles.open(_param_json_file_path, mode='wt', encoding='utf-8') as f:
                await f.write(_param_json)

            logger.debug('start build page_info_smart_wait_save_file')
            page_info_smart_wait_save_file = await page_info_to_dict(
                b_page,
                on_screenshot=BlobOutput(mode='file',
                                         base_dir=base_dir,
                                         filename='page_smart_wait_screenshot.png')
            )
        else:
            page_info_smart_wait_save_file = None

        logger.debug('start parse resp_goto')
        resp_goto = await response_to_dict(_resp_goto)

        logger.debug('start parse body_resp_goto')
        body_resp_goto = get_magic_info(await _resp_goto.body())

        logger.debug('start parse page_content')
        page_content = get_magic_info(await b_page.content())

        common_info = dict(
            resp_goto=resp_goto,
            body_resp_goto=body_resp_goto,
            page_content=page_content,
        )

        if is_save_file:
            logger.debug('start save file')
            if base_dir is None:
                raise LibianCrawlerBugException('BUG, base_dir should not none')

            _result_json = json.dumps(dict(
                common_info=common_info,
                page_info_smart_wait=page_info_smart_wait_save_file,
            ), indent=save_file_json_indent, ensure_ascii=False)
            logger.debug('start write to file , _result_json length is {}', len(_result_json))
            async with aiofiles.open(os.path.join(base_dir, 'result.json'), mode='wt', encoding='utf-8') as f:
                await f.write(_result_json)
            logger.debug('finish save file')

        if is_insert_to_db:
            logger.debug('start insert to db')
            if tag_version is None:
                now = datetime.datetime.now()
                tag_version_2 = f'at{str(now.year).rjust(5, "_")}{str(now.month).rjust(2, "0")}'
            else:
                tag_version_2 = tag_version

            await insert_to_garbage_table(
                g_type=f'webpage_smart_extract',
                g_content=dict(
                    crawler_tag=f'{tag_group}:{tag_version_2}',
                    common_info=common_info,
                    page_info_smart_wait=page_info_smart_wait_insert_to_db,
                )
            )
            logger.debug('finish insert to db')
    finally:
        if wait_until_close_browser:
            logger.debug('start wait close browser manually')
            while b_page is not None and not b_page.is_closed():
                await sleep(0.3)
        logger.debug('OK')


def cli():
    from fire import Fire
    Fire(smart_extract)


if __name__ == '__main__':
    pass
