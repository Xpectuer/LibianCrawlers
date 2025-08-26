# -*- coding: UTF-8 -*-
import datetime
import itertools
import json
import os.path
import traceback
from collections import Counter
from threading import Thread
from typing import Literal, Optional, Any, TypedDict, Tuple, Union, Dict
import tempfile

import aiofiles.os
import aiofiles.ospath
from loguru import logger

from libiancrawlers.app_util.locales import Locales
from libiancrawlers.app_util.networks import update_proxies
from libiancrawlers.app_util.networks.iputil import get_my_public_ip_info
from libiancrawlers.app_util.obj2dict_util import url_parse_to_dict
from libiancrawlers.app_util.playwright_util import get_browser, response_to_dict, \
    page_info_to_dict, BlobOutput, frame_tree_to_dict, ResultOfPageInfoToDict
from libiancrawlers.app_util.postgres import require_init_table, insert_to_garbage_table
from libiancrawlers.app_util.types import LaunchBrowserParam, LibianCrawlerBugException, JSON
from libiancrawlers.crawlers import CrawlMode, parse_mode, the_default_crawl_mode__save_file
from libiancrawlers.util.coroutines import sleep
from libiancrawlers.util.fs import mkdirs, aios_listdir, filename_slugify
from libiancrawlers.util.plat import PreventTheScreenSaver

_valid_smart_crawl_mode = ['insert_to_db', 'save_file', 'save_file_and_insert_to_db']

_new_thread_count = itertools.count()

DevtoolStatus = TypedDict('DevtoolStatus', {
    'enable': bool,
    'stop': bool,
    'pause': bool,
    'thread': Optional[Thread],
    'thread_should_stop': bool,
})


