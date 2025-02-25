# -*- coding: UTF-8 -*-
import datetime
import json
import os.path
import itertools
import sys
from threading import Thread
from typing import Literal, Optional, Any, TypedDict

import aiofiles.os
import aiofiles.ospath
from loguru import logger

from libiancrawlers.app_util.networks import update_proxies
from libiancrawlers.app_util.networks.iputil import get_my_public_ip_info
from libiancrawlers.app_util.playwright_util import get_browser, response_to_dict, \
    page_info_to_dict, BlobOutput, url_parse_to_dict, frame_tree_to_dict
from libiancrawlers.app_util.postgres import require_init_table, insert_to_garbage_table
from libiancrawlers.app_util.types import LaunchBrowserParam, LibianCrawlerBugException, JSON

from libiancrawlers.util.coroutines import sleep
from libiancrawlers.util.fs import mkdirs, aios_listdir, filename_slugify

_valid_smart_extract_mode = ['insert_to_db', 'save_file', 'save_file_and_insert_to_db']

Locale = Literal['zh-CN']

_new_thread_count = itertools.count()

DevtoolStatus = TypedDict('DevtoolStatus', {
    'enable': bool,
    'stop': bool,
    'pause': bool,
    'thread': Optional[Thread],
    'thread_should_stop': bool,
})


# async def smart_crawl_v1_api(*,
#                              url: str,
#                              tag_group: str,
#                              tag_version: str,
#                              locale: Locale,
#                              browser_data_dir_id_suffix: str):
#     return smart_crawl_v1(
#         url=url,
#         mode='insert_to_db',
#         tag_group=tag_group,
#         tag_version=tag_version,
#         locale=locale,
#         browser_data_dir_id=f'smart-crawl-v1-api__${browser_data_dir_id_suffix}',
#         wait_until_close_browser=False,
#         _should_init_app=False,
#     )


