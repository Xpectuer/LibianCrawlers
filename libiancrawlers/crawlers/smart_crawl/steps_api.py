# -*- coding: UTF-8 -*-
import asyncio
import hashlib
import random
from datetime import datetime, timedelta
from typing import Optional, Literal, TypedDict, Callable, Awaitable, Union, List, Tuple, Dict
from uuid import uuid4
from loguru import logger
from playwright.async_api import Page, BrowserContext, Locator

from libiancrawlers.app_util.types import JSON
from libiancrawlers.util.coroutines import sleep
from libiancrawlers.util.exceptions import is_timeout_error
from libiancrawlers.util.timefmt import days_ranges_iter, YMDParam

StepsBlock = Union[
    JSON,
    List[JSON],
]

OnLocatorBlock = JSON

PageScrollDownPageClickIfFound = JSON


class SmartCrawlSignal(BaseException):
    pass


class SmartCrawlStopSignal(SmartCrawlSignal):
    pass


XY = TypedDict('XY', {'x': float, 'y': float})

PageRef = TypedDict('PageRef', {'value': Page, })

PageScrollDownElementToClickContext = TypedDict('PageScrollDownElementToClickContext',
                                                {'x': float, 'y': float, 'width': float, 'height': float,
                                                 'locator': Locator})