async def smart_crawl_v1(*,
                         url: str,
                         mode: CrawlMode = the_default_crawl_mode__save_file,
                         output_dir: Optional[str] = None,
                         tag_group: str = 'cli-group',
                         tag_version: Optional[str] = None,
                         locale: Union[Literal['proxy'], Locales],
                         browser_data_dir_id='smart-crawl-v1-default-browser-data-dir-id',
                         wait_until_close_browser=False,
                         _should_init_app=True,
                         save_file_json_indent=2,
                         steps: JSON = None,
                         debug: bool = False,
                         dump_page_ignore_names: Optional[Union[str, Tuple[str]]] = None,
                         html2markdown_soup_find: Optional[Union[str, Tuple[str]]] = None,
                         addons_root_dir: Optional[str] = None,
                         play_sound_when_gui_confirm: bool = False,
                         screen_max_height: Optional[int] = None,
                         screen_max_width: Optional[int] = None,
                         screen_min_height: Optional[int] = None,
                         screen_min_width: Optional[int] = None,
                         **__kwargs,
                         ):
    if __kwargs.keys().__len__() > 0:
        raise ValueError(f'Invalid param : {__kwargs}')

    _is_success_end = True
    base_dir = None
    _param_json = json.dumps(locals(), ensure_ascii=False, indent=save_file_json_indent)

    ___steps_param = steps
    if isinstance(steps, str):
        logger.debug('Parsing --steps argument ...')
        from libiancrawlers.app_util.cmdarg_util import parse_json_or_read_file_json_like
        steps = await parse_json_or_read_file_json_like(steps)
        if isinstance(steps, dict):
            steps = steps['steps']
    if steps is None:
        steps = []
    if not (isinstance(steps, list) or isinstance(steps, tuple) or isinstance(steps, set)):
        raise ValueError(
            f'Invalid steps , not iterable , typeof steps is {type(steps)} , param is {___steps_param} , but parsed value is {steps}')

    from libiancrawlers.app_util.types import Initiator
    from libiancrawlers.app_util.app_init import init_app
    from libiancrawlers.app_util.magic_util import get_magic_info

    from libiancrawlers.crawlers.smart_crawl.steps_api import SmartCrawlStopSignal
    from asyncio import locks

    is_save_file, is_insert_to_db = parse_mode(mode)

    if _should_init_app:
        init_app(Initiator(postgres=is_insert_to_db, playwright=True))

    if output_dir is None:
        output_dir = os.path.join('.data', 'smart-crawl-v1')

    async def launch_debug(*, message: str):
        logger.debug('Pause for debug')
        from libiancrawlers.app_util.gui_util import gui_confirm
        await gui_confirm(
            title='Pause for debug , close to continue',
            message=message,
            play_sound=False)

    b_page = None
    browser_context = None

    if url.startswith('appium://'):
        appium_url = url[len('appium://'):]
        logger.debug('appium_url is {}', appium_url)
    else:
        appium_url = None

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

        if appium_url:
            raise ValueError('Not support yet')
        else:
            from libiancrawlers.app_util.camoufox_util.best_launch_options import get_best_launch_options, \
                read_proxy_server

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
                    addons_root_dir=addons_root_dir,
                    screen_max_height=screen_max_height,
                    screen_max_width=screen_max_width,
                    screen_min_height=screen_min_height,
                    screen_min_width=screen_min_width,
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

        if appium_url:
            raise ValueError('Not support yet')
        else:
            __pages = browser_context.pages
            logger.debug('start get page , pages were {}', __pages)
            if len(__pages) > 0:
                b_page = __pages[0]
            else:
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
                    body_resp_goto = get_magic_info(await _resp_goto_obj.body(),
                                                    dump_page_ignore_names=dump_page_ignore_names,
                                                    html2markdown_soup_find=html2markdown_soup_find)
                return dict(
                    resp_goto_dict=_resp_goto_dict,
                    body_resp_goto=body_resp_goto,
                )

            if is_insert_to_db:
                await _insert_to_garbage_table(**(await parse_resp_goto()))

        _download_storage_path: str

        if is_save_file:
            base_dir, tag_version = await _get_base_dir_when_save_file(tag_version=tag_version,
                                                                       output_dir=output_dir,
                                                                       tag_group=tag_group)
            logger.debug('base dir is {}', base_dir)
            await mkdirs(base_dir)
            _param_json_file_path = os.path.join(base_dir, 'param.json')
            logger.debug('start save _param_json to {}', _param_json_file_path)
            async with aiofiles.open(_param_json_file_path, mode='wt', encoding='utf-8') as f:
                await f.write(_param_json)
            _download_storage_path = os.path.join(base_dir, 'download')
        else:
            secure_temp_dir = tempfile.mkdtemp(prefix="libian_crawler_download_", suffix="_")
            _download_storage_path = os.path.join(secure_temp_dir)
        await mkdirs(_download_storage_path)

        _all_steps_run = []

        from playwright.async_api import Page

        async def _dump_obj(dump_tag: str, obj: JSON):
            def get_dumped_obj():
                return json.loads(json.dumps(dict(
                    tag_version=tag_version,
                    tag_group=tag_group,
                    dump_tag=dump_tag,
                    all_steps_run=_all_steps_run,
                    dump_obj=obj,
                    # page_info_smart_wait=page_info_smart_wait,
                    # __page_info_smart_wait_insert_to_db__files=__page_info_smart_wait_insert_to_db__files,
                ), ensure_ascii=True))

            async def _run_save_file():
                if is_save_file:
                    logger.debug('start save file')
                    if base_dir is None:
                        raise LibianCrawlerBugException('BUG, base_dir should not none')

                    _result_json = json.dumps(
                        get_dumped_obj(),
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
                try:
                    await _insert_to_garbage_table(
                        dump_page_info=get_dumped_obj()
                    )
                    await _run_save_file()
                except BaseException:
                    if not is_save_file:
                        raise
                    else:
                        await _run_save_file()
                        raise
            else:
                await _run_save_file()

        async def _dump_page(dump_tag: str, page: Page):
            logger.info('call dump page , tag is {} , page title is {}', dump_tag, await page.title())
            if is_insert_to_db:
                logger.debug('start build page_info for insert_to_db')
                page_info_smart_wait_insert_to_db = await page_info_to_dict(
                    page,
                    on_screenshot=BlobOutput(
                        mode='minio',
                        base_dir=None,
                        png_filename=None,
                        pdf_filename=None),
                )
            else:
                page_info_smart_wait_insert_to_db = None

            logger.debug('start build frame tree')
            frame_tree = await frame_tree_to_dict(page.main_frame,
                                                  dump_page_ignore_names=dump_page_ignore_names,
                                                  html2markdown_soup_find=html2markdown_soup_find)
            if is_save_file:
                logger.debug('start build page_info_smart_wait_save_file')
                page_info_smart_wait_save_file = await page_info_to_dict(
                    page,
                    on_screenshot=BlobOutput(
                        mode='file',
                        base_dir=base_dir,
                        png_filename=f'screenshot__{filename_slugify(dump_tag, allow_unicode=True)}.png',
                        pdf_filename=f'screenshot__{filename_slugify(dump_tag, allow_unicode=True)}.pdf'),
                )
            else:
                page_info_smart_wait_save_file = None

            def get_dumped_obj(*, page_info_smart_wait: Any,
                               __page_info_smart_wait_insert_to_db: Optional[ResultOfPageInfoToDict] = None):
                if __page_info_smart_wait_insert_to_db is not None:
                    __page_info_smart_wait_insert_to_db__files = __page_info_smart_wait_insert_to_db['files']
                else:
                    __page_info_smart_wait_insert_to_db__files = None

                return json.loads(json.dumps(dict(
                    tag_version=tag_version,
                    tag_group=tag_group,
                    dump_tag=dump_tag,
                    all_steps_run=_all_steps_run,
                    frame_tree=frame_tree,
                    page_info_smart_wait=page_info_smart_wait,
                    __page_info_smart_wait_insert_to_db__files=__page_info_smart_wait_insert_to_db__files,
                ), ensure_ascii=True))

            async def _run_save_file(*, __page_info_smart_wait_insert_to_db: Optional[ResultOfPageInfoToDict] = None):
                if is_save_file:
                    logger.debug('start save file')
                    if base_dir is None:
                        raise LibianCrawlerBugException('BUG, base_dir should not none')

                    _result_json = json.dumps(
                        get_dumped_obj(
                            page_info_smart_wait=page_info_smart_wait_save_file,
                            __page_info_smart_wait_insert_to_db=__page_info_smart_wait_insert_to_db,
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
                    html2markdown: Optional[str] = None
                    if frame_tree.get('content') is not None:
                        content = frame_tree['content']
                        if content.get('html_info') is not None:
                            html_info = content['html_info']
                            if html_info.get('html2markdown') is not None:
                                html2markdown = html_info['html2markdown']
                    if html2markdown is not None and html2markdown.strip().__len__() > 0:
                        async with aiofiles.open(
                                os.path.join(
                                    base_dir,
                                    f"{filename_slugify(f'html2md_{dump_tag}', allow_unicode=True)}.md"
                                ),
                                mode='wt',
                                encoding='utf-8') as _f:
                            await _f.write(html2markdown)
                    logger.debug('finish save file')

            if is_insert_to_db:
                try:
                    await _insert_to_garbage_table(
                        dump_page_info=get_dumped_obj(
                            page_info_smart_wait=page_info_smart_wait_insert_to_db,
                        )
                    )
                    await _run_save_file(__page_info_smart_wait_insert_to_db=page_info_smart_wait_insert_to_db)
                except BaseException:
                    if not is_save_file:
                        raise
                    else:
                        await _run_save_file(__page_info_smart_wait_insert_to_db=page_info_smart_wait_insert_to_db)
                        raise
            else:
                await _run_save_file()
            pass

        _global_counter = Counter()
        _global_str_dict: Dict[str, str] = dict()

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

        from libiancrawlers.crawlers.smart_crawl.steps_api import PageRef
        _page_ref: PageRef = {'value': b_page}
        _page_ref_lock = locks.Lock()

        async def _process_steps(_steps):
            if not (isinstance(_steps, tuple) or isinstance(_steps, list) or isinstance(_steps, set)):
                _steps = [_steps]
            for _step in _steps:
                if await _check_devtool() == 'stop':
                    raise SmartCrawlStopSignal()
                _all_steps_run.append(json.loads(json.dumps(_step, ensure_ascii=False)))
                if _step == 'continue':
                    continue
                if _step == 'break':
                    break
                if _step == 'stop':
                    raise SmartCrawlStopSignal()
                if _step == 'debug':
                    if debug:
                        await launch_debug(message='debug step')
                        continue
                    else:
                        logger.debug('Skip debug command')
                        continue
                if _step == 'enable_devtool':
                    await _enable_devtool()
                    continue
                try:
                    logger.debug('\n    🎼 on step :\n    {}',
                                 _step if not isinstance(_step, list) and not isinstance(_step,
                                                                                         tuple) \
                                     else '[' + ''.join(map(lambda s: f'\n    {s}', _step)) + '\n    ]')
                    if _step.get('fn') is not None:
                        _waited_args = _step.get('args')
                        _waited_kwargs = _step.get('kwargs')
                        if _waited_args is None:
                            _waited_args = []
                        if _waited_kwargs is None:
                            _waited_kwargs = dict()
                        from libiancrawlers.crawlers.smart_crawl.steps_api import StepsApi
                        steps_api = StepsApi(
                            b_page=b_page,
                            browser_context=browser_context,
                            _dump_page=_dump_page,
                            _process_steps=_process_steps,
                            _page_ref_lock=_page_ref_lock,
                            _page_ref=_page_ref,
                            _download_storage_path=_download_storage_path,
                            _dump_obj=_dump_obj,
                            _global_counter=_global_counter,
                            _global_str_dict=_global_str_dict,
                            _global_play_sound_when_gui_confirm=play_sound_when_gui_confirm,
                            _debug=debug,
                        )
                        await steps_api[_step['fn']](*_waited_args, **_waited_kwargs)
                        on_success_steps = _step.get('on_success_steps')
                        if on_success_steps is not None:
                            logger.debug('start process on success steps')
                            await _process_steps(on_success_steps)
                            logger.debug('finish process on success steps')
                    else:
                        logger.error(
                            'Invalid wait_step , not exist fn , please see libiancrawlers/crawlers/smart_crawl/wait_steps.py . Value of wait_step is {}',
                            _step)
                except BaseException as err_timeout:
                    from libiancrawlers.util.exceptions import is_timeout_error
                    if is_timeout_error(err_timeout):
                        on_timeout_steps = _step.get('on_timeout_steps')
                        if on_timeout_steps is not None:
                            logger.debug('start process on timeout steps')
                            await _process_steps(on_timeout_steps)
                            logger.debug('finish process on timeout steps')
                            continue
                        else:
                            raise TimeoutError(f'timeout on step : {_step}') from err_timeout
                    else:
                        raise

        try:
            await _process_steps([
                *steps
            ])
        except SmartCrawlStopSignal:
            logger.warning('except stop signal , i am stopping... ')
            return 'stop'

        await _dump_page(dump_tag='__at_last__', page=b_page)
        await sleep(3)
    except BaseException as err:
        _is_success_end = False
        logger.exception('Raise error')
        # noinspection PyProtectedMember
        from playwright._impl._errors import TargetClosedError
        if debug and not isinstance(err, TargetClosedError):
            await launch_debug(message=f'debug on error , please see console logger . {err}')
        if is_save_file and base_dir is not None:
            async with aiofiles.open(os.path.join(base_dir, 'error_info.txt'), mode='wt',
                                     encoding='utf-8') as _error_info_file:
                await _error_info_file.write(traceback.format_exc())
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
            async with aiofiles.open(os.path.join(base_dir, '.is_success'), mode='wt',
                                     encoding='utf-8') as _error_info_file:
                await _error_info_file.write('true')
            abs_base_dir = os.path.abspath(base_dir)
            logger.info('Result at : \n\n    {}\n', abs_base_dir)
            from libiancrawlers.util.plat import is_windows
            if debug and is_windows():
                from libiancrawlers.util.shell import explore_windows
                explore_windows(abs_base_dir)
        # noinspection PyInconsistentReturns
        if _should_init_app:
            from libiancrawlers.app_util.app_init import exit_app
            # noinspection PyInconsistentReturns
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
    with PreventTheScreenSaver():
        from fire import Fire
        Fire(smart_crawl_v1)


if __name__ == '__main__':
    pass