async def smart_crawl_v1(*,
                         url: str,
                         mode: Literal['insert_to_db', 'save_file', 'save_file_and_insert_to_db', 'all'] = 'save_file',
                         output_dir: Optional[str] = None,
                         tag_group: str = 'cli-group',
                         tag_version: Optional[str] = None,
                         locale: Locale,
                         browser_data_dir_id='smart-crawl-v1-default-browser-data-dir-id',
                         wait_until_close_browser=False,
                         _should_init_app=True,
                         save_file_json_indent=2,
                         wait_steps: JSON = None,
                         debug: bool = False,
                         ):
    _is_success_end = True
    base_dir = None
    _param_json = json.dumps(locals(), ensure_ascii=False, indent=save_file_json_indent)

    from libiancrawlers.app_util.types import Initiator
    from libiancrawlers.app_util.app_init import init_app
    from libiancrawlers.app_util.magic_util import get_magic_info
    from libiancrawlers.app_util.camoufox_util.best_launch_options import get_best_launch_options, read_proxy_server
    from libiancrawlers.crawlers.smart_crawl.wait_steps import SmartCrawlStopSignal
    from asyncio import locks

    if mode == 'all':
        mode = 'save_file_and_insert_to_db'
    if mode not in _valid_smart_extract_mode:
        raise ValueError(f'Invalid mode {mode} , valid value should in {_valid_smart_extract_mode}')

    is_save_file = mode == 'save_file' or mode == 'save_file_and_insert_to_db'
    is_insert_to_db = mode == 'insert_to_db' or mode == 'save_file_and_insert_to_db'

    if _should_init_app:
        init_app(Initiator(postgres=is_insert_to_db, playwright=True))

    if output_dir is None:
        output_dir = os.path.join('.data', 'smart-crawl-v1')

    async def launch_debug(*, message: str):
        logger.debug('Pause for debug')
        from libiancrawlers.app_util.gui_util import gui_confirm
        await gui_confirm(title='Pause for debug , close to continue', message=message)

    b_page = None
    browser_context = None

    _devtool_status: DevtoolStatus = {
        'stop': False,
        'pause': False,
        'enable': False,
        'thread': None,
        'thread_should_stop': False,
    }
    _devtool_status_lock = locks.Lock()

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

        if is_insert_to_db:
            fixed_param_insert_to_db = dict(
                cmd_param_json=json.loads(_param_json),
                cmd_param_url=url_parse_to_dict(url),
                crawler_tag=f'{tag_group}:{_get_tag_version_when_insert_to_db(tag_version)}',
            )
        else:
            fixed_param_insert_to_db = dict()

        async def _insert_to_garbage_table(**kwargs):
            logger.debug('start insert to db')
            await insert_to_garbage_table(
                g_type=f'smart-crawl-v1',
                g_content=dict(
                    **fixed_param_insert_to_db,
                    **kwargs,
                )
            )
            logger.debug('finish insert to db')

        logger.debug('start new page')
        b_page = await browser_context.new_page()

        logger.debug('start page goto')
        _resp_goto_obj = await b_page.goto(url=url, wait_until='domcontentloaded')

        async def parse_resp_goto():
            logger.debug('start parse resp_goto')
            _resp_goto_dict = await response_to_dict(_resp_goto_obj)

            if 300 <= _resp_goto_obj.status <= 399:
                body_resp_goto = None
            else:
                logger.debug('start parse body_resp_goto')
                body_resp_goto = get_magic_info(await _resp_goto_obj.body())
            return dict(
                resp_goto_dict=_resp_goto_dict,
                body_resp_goto=body_resp_goto,
            )

        if is_insert_to_db:
            await _insert_to_garbage_table(**(await parse_resp_goto()))

        if isinstance(wait_steps, str):
            from libiancrawlers.app_util.cmdarg_util import parse_json_or_read_file_json_like
            wait_steps = await parse_json_or_read_file_json_like(wait_steps)
        if wait_steps is None:
            wait_steps = []
        from libiancrawlers.crawlers.smart_crawl.wait_steps import _create_wait_steps_func_map

        if is_save_file:
            base_dir, tag_version = await _get_base_dir_when_save_file(tag_version=tag_version, output_dir=output_dir,
                                                                       tag_group=tag_group)
            logger.debug('base dir is {}', base_dir)
            await mkdirs(base_dir)
            _param_json_file_path = os.path.join(base_dir, 'param.json')
            logger.debug('start save _param_json to {}', _param_json_file_path)
            async with aiofiles.open(_param_json_file_path, mode='wt', encoding='utf-8') as f:
                await f.write(_param_json)

        _all_steps_run = []

        from playwright.async_api import Page

        async def _dump_page(dump_tag: str, page: Page):
            logger.info('call dump page , tag is {} , page title is {}', dump_tag, await page.title())
            if is_insert_to_db:
                logger.debug('start build page_info for insert_to_db')
                page_info_smart_wait_insert_to_db = await page_info_to_dict(
                    page,
                    on_screenshot=BlobOutput(
                        mode='base64',
                        base_dir=None,
                        png_filename=None,
                        pdf_filename=None)
                )
            else:
                page_info_smart_wait_insert_to_db = None

            logger.debug('start build frame tree')
            frame_tree = await frame_tree_to_dict(page.main_frame)
            if is_save_file:
                logger.debug('start build page_info_smart_wait_save_file')
                page_info_smart_wait_save_file = await page_info_to_dict(
                    page,
                    on_screenshot=BlobOutput(
                        mode='file',
                        base_dir=base_dir,
                        png_filename=f'screenshot__{filename_slugify(dump_tag, allow_unicode=True)}.png',
                        pdf_filename=f'screenshot__{filename_slugify(dump_tag, allow_unicode=True)}.pdf')
                )
            else:
                page_info_smart_wait_save_file = None

            def get_dumped_obj(*, page_info_smart_wait: Any):
                return json.loads(json.dumps(dict(
                    tag_version=tag_version,
                    tag_group=tag_group,
                    dump_tag=dump_tag,
                    all_steps_run=_all_steps_run,
                    frame_tree=frame_tree,
                    page_info_smart_wait=page_info_smart_wait,
                ), ensure_ascii=True))

            if is_save_file:
                logger.debug('start save file')
                if base_dir is None:
                    raise LibianCrawlerBugException('BUG, base_dir should not none')

                _result_json = json.dumps(
                    get_dumped_obj(
                        page_info_smart_wait=page_info_smart_wait_save_file
                    ),
                    indent=save_file_json_indent,
                    ensure_ascii=False
                )
                logger.debug('start write to file , _result_json length is {}', len(_result_json))
                async with aiofiles.open(
                        os.path.join(
                            base_dir,
                            f"{filename_slugify(f'dump_{dump_tag}', allow_unicode=True)}.json"
                        ),
                        mode='wt',
                        encoding='utf-8') as _f:
                    await _f.write(_result_json)
                logger.debug('finish save file')

            if is_insert_to_db:
                await _insert_to_garbage_table(
                    dump_page_info=get_dumped_obj(
                        page_info_smart_wait=page_info_smart_wait_insert_to_db,
                    )
                )
            pass

        async def _get_devtool_status():
            async with _devtool_status_lock:
                return _devtool_status

        async def _check_devtool():
            if not (await _get_devtool_status())['enable']:
                return 'continue'
            while (await _get_devtool_status())['pause']:
                await sleep(1)
            if (await _get_devtool_status())['stop']:
                logger.info('Devtool status stopped')
                return 'stop'
            return 'continue'

        async def _enable_devtool():
            if (await _get_devtool_status())['enable']:
                logger.info('Devtool already enabled')
                return
            logger.info('Devtool enabled . You can input command from stdin , such as : pause | resume | stop')

            def read_stdin():
                logger.debug('Start read stdin thread')
                try:
                    pass
                finally:
                    logger.debug('Stop read stdin thread')

            _devtool_thread = Thread(
                target=read_stdin,
                daemon=True,
                name=f'smart_crawl_read_stdin-{_new_thread_count.__next__()}',
            )
            _devtool_thread.start()
            async with _devtool_status_lock:
                _devtool_status['thread'] = _devtool_thread
            return

        async def _process_steps(steps):
            if not (isinstance(steps, tuple) or isinstance(steps, list) or isinstance(steps, set)):
                steps = [steps]
            for wait_step in steps:
                if await _check_devtool() == 'stop':
                    raise SmartCrawlStopSignal()
                _all_steps_run.append(json.loads(json.dumps(wait_step, ensure_ascii=False)))
                if wait_step == 'continue':
                    continue
                if wait_step == 'break':
                    break
                if wait_step == 'stop':
                    raise SmartCrawlStopSignal()
                if wait_step == 'debug':
                    if debug:
                        await launch_debug(message='debug step')
                        continue
                    else:
                        logger.debug('Skip debug command')
                        continue
                if wait_step == 'enable_devtool':
                    await _enable_devtool()
                    continue
                try:
                    logger.debug('🎼 on step : {}', wait_step)
                    if wait_step.get('fn') is not None:
                        _waited_args = wait_step.get('args')
                        _waited_kwargs = wait_step.get('kwargs')
                        if _waited_args is None:
                            _waited_args = []
                        if _waited_kwargs is None:
                            _waited_kwargs = dict()
                        fn_map = _create_wait_steps_func_map(
                            b_page=b_page,
                            browser_context=browser_context,
                            _dump_page=_dump_page,
                            _process_steps=_process_steps,
                        )
                        await fn_map[wait_step['fn']](*_waited_args, **_waited_kwargs)
                        on_success_steps = wait_step.get('on_success_steps')
                        if on_success_steps is not None:
                            logger.debug('process on success steps')
                            await _process_steps(on_success_steps)
                    else:
                        logger.error(
                            'Invalid wait_step , not exist fn , please see libiancrawlers/crawlers/smart_crawl/wait_steps.py . Value of wait_step is {}',
                            wait_step)
                except BaseException as err_timeout:
                    from libiancrawlers.util.exceptions import is_timeout_error
                    if is_timeout_error(err_timeout):
                        on_timeout_steps = wait_step.get('on_timeout_steps')
                        if on_timeout_steps is not None:
                            logger.debug('process on timeout steps')
                            await _process_steps(on_timeout_steps)
                            continue
                        else:
                            raise TimeoutError(f'timeout on step : {wait_step}') from err_timeout
                    else:
                        raise

        try:
            await _process_steps([
                *wait_steps
            ])
        except SmartCrawlStopSignal:
            logger.warning('except stop signal , i am stopping... ')
            return 'stop'

        await _dump_page(dump_tag='__at_last__', page=b_page)

    except BaseException as err:
        _is_success_end = False
        logger.exception('Raise error')
        # noinspection PyProtectedMember
        from playwright._impl._errors import TargetClosedError
        if debug and not isinstance(err, TargetClosedError):
            await launch_debug(message=f'debug on error , please see console logger . {err}')
        raise err
    finally:
        async with _devtool_status_lock:
            if _devtool_status['thread'] is not None and _devtool_status['thread'].is_alive():
                _devtool_status['thread_should_stop'] = True
        if wait_until_close_browser:
            logger.debug('start wait close browser manually')
            while b_page is not None and not b_page.is_closed():
                await sleep(0.3)
        logger.debug('END')
        if is_save_file and _is_success_end:
            if base_dir is None:
                raise Exception('base dir should not null')
            async with aiofiles.open(os.path.join(base_dir, '.is_success'), mode='w') as _is_success_file:
                await _is_success_file.write('true')
            abs_base_dir = os.path.abspath(base_dir)
            logger.info('Result at : \n\n    {}\n', abs_base_dir)
            from libiancrawlers.util.plat import is_windows
            if debug and is_windows():
                from libiancrawlers.util.shell import explore_windows
                explore_windows(abs_base_dir)
        if _should_init_app:
            from libiancrawlers.app_util.app_init import exit_app
            await exit_app()


