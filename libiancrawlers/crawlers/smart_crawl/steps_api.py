# -*- coding: UTF-8 -*-
import asyncio
import hashlib
import random
from datetime import datetime
from typing import Optional, Literal, TypedDict, Callable, Awaitable, Union, List, Tuple

from aioify import aioify
from loguru import logger
from playwright.async_api import Page, BrowserContext, Locator

from libiancrawlers.app_util.types import JSON
from libiancrawlers.util.coroutines import sleep


class SmartCrawlSignal(BaseException):
    pass


class SmartCrawlStopSignal(SmartCrawlSignal):
    pass


XY = TypedDict('XY', {'x': float, 'y': float})

PageRef = TypedDict('PageRef', {'value': Page, })


def _create_steps_api_functions(*,
                                b_page: Page,
                                browser_context: BrowserContext,
                                _dump_page: Callable[[str, Page], Awaitable],
                                _process_steps: Callable[
                                    [Union[List[JSON], JSON]],
                                    Awaitable,
                                ]
                                ):
    from asyncio import locks
    from libiancrawlers.app_util.gui_util import gui_confirm

    _page_ref_lock = locks.Lock()
    _page_ref: PageRef = {'value': b_page}

    async def get_page():
        import inspect

        async with _page_ref_lock:
            res = _page_ref['value']

        _frame, _filename, _line_number, _function_name, _lines, _index = inspect.stack()[1]
        logger.debug('current page title is {} , call from {} , link is \n    {}',
                     await res.title(),
                     _function_name,
                     res.url)
        return res

    async def set_page(v: Page):
        async with _page_ref_lock:
            _page_ref['value'] = v
        logger.debug('set page to {}', v)

    async def switch_page(to: Union[int, Literal['default'], Page]):
        await sleep(1)
        if to == 'default':
            res = b_page
        elif isinstance(to, int):
            logger.debug('all pages : {}', browser_context.pages)
            res = browser_context.pages[to]
        elif isinstance(to, Page):
            res = to
        else:
            raise ValueError(f'Invalid param {to}')
        _old_page = await get_page()
        from_title = await _old_page.title()
        to_title_prev = await res.title()
        logger.debug('Start switch page {} : from {} , to title on create {}',
                     to,
                     from_title,
                     to_title_prev,
                     )
        await page_wait_loaded(page=res)
        to_title_cur = await res.title()
        await set_page(res)
        logger.debug('Finish switch page {} : from {} , to title ( {} >>> {} )',
                     to,
                     from_title,
                     to_title_prev,
                     to_title_cur)
        await sleep(1)

    async def page_wait_loaded(*, page: Page = None):
        if page is None:
            page = (await get_page())
        from libiancrawlers.util.exceptions import is_timeout_error
        logger.debug('start bring to front at first')
        await page_bring_to_front(page=page)
        try:
            logger.debug('start wait domcontentloaded')
            await page.wait_for_load_state('domcontentloaded', timeout=5000)
        except BaseException as err:
            if is_timeout_error(err):
                logger.debug('ignore timeout err on switch page domcontentloaded')
            else:
                raise
        try:
            logger.debug('start wait networkidle')
            await page.wait_for_load_state('networkidle', timeout=10000)
        except BaseException as err:
            if is_timeout_error(err):
                logger.debug('ignore timeout err on switch page networkidle')
            else:
                raise
        logger.debug('start bring to front at last')
        await page_bring_to_front(page=page)

    async def page_random_mouse_move():
        _page = await get_page()
        box = await _page.locator('body').bounding_box(timeout=3000)
        viewport_size = _page.viewport_size
        if box is None:
            raise ValueError("Can't get body bounding box")
        logger.debug('on mouse random move , box is {} , viewport_size is {}', box, viewport_size)
        try:
            await page_mouse_move(
                *[
                    random.randint(
                        min(max(100, int(box['x'])), viewport_size['width'] - 100),
                        min(max(100, int(box['x'] + box['width'])), viewport_size['width'] - 100)
                    ),
                    random.randint(
                        min(max(100, int(box['y'])), viewport_size['height'] - 100),
                        min(max(100, int(box['y'] + box['height'])), viewport_size['height'] - 100)
                    )
                ],
            )
        except BaseException as err:
            from libiancrawlers.util.exceptions import is_timeout_error
            if is_timeout_error(err):
                logger.debug('ignore timeout error on random mouse move')
            else:
                raise

    async def page_mouse_move(*args, **kwargs):
        logger.debug('mouse move {} {}', args, kwargs)
        if kwargs.get('timeout') is None:
            timeout = 2.0
        else:
            timeout = kwargs.pop('timeout')

        if kwargs.get('steps') is None:
            steps = 2
        else:
            steps = kwargs.pop('steps')
        await asyncio.wait_for((await get_page()).mouse.move(*args, steps=steps, **kwargs), timeout=timeout)

    async def page_go_back(*args, **kwargs):
        page = await get_page()
        old_url = page.url
        logger.debug('page go back , args={} , kwargs={} , current url is\n    {}',
                     args, kwargs, old_url)
        if kwargs.get('timeout') is not None:
            timeout = kwargs.pop('timeout')
        else:
            timeout = 4000
        res = await page.go_back(timeout=timeout, **kwargs)
        logger.debug('page go back finish .' +
                     '\n    from {}' +
                     '\n    to {}',
                     old_url, page.url, )
        return res

    @aioify
    def logd(*args, **kwargs):
        logger.debug(*args, **kwargs)

    @aioify
    def logi(*args, **kwargs):
        logger.info(*args, **kwargs)

    @aioify
    def logw(*args, **kwargs):
        logger.warning(*args, **kwargs)

    @aioify
    def loge(*args, **kwargs):
        logger.error(*args, **kwargs)

    async def on_locator(loc: Locator, opts: JSON) -> Locator:
        if not (isinstance(opts, list) or isinstance(opts, set) or isinstance(opts, tuple)):
            opts = [opts]
        for opt in opts:
            try:
                if not isinstance(opt, dict):
                    opt = {
                        'fn': opt
                    }
                fn = opt.get('fn')
                if not isinstance(fn, str):
                    raise ValueError(f'Invalid on locator operation , it should be literal string or dict : {opt}')
                for func in [
                    loc.get_by_text,
                    loc.get_by_alt_text,
                    loc.get_by_role,
                ]:
                    if func.__name__ == fn:
                        loc2 = func(*opt.get('args', []), **opt.get('kwargs', dict()))
                        logger.debug('on locator : \n    call {}\n    from {}\n    to {}', opt, loc, loc2)
                        loc = loc2

            except BaseException as err:
                raise ValueError(f'Invalid on locator operation : {opt}') from err
        return loc

    async def page_any_frame(*, func, timeout: Optional[float], err_msg: str, suc_msg_template: str):
        _page = await get_page()
        start_at = datetime.utcnow().timestamp() * 1000.0
        last_timeout_err = None
        out_loop = True
        logger.debug('_page.frames before loop : {}', _page.frames)
        while out_loop:
            if start_at + timeout < datetime.utcnow().timestamp() * 1000.0:
                break
            for frame in _page.frames:
                loop_timeout = 100.0 if timeout is None else max(100.0, timeout / 20.0)
                try:
                    res = await func(frame=frame, loop_timeout=loop_timeout)
                    logger.debug(suc_msg_template, frame, res)
                    return res
                except BaseException as err:
                    from libiancrawlers.util.exceptions import is_timeout_error
                    if is_timeout_error(err):
                        last_timeout_err = err
                        continue
                    if 'Frame was detached' in str(err):
                        continue
                    else:
                        raise
        logger.debug('_page.frames after loop : {}', _page.frames)
        if last_timeout_err is None:
            raise TimeoutError(err_msg)
        else:
            raise TimeoutError(err_msg) from last_timeout_err

    async def page_wait_for_selector_in_any_frame(selector: str, *, timeout: Optional[float], **kwargs):
        from playwright.async_api import Frame

        async def fn(*, frame: Frame, loop_timeout: float):
            return await frame.wait_for_selector(selector, timeout=loop_timeout, **kwargs)

        return await page_any_frame(func=fn,
                                    timeout=timeout,
                                    err_msg=f'not found selector {selector} in any frame',
                                    suc_msg_template=f'success found selector {selector} in frame {{}} , result is {{}}')

    async def page_scroll_down(*,
                               delta_y=233.0,
                               interval=0.5,
                               max_height: Optional[float] = 20000,
                               retry_scroll_up_limit: int = 2,
                               retry_scroll_down_limit: int = 2,
                               page_click_if_found: JSON = None,
                               ):
        _page = await get_page()
        logger.debug('start page scroll down , current page title is {}', await _page.title())

        def random_interval():
            return interval * (random.randint(7, 13) / 10.0)

        def random_delta_y():
            return delta_y * (random.randint(3, 16) / 10.0)

        prev_height = None
        prev_height_bottom = {
            'value': -1
        }
        retry_scroll_down = 0
        retry_scroll_up = 0

        viewport_size = _page.viewport_size
        if viewport_size is not None:
            logger.debug('viewport size is {}', viewport_size)

        curr_height_min = 999999999

        _dump_count = 0
        _elements_wait_to_click: List[Tuple[str, XY]] = []
        while True:
            await _page.mouse.wheel(delta_x=0, delta_y=random_delta_y())
            curr_height = await _page.evaluate('(window.innerHeight + window.scrollY)')
            curr_height_min = min(curr_height_min, curr_height)

            logger.debug('scrolling... curr_height is {}', curr_height)

            if page_click_if_found is not None:
                if viewport_size is not None:
                    _element_list_locator = _page.locator(page_click_if_found.get('locator'))
                    _element_idx = 0
                    _elements_count = await _element_list_locator.count()
                    _elements = dict()
                    while True:
                        try:
                            if _element_idx >= _elements_count:
                                break
                            _element_locator = _element_list_locator.nth(_element_idx)
                            if not await _element_locator.is_visible():
                                continue
                            _box = await _element_locator.bounding_box()
                            if _box is None:
                                continue
                            _element_inner_text: str = await _element_locator.inner_text()
                            while True:
                                _old = _element_inner_text
                                _element_inner_text = _element_inner_text.replace(' ', '')
                                _element_inner_text = _element_inner_text.replace('\n', '')
                                _element_inner_text = _element_inner_text.replace('\t', '')
                                if _old == _element_inner_text:
                                    break
                            _element_hash = hashlib.md5(
                                f'{await _element_locator.inner_html()}'.encode('utf-8')).hexdigest()
                            if len(_element_inner_text) > 30:
                                _element_inner_text = _element_inner_text[0:30]
                            if _element_inner_text in list(_elements.keys()):
                                logger.debug('exist _element_inner_text')
                                continue
                            if _box['width'] < 5 or _box['height'] < 5:
                                logger.warning(
                                    'why element box too small (and visible) , i will not click : _box={} , inner_html={}',
                                    _box, await _element_locator.inner_html())
                                continue
                            _xy: XY = {
                                'x': _box['x'] + _box['width'] / 2,
                                'y': _box['y'] + _box['height'] / 2,
                            }
                            logger.debug('found element  , hash is {} , inner text is {}',
                                         _element_hash, _element_inner_text)
                            _elements[f'{_element_inner_text}_{_element_hash}'] = _xy
                        finally:
                            _element_idx += 1

                    if _elements.keys().__len__() > 0:
                        logger.debug('found elements duplicated by inner text :  ' +
                                     '\n    _elements_count is {}' +
                                     '\n    len(_elements)  is {}' +
                                     '\n    _elements       is {}', _elements_count, len(_elements), _elements)
                    _elements_items = list(_elements.items())
                    _elements_wait_to_click_wait_to_add: List[Tuple[str, XY]] = []
                    while True:
                        if _elements_wait_to_click.__len__() > 0:
                            _element_info = _elements_wait_to_click.pop()
                        elif _elements_items.__len__() > 0:
                            _element_info = _elements_items.pop()
                        else:
                            break
                        try:
                            _element_key, _xy = _element_info
                            if _xy['x'] > viewport_size['width'] or _xy['y'] > curr_height:
                                logger.debug(
                                    'skip element outer of box , _xy = {} , curr_height = {} , viewport_size = {} , _element_inner_text is {}',
                                    _xy, curr_height, viewport_size, _element_key)
                                _elements_wait_to_click_wait_to_add.append(_element_info)
                                continue
                            on_found_after_click_steps = page_click_if_found.get('on_found_after_click_steps')
                            if on_found_after_click_steps is not None:
                                logger.debug('start click and dump page element : _element_info={} , _xy={}',
                                             _element_info, _xy)
                                await page_click({
                                    'x': _xy['x'],
                                    'y': _xy['y'] - max(0, curr_height - curr_height_min),
                                })
                                await sleep(1)
                                _dump_count += 1
                                await dump_page(
                                    f'scroll_click_dump_pre_{_dump_count}_{int(_xy["x"])}_{int(_xy["y"])}_{_element_key}')
                                await _process_steps(on_found_after_click_steps)
                                await sleep(1)
                                await dump_page(
                                    f'scroll_click_dump_aft_{_dump_count}_{int(_xy["x"])}_{int(_xy["y"])}_{_element_key}')
                                await sleep(1)
                                on_found_after_click_and_dump_steps = page_click_if_found.get(
                                    'on_found_after_click_and_dump_steps')
                                if on_found_after_click_and_dump_steps is not None:
                                    await _process_steps(on_found_after_click_and_dump_steps)
                                    await sleep(1)
                        except BaseException as err:
                            raise Exception(
                                f'Failed operate , _dump_count = {_dump_count} , _element_info = {_element_info}') from err

                    _elements_wait_to_click.extend(_elements_wait_to_click_wait_to_add)

            if not prev_height:
                prev_height = curr_height
                await sleep(random_interval())
                continue
            if max_height is not None and prev_height > max_height:
                logger.debug(
                    'on prev_height > max_height, \n    prev_height = {}\n    curr_height = {}\n    max_height = {}\n    curr_height_min = {}',
                    prev_height, curr_height, max_height, curr_height_min)
                logger.debug('break scroll down because prev_height({}) > max_height({})', prev_height, max_height)
                break
            if prev_height == curr_height:
                logger.debug(
                    'on prev_height == curr_height, \n    prev_height = {}\n    curr_height = {}\n    max_height = {}',
                    prev_height, curr_height, max_height)

                if retry_scroll_down < retry_scroll_down_limit:
                    retry_scroll_down += 1
                    logger.debug('retry_scroll_down {}', retry_scroll_down)
                    await sleep(random_interval())
                    continue

                retry_scroll_down = 0

                async def scroll_up():
                    await page_random_mouse_move()
                    prev_height_bottom['value'] = prev_height
                    for i in range(0, 4):
                        await _page.mouse.wheel(delta_x=0, delta_y=-random_delta_y())
                        await sleep(random_interval())
                    logger.debug('after test scroll up if on bottom')
                    await sleep(0.1)
                    try:
                        await _page.wait_for_load_state('networkidle', timeout=3)
                    except:
                        pass

                logger.debug('on prev_height == curr_height , prev_height_bottom is {} , prev_height is {}',
                             prev_height_bottom['value'], prev_height)
                if prev_height_bottom['value'] < prev_height:
                    # 发现了新加载的内容
                    await scroll_up()
                    retry_scroll_up = 0
                else:
                    # 没有发现新加载的内容
                    retry_scroll_up += 1
                    if retry_scroll_up >= retry_scroll_up_limit:
                        logger.debug('retry_scroll_up {} break', retry_scroll_up)
                        break
                    else:
                        logger.debug('retry_scroll_up {}', retry_scroll_up)
                        await scroll_up()
                continue

            prev_height = curr_height
            await sleep(random_interval())

    async def page_click(selector: Union[str, Locator, XY],
                         *,
                         method: Literal['click', 'tap'] = None,
                         on_new_page: Optional[
                             Union[
                                 Literal[
                                     'switch_it_and_run_steps_no_matter_which_page',
                                     'ignore'
                                 ],
                                 JSON,
                                 List[JSON],
                             ]
                         ] = None,
                         wait_any_page_create_time_limit: Optional[float] = None,
                         **kwargs):
        if method is None:
            method = 'click'
        if on_new_page is None:
            on_new_page = 'switch_it_and_run_steps_no_matter_which_page'
        if wait_any_page_create_time_limit is None or wait_any_page_create_time_limit < 0:
            wait_any_page_create_time_limit = 3000

        pages_size_old = browser_context.pages.__len__()
        logger.debug('on page {} : selector={} , kwargs={}', method, selector, kwargs)
        if kwargs.get('timeout') is None:
            timeout = 5000
        else:
            timeout = kwargs.pop('timeout')
        has_text = None
        has_not_text = None
        if kwargs.get('has_text') is not None:
            has_text = kwargs.pop('has_text')
        if kwargs.get('has_not_text') is not None:
            has_not_text = kwargs.pop('has_not_text')
        _page = await get_page()

        async def _debug_window_state(msg: str):
            logger.debug('{} , window state is :' +
                         '\n    window.history.length is {}' +
                         '\n    window.history.scrollRestoration is {}' +
                         '\n    window.location is {}' +
                         '\n ',
                         msg,
                         await _page.evaluate('window.history.length'),
                         await _page.evaluate('window.history.scrollRestoration'),
                         await _page.evaluate('window.location'),
                         )

        await _debug_window_state(f'before page {method}')

        if isinstance(selector, dict) and 'x' in selector and 'y' in selector:
            await _page.mouse.click(selector.get('x'), selector.get('y'), **kwargs)
        else:
            if isinstance(selector, str):
                _loc = _page.locator(
                    selector=selector,
                    has_text=has_text,
                    has_not_text=has_not_text
                )
            else:
                _loc = selector

            if kwargs.get('on_locator') is not None:
                _loc = await on_locator(_loc, kwargs.pop('on_locator'))

            if method == 'click':
                await _loc.click(
                    timeout=timeout,
                    **kwargs
                )
            elif method == 'tap':
                await _loc.tap(
                    timeout=timeout,
                    **kwargs
                )
            else:
                raise ValueError(f'Invalid method {method}')

        await _debug_window_state(f'after page {method}')

        if on_new_page != 'ignore':
            wait_any_page_create_at = datetime.now().timestamp()
            while datetime.now().timestamp() - wait_any_page_create_at < wait_any_page_create_time_limit / 1000.0:
                if pages_size_old != browser_context.pages.__len__():
                    logger.debug('Some page created , page list is {}', browser_context.pages)
                    if on_new_page == 'switch_it_and_run_steps_no_matter_which_page':
                        logger.debug('switch to new page , run steps no matter which page')
                        await switch_page(-1)
                    else:
                        old_page = await get_page()
                        try:
                            logger.debug('switch to new page , but i will back')
                            await switch_page(-1)
                            logger.debug('run steps on new page')
                            await _process_steps(on_new_page)
                        finally:
                            logger.debug('switch back to old page {}', old_page)
                            await switch_page(old_page)
                        pass
                    break
                else:
                    logger.debug('not found new page created after click')
                    await sleep(0.5)

    async def dump_page(dump_tag: str):
        return await _dump_page(dump_tag, await get_page())

    async def dump_page_for_each(*,
                                 dump_tag_prefix: str,
                                 before_dump_steps: Optional[List[JSON]],
                                 after_dump_steps: Optional[List[JSON]],
                                 before_dump_break_by_timeout: bool = False,
                                 after_dump_break_by_timeout: bool = False,
                                 ):
        logger.debug('Start dump_page_for_each')
        count = 1
        while True:
            dump_tag = f'{dump_tag_prefix}_{count}'
            logger.debug('[dump_tag = {}] before before_dump_steps', dump_tag)
            if before_dump_steps is not None:
                try:
                    await _process_steps(before_dump_steps)
                except BaseException as err:
                    from libiancrawlers.util.exceptions import is_timeout_error
                    if is_timeout_error(err) and before_dump_break_by_timeout:
                        logger.info('[dump_tag = {}] before_dump_break by timeout : {}', dump_tag, err)
                        break
                    else:
                        raise
            logger.debug('[dump_tag = {}] after before_dump_steps', dump_tag)
            logger.debug('[dump_tag = {}] before dump_page', dump_tag)
            await dump_page(dump_tag=dump_tag)
            logger.debug('[dump_tag = {}] after dump_page', dump_tag)
            logger.debug('[dump_tag = {}] before after_dump_steps', dump_tag)
            if after_dump_steps is not None:
                try:
                    await _process_steps(after_dump_steps)
                except BaseException as err:
                    from libiancrawlers.util.exceptions import is_timeout_error
                    if is_timeout_error(err) and after_dump_break_by_timeout:
                        logger.info('[dump_tag = {}] after_dump_break by timeout : {}', dump_tag, err)
                        break
                    else:
                        raise
            logger.debug('[dump_tag = {}] after after_dump_steps', dump_tag)
            count += 1

    async def page_bring_to_front(*, page: Optional[Page] = None,
                                  timeout: Optional[float] = None,
                                  retry_limit: Optional[int] = None):
        if timeout is None:
            timeout = 3000
        if retry_limit is None:
            retry_limit = 5
        if page is None:
            page = await get_page()

        retry = 0
        while True:
            try:
                logger.debug('start bring page to front')
                future = page.bring_to_front()
                return await asyncio.wait_for(future, timeout=timeout / 1000.0)
            except BaseException as err:
                from libiancrawlers.util.exceptions import is_timeout_error
                if is_timeout_error(err):
                    retry += 1
                    if retry > retry_limit:
                        logger.warning('bring to front failed')
                        raise
                    logger.debug('bring to front timeout , retry {} ...', retry)
                    continue
                raise

    async def page_wait_for_function(*args, **kwargs):
        return await (await get_page()).wait_for_function(*args, **kwargs)

    async def page_type(*args, **kwargs):
        return await (await get_page()).type(*args, **kwargs)

    async def page_wait_for_selector(*args, **kwargs):
        return await (await get_page()).wait_for_selector(*args, **kwargs)

    async def api_sleep(total: float):
        if total < 10:
            logger.warning('Do you known sleep() unit is millisecond ? (you bypass {})', total)
        await sleep(total / 1000.0)

    fn_map = {
        'sleep': api_sleep,
        'logd': logd,
        'logi': logi,
        'logw': logw,
        'loge': loge,
        'dump_page': dump_page,
        'dump_page_for_each': dump_page_for_each,
        'gui_confirm': gui_confirm,
        'switch_page': switch_page,
        'page_random_mouse_move': page_random_mouse_move,
        'page_wait_loaded': page_wait_loaded,
        'page_bring_to_front': page_bring_to_front,
        'page_wait_for_function': page_wait_for_function,
        'page_mouse_move': page_mouse_move,
        'page_type': page_type,
        'page_click': page_click,
        'page_wait_for_selector': page_wait_for_selector,
        'page_wait_for_selector_in_any_frame': page_wait_for_selector_in_any_frame,
        'page_scroll_down': page_scroll_down,
        'page_go_back': page_go_back,
    }

    return fn_map


if __name__ == '__main__':
    pass
