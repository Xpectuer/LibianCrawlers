# -*- coding: UTF-8 -*-
import datetime
import json
import os.path
from typing import Literal, Optional

import aiofiles.os
import aiofiles.ospath
from loguru import logger

from libiancrawlers.common import sleep, mkdirs, aios
from libiancrawlers.common.app_init import exit_app
from libiancrawlers.common.playwright_util import get_browser, response_to_dict, \
    page_info_to_dict, BlobOutput
from libiancrawlers.common.postgres import require_init_table, insert_to_garbage_table
from libiancrawlers.common.types import LaunchBrowserParam

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
                        ):
    _param_json = json.dumps(locals(), ensure_ascii=False, indent=2)

    from libiancrawlers.common import Initiator
    from libiancrawlers.common.app_init import init_app
    from libiancrawlers.common.magic_util import get_magic_info

    if mode not in _valid_smart_extract_mode:
        raise ValueError(f'Invalid mode {mode} , valid value should in {_valid_smart_extract_mode}')

    is_insert_to_db = mode == 'insert_to_db' or mode == 'save_file_and_insert_to_db'
    if _should_init_app:
        init_app(Initiator(postgres=is_insert_to_db, playwright=True))

    if output_dir is None:
        output_dir = '.data'

    if html_extract_detect_by_cjk is None:
        html_extract_detect_by_cjk = locale in ['zh-CN']

    b_page = None
    browser_context = None
    try:
        if is_insert_to_db:
            logger.debug('start init postgres')
            await require_init_table()
        logger.debug('start get browser')
        browser_context, _ = await get_browser(
            mode=LaunchBrowserParam(browser_data_dir_id=browser_data_dir_id),
            launch_options={
                'locale': locale
            }
        )
        logger.debug('start new page')
        b_page = await browser_context.new_page()

        logger.debug('start page goto')
        resp_goto = await b_page.goto(url=url, wait_until="networkidle")

        logger.debug('start page bring_to_front')
        await b_page.bring_to_front()

        if is_insert_to_db:
            logger.debug('start page_info_to_dict for insert_to_db')
            page_info_networkidle_insert_to_db = await page_info_to_dict(
                b_page,
                on_screenshot=BlobOutput(mode='base64',
                                         base_dir=None,
                                         filename=None)
            )
        else:
            page_info_networkidle_insert_to_db = None

        base_dir = None
        is_save_file = mode == 'save_file' or mode == 'save_file_and_insert_to_db'
        if is_save_file:
            def get_ymd_hms_str():
                n = datetime.datetime.now()
                return f'at{str(n.year).rjust(5, "_")}{str(n.month).rjust(2, "0")}{str(n.day).rjust(2, "0")}{str(n.hour).rjust(2, "0")}{str(n.minute).rjust(2, "0")}{str(n.second).rjust(2, "0")}'

            if tag_version is None:
                while True:
                    tag_version_2 = get_ymd_hms_str()
                    base_dir = os.path.join(output_dir, tag_group, tag_version_2)
                    if await aiofiles.ospath.isdir(base_dir) and len(await aios.listdir(base_dir)) > 0:
                        logger.debug('base_dir is not empty , try next tag version , current is {}', tag_version_2)
                        await sleep(1000)
                        continue
                    break
            else:
                tag_version_2 = tag_version
                base_dir = os.path.join(output_dir, tag_group, tag_version_2)
            logger.debug('base dir is {}', base_dir)
            await mkdirs(base_dir)
            async with aiofiles.open(os.path.join(base_dir, 'param.json'), mode='wt', encoding='utf-8') as f:
                await f.write(_param_json)

            logger.debug('start page_info_to_dict for save_file')
            page_info_networkidle_save_file = await page_info_to_dict(
                b_page,
                on_screenshot=BlobOutput(mode='file',
                                         base_dir=base_dir,
                                         filename='page_networkidle_screenshot.png')
            )
        else:
            page_info_networkidle_save_file = None

        logger.debug('start parse all info')
        common_info = dict(
            resp_goto=await response_to_dict(resp_goto),
            body_resp_goto=get_magic_info(await resp_goto.body(),
                                          html_extract_detect_by_cjk=html_extract_detect_by_cjk),
            page_content=get_magic_info(await b_page.content(),
                                        html_extract_detect_by_cjk=html_extract_detect_by_cjk),
        )

        if is_save_file:
            logger.debug('start save file')
            if base_dir is None:
                raise Exception('BUG, base_dir should not none')
            _result_json = json.dumps(dict(
                common_info=common_info,
                page_info_networkidle=page_info_networkidle_save_file,
            ), indent=2, ensure_ascii=False)
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
                    page_info_networkidle=page_info_networkidle_insert_to_db,
                )
            )
            logger.debug('finish insert to db')
    finally:
        if wait_until_close_browser:
            logger.debug('start wait close browser manually')
            while b_page is not None and not b_page.is_closed():
                await sleep(33)
            logger.debug('OK')
        else:
            logger.debug('start close browser')
            if browser_context is not None:
                await browser_context.close()
        if _should_init_app:
            logger.debug('start exit app')
            await exit_app()
        logger.debug('OK')


def cli():
    from fire import Fire
    Fire(smart_extract)


if __name__ == '__main__':
    pass