def _get_ymd_hms_str():
    n = datetime.datetime.now()
    return f'at{str(n.year).rjust(5, "_")}{str(n.month).rjust(2, "0")}{str(n.day).rjust(2, "0")}{str(n.hour).rjust(2, "0")}{str(n.minute).rjust(2, "0")}{str(n.second).rjust(2, "0")}'


async def _get_base_dir_when_save_file(*, tag_version: Optional[str], output_dir: str, tag_group: str):
    def _get_base_dir(tag_version_nonnull: str):
        return os.path.join(
            output_dir,
            *list(
                map(
                    lambda p: filename_slugify(str(p), allow_unicode=True),
                    [tag_group, tag_version_nonnull]
                )
            )
        )

    if tag_version is None:
        while True:
            tag_version_2 = _get_ymd_hms_str()
            base_dir = _get_base_dir(tag_version_nonnull=tag_version_2)

            logger.debug('try base_dir at {}', base_dir)
            if await aiofiles.ospath.isdir(base_dir) and len(await aios_listdir(base_dir)) > 0:
                logger.debug('base_dir is not empty , try next tag version , current is {}', tag_version_2)
                await sleep(1)
                continue
            break
    else:
        tag_version_2 = tag_version
        base_dir = _get_base_dir(tag_version_nonnull=tag_version_2)
    return base_dir, tag_version_2


def _get_tag_version_when_insert_to_db(tag_version: Optional[str]):
    if tag_version is None:
        now = datetime.datetime.now()
        tag_version_2 = f'at{str(now.year).rjust(5, "_")}{str(now.month).rjust(2, "0")}'
    else:
        tag_version_2 = tag_version
    return tag_version_2


def cli():
    from fire import Fire
    Fire(smart_crawl_v1)


if __name__ == '__main__':
    pass