# noinspection PyMethodMayBeStatic
class StepsApi:
    def __init__(self, *,
                 b_page: Page,
                 browser_context: BrowserContext,
                 _dump_page: Callable[[str, Page], Awaitable],
                 _process_steps: Callable[
                     [StepsBlock],
                     Awaitable,
                 ],
                 _page_ref_lock: asyncio.locks.Lock,
                 _page_ref: PageRef):
        self._b_page = b_page
        self._browser_context = browser_context
        self._var_dump_page = _dump_page
        self._var_process_steps = _process_steps
        self._page_ref_lock = _page_ref_lock
        self._page_ref = _page_ref
        self._page_mouse_move_default_timeout = 2.0
        self._page_mouse_move_default_steps = 2
        self._page_click_default_timeout = 5000
        self._page_type_default_timeout = 5000
        self._page_type_default_delay = 300
        self._page_go_back_default_timeout = 5000

    def __getitem__(self, item):
        if isinstance(item, str) and not item.startswith('_'):
            return getattr(self, item)
        else:
            raise ValueError(f'Not found item {item}')

    # ------------------------------------------------------------------
    # Private Util

    async def _process_steps(self, _steps):
        return await self._var_process_steps(_steps)

    async def _get_page(self):
        import inspect

        async with self._page_ref_lock:
            res = self._page_ref['value']

        _frame, _filename, _line_number, _function_name, _lines, _index = inspect.stack()[1]
        logger.debug('current page title is {} , call from {} , link is \n    {}',
                     await res.title(),
                     _function_name,
                     res.url)
        return res

    async def _set_page(self, v: Page):
        async with self._page_ref_lock:
            self._page_ref['value'] = v
        logger.debug('set page to {}', v)

    async def _get_window_inner_box(self):
        _page = await self._get_page()
        return {
            'width': int(await _page.evaluate('window.innerWidth')),
            'height': int(await _page.evaluate('window.innerHeight')),
        }

    async def _page_mouse_move(self, x, y, **kwargs):
        logger.debug('mouse move {}', kwargs)
        if kwargs.get('timeout') is None:
            timeout = self._page_mouse_move_default_timeout
        else:
            timeout = kwargs.pop('timeout')

        if kwargs.get('steps') is None:
            steps = self._page_mouse_move_default_steps
        else:
            steps = kwargs.pop('steps')

        _page = await self._get_page()
        await asyncio.wait_for(_page.mouse.move(x, y, steps=steps), timeout=timeout)

    async def _get_bounding_box(self, loc: Locator, *, timeout=750):
        count = 0
        while True:
            try:
                return await loc.bounding_box(timeout=250)
            except BaseException as err:
                if not is_timeout_error(err):
                    raise
                if count > (timeout / 250):
                    return None
                count += 1
                continue

    async def _on_locator(self, loc: Locator, opts: OnLocatorBlock) -> Locator:
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
                    raise ValueError(
                        f'Invalid fn type in OnLocatorBlock , fn should be literal string ,\n but fn is {fn} ,\n opt is {opt} ,\n opts is {opts}')

                for func in [
                    loc.get_by_text,
                    loc.get_by_alt_text,
                    loc.get_by_role,
                ]:
                    if func.__name__ == fn:
                        loc2 = func(*opt.get('args', []), **opt.get('kwargs', dict()))
                        logger.debug('on locator : \n    call {}\n    from {}\n    to {}', opt, loc, loc2)
                        loc = loc2
                        break
                else:
                    logger.warning('Unknown fn {} in OnLocatorBlock , Skipped . opts is {}', fn, opts)

            except BaseException as err:
                raise ValueError(f'Invalid on locator operation : {opt}') from err
        return loc

    async def _page_any_frame(self, *, func, timeout: Optional[float], err_msg: str, suc_msg_template: str):
        _page = await self._get_page()
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
                    return frame, res
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

    async def _page_bring_to_front(self, *, page: Optional[Page] = None,
                                   timeout: Optional[float] = None,
                                   retry_limit: Optional[int] = None):
        if timeout is None:
            timeout = 3000
        if retry_limit is None:
            retry_limit = 5
        if page is None:
            page = await self._get_page()

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

    async def _dump_page(self, dump_tag: str):
        return await self._var_dump_page(dump_tag, await self._get_page())

    # ------------------------------------------------------------------
    # Public API

    async def sleep(self, total: float):
        if total < 10:
            logger.warning('Do you known sleep() unit is millisecond ? (you bypass {})', total)
        await sleep(total / 1000.0)

    async def logd(self, *args, **kwargs):
        logger.debug(*args, **kwargs)

    async def logi(self, *args, **kwargs):
        logger.info(*args, **kwargs)

    async def logw(self, *args, **kwargs):
        logger.warning(*args, **kwargs)

    async def loge(self, *args, **kwargs):
        logger.error(*args, **kwargs)

    async def page_random_mouse_move(self):
        _page = await self._get_page()
        box = await self._get_bounding_box(_page.locator('body'), timeout=1500)
        window_box = await self._get_window_inner_box()
        if box is None:
            logger.warning("Can't get body bounding box")
            box = {
                'x': 0,
                'y': 0,
                'width': window_box['width'],
                'height': window_box['height']
            }
        logger.debug('on mouse random move , box is {} , window_box is {}', box, window_box)
        try:
            await self._page_mouse_move(
                random.randint(
                    min(max(100, int(box['x'])), window_box['width'] - 100),
                    min(max(100, int(box['x'] + box['width'])), window_box['width'] - 100)
                ),
                random.randint(
                    min(max(100, int(box['y'])), window_box['height'] - 100),
                    min(max(100, int(box['y'] + box['height'])), window_box['height'] - 100)
                )
            )
        except BaseException as err:
            from libiancrawlers.util.exceptions import is_timeout_error
            if is_timeout_error(err):
                logger.debug('ignore timeout error on random mouse move')
            else:
                raise

    async def page_wait_loaded(self, *, page: Page = None):
        if page is None:
            page = (await self._get_page())
        from libiancrawlers.util.exceptions import is_timeout_error
        logger.debug('start bring to front at first')
        await self._page_bring_to_front(page=page)
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
        await self._page_bring_to_front(page=page)

    async def page_wait_for_selector_in_any_frame(self, selector: str, *, timeout: Optional[float], **kwargs):
        from playwright.async_api import Frame

        async def fn(*, frame: Frame, loop_timeout: float):
            return await frame.wait_for_selector(selector, timeout=loop_timeout, **kwargs)

        return await self._page_any_frame(func=fn,
                                          timeout=timeout,
                                          err_msg=f'not found selector {selector} in any frame',
                                          suc_msg_template=f'success found selector {selector} in frame {{}} , result is {{}}')

    async def page_wait_for_function(self, *args, **kwargs):
        return await (await self._get_page()).wait_for_function(*args, **kwargs)

    async def page_click(self,
                         selector: Union[str, Locator, XY],
                         *,
                         method: Literal['click', 'tap'] = None,
                         on_new_page: Optional[
                             Union[
                                 Literal[
                                     'switch_it_and_run_steps_no_matter_which_page',
                                     'ignore'
                                 ],
                                 StepsBlock
                             ]
                         ] = None,
                         detail_logd: bool = False,
                         wait_any_page_create_time_limit: Optional[float] = None,
                         only_main_frame: bool = True,
                         each_steps_before: Optional[StepsBlock] = None,
                         each_steps_after: Optional[StepsBlock] = None,
                         **kwargs):
        if method is None:
            method = 'click'
        if on_new_page is None:
            on_new_page = 'switch_it_and_run_steps_no_matter_which_page'
        if wait_any_page_create_time_limit is None or wait_any_page_create_time_limit < 0:
            wait_any_page_create_time_limit = 3000

        pages_size_old = self._browser_context.pages.__len__()
        logger.debug('on page {} : selector={} , kwargs={}', method, selector, kwargs)
        if kwargs.get('timeout') is None:
            timeout = self._page_click_default_timeout
        else:
            timeout = kwargs.pop('timeout')
        has_text = None
        has_not_text = None
        if kwargs.get('has_text') is not None:
            has_text = kwargs.pop('has_text')
        if kwargs.get('has_not_text') is not None:
            has_not_text = kwargs.pop('has_not_text')
        _page = await self._get_page()

        async def _debug_window_state(msg: str):
            if detail_logd:
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
                if only_main_frame:
                    _loc = _page.locator(
                        selector=selector,
                        has_text=has_text,
                        has_not_text=has_not_text
                    )
                else:
                    frame, _ = await self.page_wait_for_selector_in_any_frame(selector=selector, timeout=timeout)
                    _loc = frame.locator(
                        selector=selector,
                        has_text=has_text,
                        has_not_text=has_not_text,
                    )
            else:
                _loc = selector

            if kwargs.get('on_locator') is not None:
                _loc = await self._on_locator(_loc, kwargs.pop('on_locator'))

            async def _click(_locator: Locator):
                if method == 'click':
                    await _locator.click(
                        timeout=timeout,
                        **kwargs
                    )
                elif method == 'tap':
                    await _locator.tap(
                        timeout=timeout,
                        **kwargs
                    )
                else:
                    raise ValueError(f'Invalid method {method}')

            if each_steps_before is not None or each_steps_after is not None:
                _loc_all = await _loc.all()
                if _loc_all.__len__() <= 0:
                    raise TimeoutError(f'Not found matched , selector is {selector}')
                for _loc_item in _loc_all:
                    if each_steps_before is not None:
                        await self._process_steps(each_steps_before)
                    await _click(_loc_item)
                    if each_steps_after is not None:
                        await self._process_steps(each_steps_after)
            else:
                await _click(_loc)

        await _debug_window_state(f'after page {method}')

        if on_new_page != 'ignore':
            wait_any_page_create_at = datetime.now().timestamp()
            while datetime.now().timestamp() - wait_any_page_create_at < wait_any_page_create_time_limit / 1000.0:
                if pages_size_old != self._browser_context.pages.__len__():
                    logger.debug('Some page created , page list is {}', self._browser_context.pages)
                    if on_new_page == 'switch_it_and_run_steps_no_matter_which_page':
                        logger.debug('switch to new page , run steps no matter which page')
                        await self.switch_page(-1)
                    else:
                        old_page = await self._get_page()
                        try:
                            logger.debug('switch to new page , but i will back')
                            await self.switch_page(-1)
                            logger.debug('run steps on new page')
                            await self._process_steps(on_new_page)
                        finally:
                            logger.debug('switch back to old page {}', old_page)
                            await self.switch_page(old_page)
                        pass
                    break
                else:
                    logger.debug('not found new page created after click')
                    await sleep(0.5)

    async def page_click_and_expect_element_destroy(self, selector: Union[str, Locator, XY], *,
                                                    on_exist_steps: StepsBlock = None,
                                                    retry_limit=5):
        retry_count = 0
        err = None
        while True:
            try:
                await self.page_click(selector, timeout=1000)
            except BaseException as err1:
                err = err1
                if not is_timeout_error(err):
                    raise err1
                logger.debug('page click failed , maybe element already destroy')
            # 有时确实按下了按钮，但是也会 timeout error
            try:
                await sleep(0.5)
                await self.page_wait_for_selector_in_any_frame(selector, timeout=500)
                if retry_count < retry_limit:
                    retry_count += 1
                    continue
                else:
                    if on_exist_steps is not None:
                        await self._process_steps(on_exist_steps)
                        break
                    else:
                        raise Exception(f'Expect selector {selector} destroy after page click , but not')
            except BaseException as err2:
                if not is_timeout_error(err2):
                    if err is not None:
                        raise err2 from err
                    else:
                        raise err2
                # 只有找不到这个元素时才认为关闭成功了
                logger.debug('Select {} not found , click success', selector)
                break

    async def page_type(self, *args, **kwargs):
        delay = kwargs.pop('delay', self._page_type_default_delay)
        timeout = kwargs.pop('timeout', self._page_type_default_timeout)
        use_fill = kwargs.pop('use_fill', False)
        force = kwargs.pop('force', False)
        selector = args[0]
        only_main_frame = kwargs.pop('only_main_frame', True)
        if only_main_frame:
            page = await self._get_page()
            if use_fill:
                await page.fill(*args, timeout=timeout, strict=kwargs.get('strict'), force=force)
            else:
                await page.focus(selector=selector, timeout=timeout, strict=kwargs.get('strict'))
                await page.type(*args, delay=delay, timeout=timeout, **kwargs)
        else:
            logger.debug('wait for selector in any frame to type , selector is {}', selector)
            frame, _ = await self.page_wait_for_selector_in_any_frame(selector=selector,
                                                                      timeout=timeout,
                                                                      strict=kwargs.get('strict'),
                                                                      state=kwargs.get('state'))
            logger.debug('existed selector in any frame to type , try type to frame {} , args is {}',
                         frame, args)
            if use_fill:
                await frame.fill(*args, timeout=timeout, strict=kwargs.get('strict'))
            else:
                await frame.focus(selector=selector, timeout=timeout, strict=kwargs.get('strict'))
                await frame.type(*args, delay=delay, timeout=timeout, **kwargs)
            logger.debug('Success type to frame')

    async def page_type_days_ranges_iter(self, *,
                                         start: Union[Literal['now'], YMDParam, str],
                                         offset_day: Union[int, str],
                                         stop_until: Union[int, YMDParam],
                                         yield_stop_until_value_if_end_value_not_equal: bool = True,
                                         end_offset: int = 0,
                                         time_format: str = '%Y-%m-%d',
                                         delay: Optional[float] = None,
                                         timeout: Optional[float] = None,
                                         strict: Optional[bool] = True,
                                         only_main_frame: Optional[bool] = None,
                                         use_fill: Optional[bool] = None,
                                         force: Optional[bool] = None,
                                         begin_selector: Optional[Union[str, Locator, XY]] = None,
                                         end_selector: Optional[Union[str, Locator, XY]] = None,
                                         steps_before_begin: StepsBlock = None,
                                         steps_after_begin: StepsBlock = None,
                                         steps_before_end: StepsBlock = None,
                                         steps_after_end: StepsBlock = None,
                                         steps_after_type_all: StepsBlock = None,
                                         ):
        if not isinstance(offset_day, int):
            offset_day = int(offset_day)
        is_first_input = True
        for begin_tuple, end_tuple in days_ranges_iter(
                start=start,
                stop_until=stop_until,
                offset_day=offset_day,
                yield_stop_until_value_if_end_value_not_equal=yield_stop_until_value_if_end_value_not_equal,
                end_offset=end_offset,
        ):
            logger.debug('iter time range : {} to {}', begin_tuple, end_tuple)
            begin_year, begin_month, begin_day = begin_tuple
            end_year, end_month, end_day = end_tuple
            page_type_kwargs = dict()
            if delay is not None:
                page_type_kwargs['delay'] = delay
            if timeout is not None:
                page_type_kwargs['timeout'] = timeout
            if strict is not None:
                page_type_kwargs['strict'] = strict
            if only_main_frame is not None:
                page_type_kwargs['only_main_frame'] = only_main_frame
            if use_fill is not None:
                page_type_kwargs['use_fill'] = use_fill
            if force is not None:
                page_type_kwargs['force'] = force

            async def type_begin():
                if begin_selector is not None:
                    begin_time = datetime.now().replace(year=begin_year, month=begin_month, day=begin_day)
                    if steps_before_begin is not None:
                        logger.debug('run steps_before_begin')
                        await self._process_steps(steps_before_begin)
                    logger.debug('Start page type begin')
                    await self.page_type(
                        begin_selector,
                        begin_time.strftime(time_format),
                        **page_type_kwargs
                    )
                    logger.debug('Stop page type begin')
                    if steps_after_begin is not None:
                        logger.debug('run steps_after_begin')
                        await self._process_steps(steps_after_begin)

            async def type_end():
                if end_selector is not None:
                    end_time = datetime.now().replace(year=end_year, month=end_month, day=end_day)
                    if steps_before_end is not None:
                        logger.debug('run steps_before_end')
                        await self._process_steps(steps_before_end)
                    logger.debug('Start page type end')
                    await self.page_type(
                        end_selector,
                        end_time.strftime(time_format),
                        **page_type_kwargs
                    )
                    logger.debug('Stop page type end')
                    if steps_after_end is not None:
                        logger.debug('run steps_after_end')
                        await self._process_steps(steps_after_end)

            # 有些时间选择器组件会阻止无效输入，例如在设置老于begin的end时会无效
            if is_first_input or offset_day < 0:
                await type_begin()
                await type_end()
            else:
                await type_end()
                await type_begin()
            is_first_input = False
            if steps_after_type_all is not None:
                logger.debug('run steps_after_type_all')
                await self._process_steps(steps_after_type_all)

    async def page_scroll_down(self, *,
                               delta_y=233.0,
                               interval=0.5,
                               max_height: Optional[float] = 20000,
                               retry_scroll_up_limit: int = 2,
                               retry_scroll_down_limit: int = 2,
                               page_click_if_found: PageScrollDownPageClickIfFound = None,
                               ):
        _page = await self._get_page()
        logger.debug('start page scroll down , current page title is {}', await _page.title())

        _last_scroll_down_time = {
            'value': datetime.now().timestamp()
        }

        def random_interval():
            _until = _last_scroll_down_time['value'] + interval * (random.randint(7, 13) / 10.0)
            _last_scroll_down_time['value'] = _until
            return max(0.1, _until - datetime.now().timestamp())

        def random_delta_y():
            return delta_y * (random.randint(3, 16) / 10.0)

        prev_height = None
        prev_height_bottom = {
            'value': -1
        }
        retry_scroll_down = 0
        retry_scroll_up = 0

        window_box = await self._get_window_inner_box()
        if window_box is not None:
            logger.debug('window_box is {}', window_box)
        else:
            logger.warning('page.window_box is None , why scroll page ?')

        curr_height_min = 999999999

        _dump_count = 0
        _elements_wait_to_click: List[Tuple[str, PageScrollDownElementToClickContext]] = []
        _elements_existed_keys = set()

        def _sort_and_check_elements_wait_to_click(arr: List[Tuple[str, PageScrollDownElementToClickContext]], *,
                                                   _detail_logd: bool):
            while len(arr) > 0:
                def _get_element_sort_key(el: Tuple[str, PageScrollDownElementToClickContext]):
                    k = 100000 * int(el[1]['y'] + el[1]['height'] / 2) + int(el[1]['x'])
                    # logger.debug('element sort key is {} , element info is {}', k, el)
                    return k

                arr.sort(key=_get_element_sort_key)
                logger.debug('count _elements_wait_to_click is {} ; min y element key is {}',
                             len(arr), arr[0][0])
                _min_y_element_ctx = arr[0][1]
                if _min_y_element_ctx['y'] + _min_y_element_ctx['height'] / 2 < 0:
                    if _detail_logd:
                        logger.warning(
                            'element skipped , height over :\n    curr_height={}\n    window_box is {}\n    element is {}',
                            curr_height, window_box, arr[0])
                    arr.pop(0)
                    continue
                break
            return arr

        _already_tip_VirtualListView = {
            'value': False
        }

        async def _update_ctx_box(_ctx: PageScrollDownElementToClickContext):
            __box = await self._get_bounding_box(_ctx['locator'])
            if __box is None:
                return False
            _old_ctx = {
                'x': _ctx['x'],
                'y': _ctx['y'],
                'width': _ctx['width'],
                'height': _ctx['height']
            }
            _ctx['x'] = __box['x']
            _ctx['y'] = __box['y']
            _ctx['width'] = __box['width']
            _ctx['height'] = __box['height']
            if abs(_old_ctx['x'] - _ctx['x']) > 10 or abs(_old_ctx['y'] - _ctx['y']) > 10 or abs(
                    _old_ctx['width'] - _ctx['width']) > 10 or abs(_old_ctx['height'] - _ctx['height']) > 10:
                if not _already_tip_VirtualListView['value']:
                    logger.info(
                        '_ctx changed , maybe it was a VirtualListView ...\n    old ctx is {}\n    cur ctx is {}',
                        _old_ctx, _ctx)
                    _already_tip_VirtualListView['value'] = True
            return True

        _first_page_click_if_found_need_run = page_click_if_found is not None

        while True:
            curr_height = await _page.evaluate('(window.innerHeight + window.scrollY)')
            curr_height_min = min(curr_height_min, curr_height)
            if _first_page_click_if_found_need_run:
                _first_page_click_if_found_need_run = False
                logger.debug('curr_height is {}', curr_height)
            else:
                await _page.mouse.wheel(delta_x=0, delta_y=random_delta_y())
                logger.debug('scrolling... curr_height is {}', curr_height)

            if page_click_if_found is not None:
                __locator = page_click_if_found['locator']
                not_clickable_top_margin = page_click_if_found.get('not_clickable_top_margin', 100)
                check_selector_exist_after_click = page_click_if_found.get('check_selector_exist_after_click')
                duplicated_only_text = page_click_if_found.get('duplicated_only_text', False)
                on_before_click_check_steps = page_click_if_found.get('on_before_click_check_steps')
                on_found_after_click_steps = page_click_if_found.get('on_found_after_click_steps')
                detail_logd = page_click_if_found.get('detail_logd', False)
                on_found_after_click_and_dump_steps = page_click_if_found.get('on_found_after_click_and_dump_steps')
                on_before_click_steps = page_click_if_found.get('on_before_click_steps')

                async def _get_key_txt_ctx_from_element_locator(*,
                                                                _element_idx: Union[int, Literal['on update']],
                                                                _element_locator: Locator):
                    if not await _element_locator.is_visible():
                        if detail_logd:
                            logger.debug('skip nth {} because it not visible', _element_idx)
                        return 'continue'
                    _box = await self._get_bounding_box(_element_locator)
                    if _box is None:
                        if detail_logd:
                            logger.debug('skip nth {} because it box invalid', _element_idx)
                        return 'continue'
                    ___element_inner_text: str = await _element_locator.inner_text()
                    while True:
                        _old = ___element_inner_text
                        ___element_inner_text = ___element_inner_text.replace(' ', '')
                        ___element_inner_text = ___element_inner_text.replace('\n', '')
                        ___element_inner_text = ___element_inner_text.replace('\t', '')
                        if _old == ___element_inner_text:
                            break
                    if len(___element_inner_text) > 30:
                        ___element_inner_text = ___element_inner_text[0:30]
                    if duplicated_only_text:
                        ___element_key = ___element_inner_text
                    else:
                        _element_hash = hashlib.md5(
                            f'{await _element_locator.inner_html()}'.encode('utf-8')).hexdigest()
                        ___element_key = f'{___element_inner_text}_{_element_hash}'
                    if _box['width'] < 10 or _box['height'] < 10:
                        if detail_logd:
                            logger.warning(
                                'why element box too small (and visible) , i will not click : _box={} , inner_html={}',
                                _box, await _element_locator.inner_html())
                        return 'continue'
                    ___ctx = {
                        'x': _box['x'],
                        'y': _box['y'],
                        'width': _box['width'],
                        'height': _box['height'],
                        'locator': _element_locator,
                    }
                    return ___element_key, ___element_inner_text, ___ctx

                if window_box is not None:
                    async def _collect_elements():
                        logger.debug('start collect elements')
                        _element_list_locator = _page.locator(__locator)
                        _element_idx = 0
                        _elements_count = await _element_list_locator.count()
                        _elements: Dict[str, PageScrollDownElementToClickContext] = dict()
                        while True:
                            try:
                                if _element_idx >= _elements_count:
                                    if detail_logd:
                                        logger.debug('break because _element_idx {} >= _elements_count {}',
                                                     _element_idx, _elements_count)
                                        if _elements_count <= 0:
                                            logger.warning('Not found element by selector {}', __locator)
                                    break
                                _element_locator = _element_list_locator.nth(_element_idx)
                                __ctx_result = await _get_key_txt_ctx_from_element_locator(
                                    _element_locator=_element_locator,
                                    _element_idx=_element_idx)
                                if __ctx_result == 'continue':
                                    continue
                                __element_key, _element_inner_text, __ctx = __ctx_result
                                if detail_logd:
                                    logger.debug(
                                        'found element:\n    _element_key is {}\n    inner text is {}\n    _ctx={}',
                                        __element_key, _element_inner_text, __ctx)
                                _elements[__element_key] = __ctx
                            finally:
                                _element_idx += 1

                            if _elements.keys().__len__() > 0:
                                if detail_logd:
                                    logger.debug('found elements duplicated by inner text :  ' +
                                                 '\n    _elements_count is {}' +
                                                 '\n    len(_elements)  is {}', _elements_count, len(_elements))
                        __elements_items = list(_elements.items())
                        __elements_items = _sort_and_check_elements_wait_to_click(__elements_items,
                                                                                  _detail_logd=detail_logd)
                        logger.debug(
                            'collect elements result : count is {} , len(__elements_items) is {} , locator is {}',
                            _elements_count, len(__elements_items), __locator)
                        return __elements_items

                    _elements_items = await _collect_elements()
                    _elements_wait_to_click_wait_to_add: List[Tuple[str, PageScrollDownElementToClickContext]] = []

                    while True:
                        if _elements_wait_to_click.__len__() > 0:
                            if detail_logd:
                                logger.debug('Pop element from _elements_wait_to_click , len is {}',
                                             len(_elements_wait_to_click))
                            _element_info = _elements_wait_to_click.pop(0)
                        elif _elements_items.__len__() > 0:
                            if detail_logd:
                                logger.debug('Pop element from _elements_items , len is {}', len(_elements_items))
                            _element_info = _elements_items.pop(0)
                        else:
                            if detail_logd:
                                logger.debug(
                                    'No items to process ... break loop . _elements_items is {} , _elements_wait_to_click is {}',
                                    _elements_items, _elements_wait_to_click)
                            break
                        try:
                            _element_key, _ctx = _element_info
                            __ctx_result_on_update = await _get_key_txt_ctx_from_element_locator(
                                _element_locator=_ctx['locator'],
                                _element_idx='on update'
                            )
                            if __ctx_result_on_update != 'continue' and __ctx_result_on_update[0] != _element_key:
                                logger.debug(
                                    '这看起来像是个长虚拟列表 —— 会重复使用之前脱离视口的 DOM 节点去渲染，因此当使用 inner text 来做 element_key 时会发生问题。')
                                logger.debug(
                                    'This looks like a long virtual list - it will reuse DOM nodes that were previously out of the viewport for rendering,' +
                                    'which will cause problems when using inner text as element_key:\n    _element_info={}\n    __ctx_result_on_update={}',
                                    _element_info,
                                    __ctx_result_on_update,
                                )
                                _element_key = __ctx_result_on_update[0]
                                _ctx = __ctx_result_on_update[2]

                            if detail_logd:
                                logger.debug('start process element {} ...', _element_key)
                            if _element_key in _elements_existed_keys:
                                if detail_logd:
                                    logger.debug('element key {} already existed', _element_key)
                                continue
                            if not await _update_ctx_box(_ctx):
                                if detail_logd:
                                    logger.debug(
                                        'ctx bounding box invalid , maybe it was remove from DOM ... element key is {}',
                                        _element_key)
                                _elements_items = await _collect_elements()
                                continue
                            if _ctx['x'] + _ctx['width'] / 2 < 0 \
                                    or _ctx['x'] + _ctx['width'] / 2 > window_box['width'] \
                                    or _ctx['y'] + _ctx['height'] / 2 > window_box['height'] \
                                    or _ctx['y'] + _ctx['height'] / 2 < not_clickable_top_margin:
                                if detail_logd:
                                    logger.debug('element out of box')
                                _elements_wait_to_click_wait_to_add.insert(0, _element_info)
                                continue

                            if on_found_after_click_steps is not None:
                                _elements_existed_keys.add(_element_key)
                                # click_x = _ctx['x'] + _ctx['width'] / 2
                                # click_y = _ctx['y'] + _ctx['height'] / 2
                                logger.info(
                                    'start click and dump page element :\n    _element_info={}\n    curr_height={} , curr_height_min={}\n    window_box={}',
                                    _element_info, curr_height, curr_height_min, window_box)

                                if on_before_click_steps is not None:
                                    await self._process_steps(on_before_click_steps)

                                async def _check_steps():
                                    if on_before_click_check_steps is not None:
                                        await self._process_steps(on_before_click_check_steps)
                                    if check_selector_exist_after_click is not None:
                                        try:
                                            await self.page_wait_for_selector_in_any_frame(
                                                check_selector_exist_after_click,
                                                timeout=2000)
                                            logger.debug(
                                                'click success and selector {} existed',
                                                check_selector_exist_after_click)
                                            return True
                                        except BaseException as _err:
                                            if is_timeout_error(_err):
                                                _elements_wait_to_click.append(_element_info)
                                                logger.warning(
                                                    'click maybe failed because selector {} not existed, should try again ...',
                                                    check_selector_exist_after_click)
                                                return False
                                            else:
                                                raise _err
                                    else:
                                        return True

                                try:
                                    await self.page_click(
                                        _ctx['locator'],
                                        detail_logd=detail_logd
                                    )
                                except BaseException as err:
                                    if not is_timeout_error(err):
                                        raise err
                                    if on_found_after_click_steps is not None:
                                        logger.debug('Timeout on page_click , but we will checking ...')
                                    else:
                                        logger.warning(
                                            'Timeout on page_click , please set `check_selector_exist_after_click` to avoid it')

                                if not await _check_steps():
                                    logger.debug('check steps return False , continue to next element')
                                    continue

                                await sleep(0.5)
                                _dump_count += 1
                                await self._dump_page(
                                    f'scroll_click_dump_pre_{_dump_count}_{_element_key}_')
                                await self._process_steps(on_found_after_click_steps)
                                await sleep(0.5)
                                await self._dump_page(
                                    f'scroll_click_dump_aft_{_dump_count}_{_element_key}_')
                                await sleep(0.5)
                                if on_found_after_click_and_dump_steps is not None:
                                    await self._process_steps(on_found_after_click_and_dump_steps)
                                    await sleep(0.5)
                        except BaseException as err:
                            raise Exception(
                                f'Failed operate , _dump_count = {_dump_count} , _element_info = {_element_info}') from err

                    _elements_wait_to_click.extend(_elements_wait_to_click_wait_to_add)
                    _elements_wait_to_click = _sort_and_check_elements_wait_to_click(_elements_wait_to_click,
                                                                                     _detail_logd=detail_logd)

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
                    await self.page_random_mouse_move()
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

    async def page_go_back(self, **kwargs):
        page = await self._get_page()
        old_url = page.url
        logger.debug('page go back , kwargs={} , current url is\n    {}',
                     kwargs, old_url)
        if kwargs.get('timeout') is not None:
            timeout = kwargs.pop('timeout')
        else:
            timeout = self._page_go_back_default_timeout
        res = await page.go_back(timeout=timeout, **kwargs)
        return res

    async def dump_page_with_uuid(self, tag: str):
        return await self._dump_page(f'tag_{tag}_uuid_{uuid4().hex}')

    async def dump_page_for_each(self, *,
                                 dump_tag_prefix: str,
                                 before_dump_steps: Optional[StepsBlock],
                                 after_dump_steps: Optional[StepsBlock],
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
                    await self._process_steps(before_dump_steps)
                except BaseException as err:
                    from libiancrawlers.util.exceptions import is_timeout_error
                    if is_timeout_error(err) and before_dump_break_by_timeout:
                        logger.info('[dump_tag = {}] before_dump_break by timeout : {}', dump_tag, err)
                        break
                    else:
                        raise
            logger.debug('[dump_tag = {}] after before_dump_steps', dump_tag)
            logger.debug('[dump_tag = {}] before dump_page', dump_tag)
            await self._dump_page(dump_tag=dump_tag)
            logger.debug('[dump_tag = {}] after dump_page', dump_tag)
            logger.debug('[dump_tag = {}] before after_dump_steps', dump_tag)
            if after_dump_steps is not None:
                try:
                    await self._process_steps(after_dump_steps)
                except BaseException as err:
                    from libiancrawlers.util.exceptions import is_timeout_error
                    if is_timeout_error(err) and after_dump_break_by_timeout:
                        logger.info('[dump_tag = {}] after_dump_break by timeout : {}', dump_tag, err)
                        break
                    else:
                        raise
            logger.debug('[dump_tag = {}] after after_dump_steps', dump_tag)
            count += 1

    async def if_url_is(self, *args, run_steps: StepsBlock = None, else_steps: StepsBlock = None):
        await sleep(0.3)
        _page = await self._get_page()
        logger.debug('current page url is {}', _page.url)
        for url in args:
            if _page.url == url:
                if run_steps is not None:
                    await self._process_steps(run_steps)
                else:
                    logger.debug('url is {} , it is in {} , please set `run_steps`', _page.url, args)
                break
        else:
            if else_steps is not None:
                await self._process_steps(else_steps)
            else:
                logger.debug('url is {} , it not in {} , please set `else_steps`', _page.url, args)

    async def page_close(self):
        _cur_page = await self._get_page()
        await self.switch_page(-2)
        await sleep(0.5)
        await _cur_page.close()
        await sleep(0.5)
        await self.switch_page(-1)

    async def switch_page(self, to: Union[int, Literal['default'], Page]):
        try:
            await sleep(1)
            if to == 'default':
                res = self._b_page
            elif isinstance(to, int):
                logger.debug('all pages : {}', self._browser_context.pages)
                len_all_pages = self._browser_context.pages.__len__()
                res = self._browser_context.pages[
                    len_all_pages - 1 if to > 0 and to >= len_all_pages else -1
                    if to < 0 and abs(to) > len_all_pages else to
                ]
            elif isinstance(to, Page):
                res = to
            else:
                raise ValueError(f'Invalid param {to}')
            _old_page = await self._get_page()
            from_title = await _old_page.title()
            to_title_prev = await res.title()
            logger.debug('Start switch page {} : from {} , to title on create {}',
                         to,
                         from_title,
                         to_title_prev,
                         )
            await self.page_wait_loaded(page=res)
            to_title_cur = await res.title()
            await self._set_page(res)
            logger.debug('Finish switch page {} : from {} , to title ( {} >>> {} )',
                         to,
                         from_title,
                         to_title_prev,
                         to_title_cur)
            await sleep(1)
            while (await self._get_page()).url != res.url:
                logger.warning('It seems like ref not change , recall again')
                await self.switch_page(to)
        except BaseException as err:
            if is_timeout_error(err):
                logger.debug('switch page timeout ? maybe system blocking ? we will retry')
                await self.switch_page(to)
            raise

    async def gui_confirm(self, *, title: str, message: str):
        from libiancrawlers.app_util.gui_util import gui_confirm
        return await gui_confirm(title=title, message=message)


def _create_steps_api_functions(*,
                                b_page: Page,
                                browser_context: BrowserContext,
                                _dump_page: Callable[[str, Page], Awaitable],
                                _process_steps: Callable[
                                    [StepsBlock],
                                    Awaitable,
                                ],
                                _page_ref_lock: asyncio.locks.Lock,
                                _page_ref: PageRef
                                ):
    return StepsApi(b_page=b_page, browser_context=browser_context, _dump_page=_dump_page,
                    _process_steps=_process_steps, _page_ref_lock=_page_ref_lock, _page_ref=_page_ref)


if __name__ == '__main__':
    pass
