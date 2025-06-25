# -*- coding: UTF-8 -*-
import asyncio
import collections.abc
import hashlib
import json
import os.path
import random
import typing
from collections import Counter
from datetime import datetime, timedelta

from typing import Optional, Literal, TypedDict, Callable, Awaitable, Union, List, Tuple, Dict
from uuid import uuid4
from loguru import logger
from playwright.async_api import Page, BrowserContext, Locator, Position

from libiancrawlers.util.coroutines import sleep
from libiancrawlers.util.exceptions import is_timeout_error
from libiancrawlers.util.timefmt import days_ranges_iter

if typing.TYPE_CHECKING:
    from libiancrawlers.app_util.types import JSON
    from libiancrawlers.util.timefmt import YMDParam

    StepsBlock = Union[
        JSON,
        List[JSON],
    ]
    OnLocatorBlock = JSON

else:
    JSON = 'JSON'
    YMDParam = 'YMDParam'
    StepsBlock = 'StepsBlock'
    OnLocatorBlock = 'OnLocatorBlock'
    # PageScrollDownPageClickIfFound = 'PageScrollDownPageClickIfFound'

PageScrollDownPageClickIfFoundRequireKeys = TypedDict('PageScrollDownPageClickIfFoundRequireKeys', {
    'locator': typing.Annotated[str, '传递给 `page.locator(locator, **kwargs)` 的参数。'],
})

OnNewPage = Optional[
    Union[
        Literal[
            'switch_it_and_run_steps_no_matter_which_page',
            'ignore'
        ],
        StepsBlock
    ]
]

_on_new_page_desc = """
当点击之后有新标签页时的处理方法。

- 缺省及默认值为 `"switch_it_and_run_steps_no_matter_which_page"` ，将会自动将当前页面指针指向新页面，但假如没有新页面则无事发生。  
- `"ignore"` 值将会忽略新页面（且当前页面指针不会指向新页面）。
- 如果传入 StepsBlock，则先将自动将当前页面指针指向新页面，然后 在新页面中执行此 StepsBlock ，并且会在 StepsBlock 块完毕后自动将当前页面指针指回旧页面 。
"""
_close_new_page_desc = '设为 true 时，在 on_new_page 块执行完成后关闭新页面。'


class PageScrollDownPageClickIfFound(PageScrollDownPageClickIfFoundRequireKeys, total=False):
    not_clickable_top_margin: typing.Annotated[
        Optional[float],
        """向下滚动中点击元素时，不会点击距离窗口顶部的距离小于此值的位置。通常用于一些有 sticky 顶栏的网站，以免误触到顶栏"""
    ]
    duplicated_only_text: typing.Annotated[
        Optional[bool],
        """
在找到满足 `locator` 的全部元素后，需要根据特定的方法，
来判别多次查询到的元素列表中，“新旧查询中是否为同一个元素”的对应关系。

旧的已经被点击过的元素不会再次点击，“判断是不是旧”的通过这里指定的 key 算法。

如果 `duplicated_only_text` 为 False（默认值），
则将 `element.inner_text()[0:30] + "_" + md5(element.inner_html())` 作为 key 。

如果 `duplicated_only_text` 为 True，
则将 `element.inner_text()[0:30]` 作为 key 。
"""
    ]
    on_before_click_steps: typing.Annotated[
        Optional[StepsBlock],
        """
在点击元素之前，执行此回调。
"""
    ]
    check_selector_exist_after_click: typing.Annotated[
        Optional[str],
        """
传入此值后。在点击满足 `locator` 的某元素后，检查页面上是否出现满足此参数 selector 的元素。
如果存在，则继续执行；如果不存在，则处理下一个元素。

如果不传入此值，则继续执行。
"""
    ]
    on_before_click_check_steps: typing.Annotated[
        Optional[StepsBlock],
        """
在点击元素之后，检查另一个元素是否存在之前，执行此回调。
不管 `check_selector_exist_after_click` 是否为 True，此回调都会执行。
"""
    ]
    on_before_dump_steps: typing.Annotated[
        Optional[StepsBlock],
        """
在转储页面被调用之前一刹那，执行此回调。

关于自动转储页面的时机:
- 如果 `on_new_page` 不为 `"ignore"`，且有新页面出现，则:
    - 如果 `on_new_page` 为缺省值 `"switch_it_and_run_steps_no_matter_which_page"` ，则在 新页面被切换到之后 转储页面。
    - 如果 `on_new_page` 为回调块，则在 新页面被切换到之后、且回调块执行完之后 转储页面。
- 如果上述情况均不满足。
    - 在 `check_selector_exist_after_click` 通过后 转储页面。
"""
    ]
    detail_logd: typing.Annotated[
        Optional[bool],
        """输出详细日志。"""
    ]
    on_after_dump_steps: typing.Annotated[
        Optional[StepsBlock],
        """
在转储页面被调用之后一刹那，执行此回调。
"""
    ]
    on_new_page: typing.Annotated[
        Optional[OnNewPage],
        f"""
传递给 `self.page_click` 的可选参数。

{_on_new_page_desc}
"""
    ]
    close_new_page: typing.Annotated[
        Optional[bool],
        f"""
传递给 `self.page_click` 的可选参数。

{_close_new_page_desc}
"""
    ]


class SmartCrawlSignal(BaseException):
    pass


class SmartCrawlStopSignal(SmartCrawlSignal):
    pass


XY = TypedDict('XY', {'x': float, 'y': float})

PageRef = TypedDict('PageRef', {'value': Page, })

PageScrollDownElementToClickContext = TypedDict('PageScrollDownElementToClickContext',
                                                {'x': float, 'y': float, 'width': float, 'height': float,
                                                 'locator': Locator})

StepsApiArgConfType = Literal['Timeout', 'StepsBlock', 'str', 'float>=0']

StepsApiArgConf = TypedDict('StepsApiArgConf', {
    'name': str,
    'hide': bool,
    'desc': Optional[str],
    'type': Optional[StepsApiArgConfType],
    'type_hint': Optional[typing.Any],
    "examples": Optional[List[JSON]],
})

_arg_conf_map: Dict[str, List[StepsApiArgConf]] = dict()


def arg_conf(name: str, *,
             hide: bool = False,
             desc: Optional[str] = None,
             typ: Optional[StepsApiArgConfType] = None,
             type_hint: Optional[typing.Any] = None,
             examples: Optional[List[JSON]] = None):
    def deco(func):
        steps_api_confs: List[StepsApiArgConf] = [] \
            if _arg_conf_map.get(func.__name__) is None \
            else _arg_conf_map.get(func.__name__)
        steps_api_confs.append({
            'name': name,
            'hide': hide,
            'desc': desc,
            'type': typ,
            'type_hint': type_hint,
            'examples': examples,
        })
        _arg_conf_map[func.__name__] = steps_api_confs
        return func

    return deco


StepsApiFuncConf = TypedDict('StepsApiFuncConf', {
    'varargs_min': Optional[int],
    'varargs_conf_types': Optional[Union[typing.Any, List[typing.Any]]]
})

_func_conf_map: Dict[str, StepsApiFuncConf] = dict()

_selector_desc = """
playwright 定位元素所使用的 [选择器](https://playwright.dev/docs/locators)。
"""
_timeout_desc = """
超时时间，单位为毫秒。
"""

_on_locator_allow_methods = [
    Locator.get_by_text,
    Locator.get_by_alt_text,
    Locator.get_by_role,
]
_next_line = '\n'
_on_locator_desc = f"""
当需要在 `page_or_frame.locator` 的结果上再调用 [`Locator`](https://playwright.dev/docs/api/class-locator)
的以下函数(均为返回一个新 Locator 的函数)时，可以传入 OnLocatorBlock 进行链式调用:

{f'{_next_line}'.join([f'- `{func.__name__}`' for func in _on_locator_allow_methods])}
"""
_on_locator_examples = [
    {
        "fn": "get_by_text",
        "args": ["Sign In"]
    }, {
        "fn": "get_by_role",
        "args": ["banner"]
    }
]

_only_main_frame_desc = '只在页面根 iframe 中寻找元素，设为 false 后将会在页面的所有 iframe 中寻找元素。'


def func_conf(*,
              varargs_min: Optional[int] = None,
              varargs_conf_types: Optional[Union[StepsApiArgConfType, List[StepsApiArgConfType]]] = None):
    def deco(func):
        _func_conf_map[func.__name__] = {
            'varargs_min': varargs_min,
            'varargs_conf_types': varargs_conf_types,
        }
        return func

    return deco


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
                 _page_ref: PageRef,
                 _download_storage_path: str,
                 _dump_obj: Callable[[str, JSON], Awaitable],
                 _global_counter: Counter
                 ):
        self._b_page = b_page
        self._browser_context = browser_context
        self._var_dump_page = _dump_page
        self._var_process_steps = _process_steps
        self._page_ref_lock = _page_ref_lock
        self._page_ref = _page_ref
        self._download_storage_path = _download_storage_path
        self._dump_obj = _dump_obj
        self._global_counter = _global_counter
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

    async def _get_page_title_ignore_err(self, res: Page):
        try:
            title = await res.title()
        except BaseException as err:
            title = f'【ERROR: get title failed: {str(err)}】'
        return title

    async def _get_page_url_ignore_err(self, res: Page):
        try:
            url = res.url
        except BaseException as err:
            url = f'【ERROR: get url failed: {str(err)}】'
        return url

    async def _get_page(self):
        import inspect

        async with self._page_ref_lock:
            res = self._page_ref['value']

        _frame, _filename, _line_number, _function_name, _lines, _index = inspect.stack()[1]
        logger.debug('current page title is {} , call from {} , link is \n    {}',
                     await self._get_page_title_ignore_err(res),
                     _function_name,
                     await self._get_page_url_ignore_err(res))
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

                for func in _on_locator_allow_methods:
                    if func.__name__ == fn:
                        func: typing.Any = func
                        loc2 = func(loc, *opt.get('args', []), **opt.get('kwargs', dict()))
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
            retry_limit = 3
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
                    # noinspection PyInconsistentReturns
                    continue
                raise

    async def _dump_page(self, dump_tag: str):
        return await self._var_dump_page(dump_tag, await self._get_page())

    def _next_download_count(self) -> str:
        c = self._global_counter['_download_count']
        self._global_counter['_download_count'] += 1
        res = str(c).rjust(6, '0')
        return res

    # ------------------------------------------------------------------
    # Public API

    @arg_conf('total', desc='睡眠时间，单位为毫秒', typ='Timeout')
    async def sleep(self, total: float):
        """
        使程序暂停指定毫秒。
        """
        if total < 10:
            logger.warning('Do you known sleep() unit is millisecond ? (you bypass {})', total)
        await sleep(total / 1000.0)

    @func_conf(varargs_min=1, varargs_conf_types=['str'])
    async def logd(self, *args, **kwargs):
        """
        输出debug级别日志。
        """
        logger.debug(*args, **kwargs)

    @func_conf(varargs_min=1, varargs_conf_types=['str'])
    async def logi(self, *args, **kwargs):
        """
        输出info级别日志。
        """
        logger.info(*args, **kwargs)

    @func_conf(varargs_min=1, varargs_conf_types=['str'])
    async def logw(self, *args, **kwargs):
        """
        输出warn级别日志。
        """
        logger.warning(*args, **kwargs)

    @func_conf(varargs_min=1, varargs_conf_types=['str'])
    async def loge(self, *args, **kwargs):
        """
        输出error级别日志。
        """
        logger.error(*args, **kwargs)

    async def page_random_mouse_move(self):
        """
        让浏览器光标在视口中胡乱移动，像人似的装模作样。
        """
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

    @arg_conf('page', hide=True)
    async def page_wait_loaded(self, *, page: Optional[Page] = None):
        """
        这是一个封装好的等待页面加载完成的工具函数。它会调用 `page.wait_for_load_state('domcontentloaded')`、
        `page.wait_for_load_state('networkidle')`、`page.bring_to_front()` 等多种方式来等待页面加载完成。
        """
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

    @arg_conf('selector', desc=_selector_desc)
    @arg_conf('timeout', desc=_timeout_desc, typ='Timeout')
    @arg_conf('strict', desc="传递给 `frame.wait_for_selector` 的可选参数", type_hint=typing.Optional[bool])
    @arg_conf('state', desc="传递给 `frame.wait_for_selector` 的可选参数", type_hint=typing.Optional[
        Literal["attached", "detached", "hidden", "visible"]
    ])
    async def page_wait_for_selector_in_any_frame(self, selector: str, *, timeout: Optional[float], **kwargs):
        """
        等待指定的 `selector` 在任意 Frame 中出现。
        """
        from playwright.async_api import Frame

        async def fn(*, frame: Frame, loop_timeout: float):
            return await frame.wait_for_selector(selector, timeout=loop_timeout, **kwargs)

        return await self._page_any_frame(func=fn,
                                          timeout=timeout,
                                          err_msg=f'not found selector {selector} in any frame',
                                          suc_msg_template=f'success found selector {selector} in frame {{}} , result is {{}}')

    async def page_wait_for_function(self, *args, **kwargs):
        """
        等待执行 js 函数。请参考 Camoufox 文档以区分世界隔离机制: https://camoufox.com/python/main-world-eval
        """
        return await (await self._get_page()).wait_for_function(*args, **kwargs)

    @arg_conf('selector',
              desc=_selector_desc)
    @arg_conf('method',
              desc="""
具体点击事件的类型。

- 当 `selector` 传入 XY 对象 时，使用 [`page.mouse.click`](https://playwright.dev/python/docs/api/class-mouse#mouse-click) 触发点击事件。
- 当 `selector` 传入 字符串 时，先使用 [`page_or_frame.locator`](https://playwright.dev/python/docs/api/class-locator) 定位元素:
    - 当 method 为 `click` 时，使用 [`Locator.click`](https://playwright.dev/python/docs/api/class-locator#locator-click) 触发点击事件。
    - 当 method 为 `tap` 时，使用 [`Locator.tap`](https://playwright.dev/python/docs/api/class-locator#locator-tap) 触发点击事件。
    - 当 method 为 `dispatch_event_click` 时，使用 [`Locator.dispatch_event("click")`](https://playwright.dev/python/docs/api/class-locator#locator-tap) 触发点击事件。
""")
    @arg_conf('on_new_page',
              desc=_on_new_page_desc)
    @arg_conf('detail_logd',
              hide=True)
    @arg_conf('wait_any_page_create_time_limit',
              desc='观察是否有新页面创建的等待时间，单位为毫秒。',
              typ='Timeout')
    @arg_conf('only_main_frame',
              desc=_only_main_frame_desc)
    @arg_conf('each_steps_before',
              desc='（仅当使用`page_or_frame.locator`时有效。）当 `each_steps_before` 或 `each_steps_after` 非空时，将会点击符合 selector 的所有元素。在点击前会执行 `each_steps_before` 块。')
    @arg_conf('each_steps_after',
              desc='（仅当使用`page_or_frame.locator`时有效。）当 `each_steps_before` 或 `each_steps_after` 非空时，将会点击符合 selector 的所有元素。在点击后会执行 `each_steps_before` 块。')
    @arg_conf('timeout_retry',
              desc='（仅当使用`page_or_frame.locator`时有效。）仅点击操作的超时重试次数。')
    @arg_conf('close_new_page',
              desc=_close_new_page_desc)
    @arg_conf('timeout',
              desc=_timeout_desc,
              typ='Timeout')
    @arg_conf('has_text',
              desc='（仅当使用`page_or_frame.locator`时有效。）定位包含此文本的元素。',
              typ='str')
    @arg_conf('has_no_text',
              desc='（仅当使用`page_or_frame.locator`时有效。）定位不包含此文本的元素。',
              typ='str')
    @arg_conf('delay',
              desc='传递给 `page.mouse.click` 或 `Locator.click` 或 `Locator.tap` 的可选参数',
              typ='float>=0')
    @arg_conf('button',
              desc='传递给 `page.mouse.click` 或 `Locator.click` 的可选参数',
              type_hint=typing.Optional[Literal["left", "middle", "right"]])
    @arg_conf('click_count',
              desc='传递给 `page.mouse.click` 或 `Locator.click` 的可选参数',
              type_hint=typing.Optional[int])
    @arg_conf('on_locator',
              desc=_on_locator_desc,
              type_hint=typing.Optional[OnLocatorBlock],
              examples=_on_locator_examples)
    @arg_conf('position',
              desc='传递给 `Locator.click` 或 `Locator.tap` 的可选参数',
              type_hint=typing.Optional[Position])
    @arg_conf('force',
              desc="""
传递给 `Locator.click` 或 `Locator.tap` 的可选参数。
设为 true 将不进行 [actionability](https://playwright.dev/docs/actionability) 检查而强行点击。
""",
              type_hint=typing.Optional[bool])
    @arg_conf('no_wait_after',
              desc="""
传递给 `Locator.click` 或 `Locator.tap` 的可选参数。
此参数已经被 playwright 弃用。
""",
              type_hint=typing.Optional[bool])
    @arg_conf('trial',
              desc="""
传递给 `Locator.click` 或 `Locator.tap` 的可选参数。

设置为 true 后，此方法仅执行 [actionability](https://playwright.dev/docs/actionability) 检查并跳过操作。
默认为 false。

这在等待元素准备好执行操作而不执行操作很有用。
请注意，无论 trial 如何，键盘 修饰键 都会被按下，以允许测试仅在按下这些键时才可见的元素。
""",
              type_hint=typing.Optional[bool])
    async def page_click(self,
                         selector: Union[str, Locator, XY],
                         *,
                         method: Literal['click', 'tap', 'dispatch_event_click'] = None,
                         on_new_page: OnNewPage = None,
                         detail_logd: bool = False,
                         wait_any_page_create_time_limit: Optional[float] = None,
                         only_main_frame: bool = True,
                         each_steps_before: Optional[StepsBlock] = None,
                         each_steps_after: Optional[StepsBlock] = None,
                         timeout_retry: int = 0,
                         _on_new_page_dump_callback_func: Optional[Callable[[], Awaitable[None]]] = None,
                         close_new_page: bool = False,
                         **kwargs):
        """
        通用的页面点击工具函数。
        """
        if method is None:
            method = 'click'
        if on_new_page is None:
            on_new_page = 'switch_it_and_run_steps_no_matter_which_page'
        if wait_any_page_create_time_limit is None or wait_any_page_create_time_limit < 0:
            wait_any_page_create_time_limit = 3000 if isinstance(on_new_page, str) else 6000

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
            async def _get_loc():
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
                return _loc

            loc = await _get_loc()

            async def _click(_locator: Locator, *,
                             retry_get_locator: Optional[Callable[[], Awaitable[Locator]]] = None):
                retry_count = timeout_retry
                while True:
                    try:
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
                        elif method == 'dispatch_event_click':
                            await _locator.dispatch_event('click', timeout=timeout)
                        else:
                            raise ValueError(f'Invalid method {method}')
                        break
                    except BaseException as err:
                        if retry_count > 0 and is_timeout_error(err):
                            logger.warning('Timeout on page_click , current retry count is {} , _locator is {}',
                                           retry_count, _locator)
                            retry_count -= 1
                            if retry_get_locator is not None:
                                _locator = await retry_get_locator()
                        else:
                            raise

            if each_steps_before is not None or each_steps_after is not None:
                _loc_all = await loc.all()
                if _loc_all.__len__() <= 0:
                    raise TimeoutError(f'Not found matched , selector is {selector}')
                for _loc_item in _loc_all:
                    if each_steps_before is not None:
                        await self._process_steps(each_steps_before)
                    await _click(_loc_item)
                    if each_steps_after is not None:
                        await self._process_steps(each_steps_after)
            else:
                await _click(loc, retry_get_locator=_get_loc)

        await _debug_window_state(f'after page {method}')

        if on_new_page != 'ignore':
            wait_any_page_create_at = datetime.now().timestamp()
            while datetime.now().timestamp() - wait_any_page_create_at < wait_any_page_create_time_limit / 1000.0:
                if pages_size_old != self._browser_context.pages.__len__():
                    logger.debug(
                        'Some page created :\n    pages_size_old is {}\n    current page list size is {}\n    page list is {}',
                        pages_size_old,
                        self._browser_context.pages.__len__(),
                        self._browser_context.pages)
                    if on_new_page == 'switch_it_and_run_steps_no_matter_which_page':
                        logger.debug('switch to new page , run steps no matter which page')
                        await self.switch_page(-1)
                        if _on_new_page_dump_callback_func is not None:
                            await _on_new_page_dump_callback_func()
                        if close_new_page:
                            pass  # todo
                    else:
                        old_page = await self._get_page()
                        logger.info('switch to new page, but i will back')
                        new_page = await self.switch_page(-1)
                        try:
                            logger.debug('run steps on new page')
                            await self._process_steps(on_new_page)
                            if _on_new_page_dump_callback_func is not None:
                                await _on_new_page_dump_callback_func()
                        finally:
                            if close_new_page:
                                await self.page_close(_page=new_page)
                            logger.debug('switch back to old page {}', old_page)
                            await self.switch_page(old_page)

                    break
                else:
                    logger.debug('not found new page created after click')
                    await sleep(0.5)
            else:
                logger.debug('not continue loop for found new page created after click')
                if not isinstance(on_new_page, str):
                    raise ValueError('Assert new page create')

    @arg_conf('selector', desc=_selector_desc)
    @arg_conf('on_exist_steps', desc='当 selector 元素未消失且 `retry_count < retry_limit` 时，执行此块。')
    @arg_conf('retry_limit', desc='当 selector 元素未消失时，将会重新点击此参数次数。')
    async def page_click_and_expect_element_destroy(self, selector: Union[str, Locator, XY], *,
                                                    on_exist_steps: Optional[StepsBlock] = None,
                                                    retry_limit=5):
        """
        点击页面上的 `selector` 元素并期望该 `selector` 元素消失，如果在点击后该 `selector` 元素没有消失将会重新点击。
        """
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

    @arg_conf('selector', desc=_selector_desc)
    @arg_conf('text', desc='要输入的值。')
    @arg_conf('only_main_frame', desc=_only_main_frame_desc, type_hint=Optional[bool])
    @arg_conf('timeout',
              desc=_timeout_desc,
              typ='Timeout')
    @arg_conf('delay',
              desc='传递给 `page_or_frame.type` 或 `page_or_frame.fill` 的可选参数',
              typ='float>=0')
    @arg_conf('no_wait_after',
              desc="""
传递给 `page_or_frame.type` 或 `page_or_frame.fill` 或 `page_or_frame.select_option` 的可选参数。
此参数已经被 playwright 弃用。
""",
              type_hint=typing.Optional[bool])
    @arg_conf('strict',
              desc="""传递给 `page_or_frame.type` 或 `page_or_frame.fill` 或 `page_or_frame.select_option` 的可选参数。设为 true 时将确保符合条件的元素只有一个。""",
              type_hint=typing.Optional[bool])
    @arg_conf('use_fill', desc='使用 `page_or_frame.fill` 重新填充文本框。', type_hint=Optional[bool])
    @arg_conf('force',
              desc="""
传递给 `page_or_frame.fill` 或 `page_or_frame.select_option` 的可选参数。
设为 true 将不进行 [actionability](https://playwright.dev/docs/actionability) 检查而强行输入。
""",
              type_hint=typing.Optional[bool])
    @arg_conf('use_select_options', desc='使用 `page_or_frame.select_option` 在 select 标签中选择。',
              type_hint=Optional[bool])
    @arg_conf('index',
              desc="""传递给 `page_or_frame.select_option` 的可选参数。""",
              type_hint=typing.Optional[int])
    @arg_conf('label',
              desc="""传递给 `page_or_frame.select_option` 的可选参数。""",
              type_hint=typing.Optional[str])
    async def page_type(self, selector: str, text: str, **kwargs):
        """
        通用的输入文本的工具函数。默认使用 `page_or_frame.type` 进行输入（可使用 `use_fill` 或 `use_select_options` 更改）。
        """
        delay = kwargs.pop('delay', self._page_type_default_delay)
        timeout = kwargs.pop('timeout', self._page_type_default_timeout)
        use_fill = kwargs.pop('use_fill', False)
        use_select_options = kwargs.pop('use_select_options', False)
        force = kwargs.pop('force', False)
        strict = kwargs.get('strict')
        only_main_frame = kwargs.pop('only_main_frame', True)
        if only_main_frame:
            page = await self._get_page()
            if use_fill:
                await page.fill(selector, text, timeout=timeout, strict=strict, force=force)
            elif use_select_options:
                await page.select_option(selector, text, timeout=timeout, strict=strict, force=force)
            else:
                await page.focus(selector=selector, timeout=timeout, strict=strict)
                await page.type(selector, text, delay=delay, timeout=timeout, **kwargs)
        else:
            logger.debug('wait for selector in any frame to type , selector is {}', selector)
            frame, _ = await self.page_wait_for_selector_in_any_frame(selector=selector,
                                                                      timeout=timeout,
                                                                      strict=strict,
                                                                      state=kwargs.get('state'))
            logger.debug('existed selector in any frame to type , try type to frame {} , selector is {} , text is {}',
                         frame, selector, text, )
            if use_fill:
                await frame.fill(selector, text, timeout=timeout, strict=strict)
            elif use_select_options:
                await frame.select_option(selector, text, timeout=timeout, strict=strict, force=force)
            else:
                await frame.focus(selector=selector, timeout=timeout, strict=strict)
                await frame.type(selector, text, delay=delay, timeout=timeout, **kwargs)
                logger.debug('Success type to frame')

    @arg_conf('start', desc='起始日期，可以传入 `now` 或 YMDParam(形如 `[2025,6,24]` 或 `"2025-6-24" 之类的日期格式)` ',
              examples=["now", [2025, 3, 31], '2025-4-25'])
    @arg_conf('offset_day', desc="""
日期步长。可以传入正整数或负整数，不能传入0。

传入正整数会 yield (今天, 明天),(明天, 后天),... ;
传入负整数会 yield (今天, 昨天),(昨天, 前天),... ;
""", examples=[1, -1, 2, -2, 7, -7, 15, -15])
    @arg_conf('stop_until',
              desc="""停止日期 或 停止循环次数。传入 integer 为停止循环次数，传入 YMDParam(形如 `[2025,6,24]` 或 `"2025-6-24" 之类的日期格式) 为停止日期。""",
              examples=[3, 15, 30, 60, [2025, 6, 20], '2025-6-20'])
    @arg_conf('yield_stop_until_value_if_end_value_not_equal', desc="""
当停止日期不在步长倍数上时，设为 true 将 yield (最后一步, 停止日期)。默认值为 true
""")
    @arg_conf('end_offset', desc="""
截止时间点的偏移量，单位为天。会令输出变为 (date1, date2+end_offset), (date2, date3+offset), ...
""", examples=[0, 3, 7, -1])
    @arg_conf('time_format', desc="""输出时间格式""")
    @arg_conf('delay',
              desc='传递给 `self.page_type` 的可选参数',
              typ='float>=0')
    @arg_conf('timeout',
              desc='传递给 `self.page_type` 的可选参数',
              typ='Timeout')
    @arg_conf('strict',
              desc='传递给 `self.page_type` 的可选参数',
              type_hint=Optional[bool])
    @arg_conf('only_main_frame',
              desc='传递给 `self.page_type` 的可选参数',
              type_hint=Optional[bool])
    @arg_conf('use_fill',
              desc='传递给 `self.page_type` 的可选参数',
              type_hint=Optional[bool])
    @arg_conf('force',
              desc='传递给 `self.page_type` 的可选参数',
              type_hint=Optional[bool])
    @arg_conf('begin_selector', desc=f'{_selector_desc}。起始日期将会被输入到此元素')
    @arg_conf('end_selector', desc=f'{_selector_desc}。截止日期将会被输入到此元素')
    @arg_conf('steps_before_begin',
              desc=f'输入起始日期之前的回调（起始日期不一定在截止日期之前输入，因为有的日期选择器组件会限制输入）')
    @arg_conf('steps_after_begin',
              desc=f'输入起始日期之后的回调（起始日期不一定在截止日期之前输入，因为有的日期选择器组件会限制输入）')
    @arg_conf('steps_before_end',
              desc=f'输入截止日期之前的回调（起始日期不一定在截止日期之前输入，因为有的日期选择器组件会限制输入）')
    @arg_conf('steps_after_end',
              desc=f'输入截止日期之后的回调（起始日期不一定在截止日期之前输入，因为有的日期选择器组件会限制输入）')
    @arg_conf('steps_after_type_all', desc=f'两个日期均输入完毕后的回调。')
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
        """
        用于在一些日期范围选择器组件中输入日期范围的工具函数。
        该函数会遍历 `[StartDate, EndDate][]` 并将其输出到日期范围选择器组件中。
        """
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

    @arg_conf('delta_y', desc="""
每次向下滚动的距离因子。实际向下滚动的距离为其的 0.3~1.6 倍。 默认值 233.0 。
建议不要修改，容易出 BUG。
""")
    @arg_conf('interval', desc="""
每次向下滚动事件之间的时间间隔因子。实际的间隔时间为它的 0.7~1.3 倍。 默认值 0.5。
建议不要修改，容易出 BUG。
""")
    @arg_conf('max_height',
              desc="""
向下滚动的最大高度限制。
如果你需要 gecko 的网页截图功能，请勿设置过高的值，因为它会引发 [gecko 截图超过像素上限](https://www.google.com.hk/search?q=Cannot+take+screenshot+larger+than+32767) 的问题。
""")
    @arg_conf('retry_scroll_down_limit',
              desc="""
默认值 2 。当发现滚动后高度和上次一致时，再向下滚动此次数，若还是一致或高度缩短，则认为 没有发现新加载的内容。
""")
    @arg_conf('retry_scroll_up_limit',
              desc="""
默认值 2 。当 没有发现新加载的内容 时，会 试图向上滚动再向下滚动检查 此次数。
当该过程中发现了新加载的内容，清空此计数器并继续向下滚动；

直到此计数器超过该值 或 超过高度上限 时，才会认为页面已经滚动到底。
""")
    @arg_conf('page_click_if_found',
              desc="""
当指定此值时，将会在向下滚动的过程中不断的将 满足 locator 属性的选择器要求的元素 的位置收集入列表中。

仅当同时满足 元素可以被点击、元素出现在视口内、元素的长宽均超过10 时，将会点击此元素。
如果没满足点击条件，则会保留在列表中，直到满足条件才被点击并移出列表，（或是因已经划过高度而跳过）。
""")
    async def page_scroll_down(self, *,
                               delta_y=233.0,
                               interval=0.5,
                               max_height: Optional[float] = 20000,
                               retry_scroll_up_limit: int = 2,
                               retry_scroll_down_limit: int = 2,
                               page_click_if_found: Optional[PageScrollDownPageClickIfFound] = None,
                               ):
        """
        将页面向下滚动到底或最大高度。
        当滚到底部时，会上滚一下再下滚，反复多次后若高度不变（没有加载新玩意）则认为滚动完成。
        如果指定了 `page_click_if_found` 属性，则会在合适的时机点击每个符合选择器的元素，
        在点击之后还会转储页面 ，并可以指定转储页面前后运行指定的步骤。
        """

        _page = await self._get_page()
        logger.debug('start page scroll down , current page title is {}',
                     await self._get_page_title_ignore_err(_page))

        _last_scroll_down_time = {
            'value': datetime.now().timestamp()
        }

        def random_interval():
            _until = _last_scroll_down_time['value'] + interval * (random.randint(7, 13) / 10.0)
            _last_scroll_down_time['value'] = _until
            return max(0.1, _until - datetime.now().timestamp())

        def random_delta_y():
            return delta_y * (random.randint(3, 16) / 10.0)

        prev_height: Optional[int] = None
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

        _dump_count_ref = {
            'value': 0
        }
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
                on_before_dump_steps = page_click_if_found.get('on_before_dump_steps')
                detail_logd = page_click_if_found.get('detail_logd', False)
                on_after_dump_steps = page_click_if_found.get('on_after_dump_steps')
                on_before_click_steps = page_click_if_found.get('on_before_click_steps')
                on_new_page = page_click_if_found.get('on_new_page')
                close_new_page = page_click_if_found.get('close_new_page')

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

                            if on_before_dump_steps is not None or on_new_page is not None:
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

                                _dump_callback_already_call_ref = {
                                    'value': False
                                }

                                async def _dump_callback_func():
                                    try:
                                        await sleep(0.5)
                                        _dump_count_ref['value'] += 1
                                        await self._dump_page(
                                            f'scroll_click_dump_pre_{_dump_count_ref["value"]}_{_element_key}_')
                                        if on_before_dump_steps is not None:
                                            await self._process_steps(on_before_dump_steps)
                                        await sleep(0.5)
                                        await self._dump_page(
                                            f'scroll_click_dump_aft_{_dump_count_ref["value"]}_{_element_key}_')
                                        await sleep(0.5)
                                        if on_after_dump_steps is not None:
                                            await self._process_steps(on_after_dump_steps)
                                            await sleep(0.5)
                                    finally:
                                        _dump_callback_already_call_ref['value'] = True

                                try:
                                    await self.page_click(
                                        _ctx['locator'],
                                        detail_logd=detail_logd,
                                        on_new_page=on_new_page,
                                        _on_new_page_dump_callback_func=_dump_callback_func,
                                        close_new_page=close_new_page,
                                    )
                                except BaseException as err:
                                    if not is_timeout_error(err):
                                        raise err
                                    if on_before_dump_steps is not None:
                                        logger.debug('Timeout on page_click , but we will checking ...')
                                    else:
                                        logger.warning(
                                            'Timeout on page_click , please set `check_selector_exist_after_click` to avoid it')

                                if not await _check_steps():
                                    logger.debug('check steps return False , continue to next element')
                                    continue
                                await sleep(0.5)
                                if not _dump_callback_already_call_ref['value']:
                                    await _dump_callback_func()

                        except BaseException as err:
                            raise Exception(
                                f'Failed operate , _dump_count = {_dump_count_ref["value"]} , _element_info = {_element_info}') from err

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
                    except BaseException as _err:
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

    @arg_conf('timeout',
              desc=_timeout_desc,
              typ="Timeout")
    @arg_conf('wait_until',
              desc='传递给 `page.go_back` 的可选参数。`',
              type_hint=typing.Optional[
                  Literal["commit", "domcontentloaded", "load", "networkidle"]
              ])
    async def page_go_back(self, **kwargs):
        """
        调用浏览器导航栏返回功能。
        https://camoufox.com/python/usage/#enable_cache
        """
        page = await self._get_page()
        old_url = await self._get_page_url_ignore_err(page)
        logger.debug('page go back , kwargs={} , current url is\n    {}',
                     kwargs, old_url)
        if kwargs.get('timeout') is not None:
            timeout = kwargs.pop('timeout')
        else:
            timeout = self._page_go_back_default_timeout
        res = await page.go_back(timeout=timeout, **kwargs)
        return res

    @arg_conf('tag', desc='标签名')
    async def dump_page_with_uuid(self, tag: str):
        """
        直接调用转储页面。
        转储页面的 tag 为 `f'tag_{tag}_uuid_{uuid4().hex}'`。
        """
        return await self._dump_page(f'tag_{tag}_uuid_{uuid4().hex}')

    @arg_conf('dump_tag_prefix', desc='标签名')
    @arg_conf('before_dump_steps', desc='在 转储页面之前 执行此回调')
    @arg_conf('after_dump_steps', desc='在 转储页面之后 执行此回调')
    @arg_conf('before_dump_break_by_timeout',
              desc='设为 true 后，若在 `before_dump_steps` 回调执行时发生超时异常，则退出循环。')
    @arg_conf('after_dump_break_by_timeout',
              desc='设为 true 后，若在 `after_dump_steps` 回调执行时发生超时异常，则退出循环。')
    async def dump_page_for_each(self, *,
                                 dump_tag_prefix: str,
                                 before_dump_steps: Optional[StepsBlock],
                                 after_dump_steps: Optional[StepsBlock],
                                 before_dump_break_by_timeout: bool = False,
                                 after_dump_break_by_timeout: bool = False,
                                 ):
        """
        不停的执行 `before_dump_steps` 、转储页面、`after_dump_steps` 这三块步骤。
        历次调用的转储页面的 tag 为 `f'{dump_tag_prefix}_{count}'`。
        """
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

    @arg_conf('run_steps', desc='在 `args` 数组包含当前页面的 url 时，执行此回调。')
    @arg_conf('else_steps', desc='在 `args` 数组不包含当前页面的 url 时，执行此回调。')
    async def if_url_is(self, *args, run_steps: StepsBlock = None, else_steps: StepsBlock = None):
        """
        如果 `*args` 包含当前页面的 url，则执行 `run_steps` 块，否则执行 `else_steps`块。
        """
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

    async def page_close(self, *, _page: Optional[Page] = None):
        """
        关闭当前页面。
        """
        if _page is None:
            _page = await self._get_page()
        await self.switch_page(-2)
        await self.sleep(500)
        logger.debug('Close page : {}', _page)
        await _page.close()
        await self.sleep(500)
        await self.switch_page(-1)

    @arg_conf('to', desc="""
要切换到的页面序号。可以传入 `"default"` 或 整数。

- 传入 `"default"` 切换至 启动浏览器时 `--url` 中的标签页。
- 传入 0或正整数 时，切换至对应下标的标签页。超出则切换到最后一个。
- 传入 负整数 时，切换至对应下标的标签页。超出则切换到最后一个。
""")
    async def switch_page(self, to: Union[int, Literal['default'], Page]):
        """
        切换当前页面指针。
        """
        logger.debug('switch page wait start')
        await self.sleep(3000)
        logger.debug('switch page wait end , we check out to page {}', to)
        retry_count = 0
        while True:
            try:
                await sleep(1)
                if to == 'default':
                    res = self._b_page
                elif isinstance(to, int):
                    logger.debug('switch page to int value , current all pages :\n{}',
                                 ''.join(map(lambda it: f'\n    {it}', self._browser_context.pages)))
                    len_all_pages = self._browser_context.pages.__len__()
                    res = self._browser_context.pages[
                        len_all_pages - 1 if to > 0 and to >= len_all_pages else -1
                        if to < 0 and abs(to) > len_all_pages else to
                    ]
                elif isinstance(to, Page):
                    res = to
                else:
                    raise ValueError(f'Invalid param {to}')
                logger.debug('switch page to : {}', res)
                _old_page = await self._get_page()
                from_title = await self._get_page_title_ignore_err(_old_page)
                to_title_prev = await self._get_page_title_ignore_err(res)
                logger.debug('Start switch page {} : from {} , to title on create {}',
                             to,
                             from_title,
                             to_title_prev,
                             )
                await self.page_wait_loaded(page=res)
                to_title_cur = await self._get_page_title_ignore_err(res)
                await self._set_page(res)
                logger.debug('Finish switch page {} : from {} , to title ( {} >>> {} )',
                             to,
                             from_title,
                             to_title_prev,
                             to_title_cur)
                await sleep(1)
                while (await self._get_page()).url != res.url:
                    logger.warning('It seems like ref not change , recall again')
                    retry_count += 1
                    continue
                if res is not None:
                    return res
                else:
                    raise ValueError('Why res is None')
            except BaseException as err:
                if is_timeout_error(err):
                    if retry_count < 3:
                        retry_count += 1
                        logger.debug(
                            'switch page timeout ? maybe system blocking ? retry_count is {} ,we will retry . error is {}',
                            retry_count, err)
                        continue
                raise

    @arg_conf('title', desc="""弹出窗口标题""")
    @arg_conf('message', desc="""弹出窗口正文""")
    async def gui_confirm(self, *, title: str, message: str):
        """
        弹出gui弹窗，请求程序员确认。常用于在网站登录情景下，请求程序员手动操作浏览器并在完成后点击确认。
        等待的过程中程序会暂停执行。
        """
        from libiancrawlers.app_util.gui_util import gui_confirm
        return await gui_confirm(title=title, message=message)

    @arg_conf('timeout', desc=_timeout_desc, typ="Timeout")
    @arg_conf('run_steps', desc="""只有在执行此块时，若发生下载事件才会被捕获。""")
    @arg_conf('dump_csv', desc="""如果此值为 true 且下载的文件是 csv 文件，则转储 csv 内容对象。""")
    @arg_conf('dump_obj_meta', desc="""如果发生转储对象，此值将会携带在转储的对象中。""")
    async def expect_download(self, *,
                              timeout: float,
                              run_steps: StepsBlock,
                              dump_obj_meta: JSON = None,
                              dump_csv: bool = False, ):
        """
        处理浏览器下载事件。
        """
        logger.debug('expect download')
        _page = await self._get_page()
        async with _page.expect_download(timeout=timeout) as _download_info:
            logger.debug('expect download entry scope')
            if run_steps is not None:
                logger.debug('expect download run steps')
                await self._process_steps(run_steps)
                logger.debug('expect download end steps')
        logger.debug('expect download out scope')
        _download = await _download_info.value
        logger.debug(
            'expect download done promise:\n    suggested_filename is {}\n    url is {}\n    page title is {}',
            _download.suggested_filename,
            _download.url,
            await self._get_page_title_ignore_err(_download.page))
        current_download_count = self._next_download_count()
        logger.debug('current_download_count is {}', current_download_count)
        save_file_path = os.path.join(self._download_storage_path,
                                      f'{current_download_count}_{_download.suggested_filename}')
        logger.debug('download path info:\n    self._download_storage_path is {}\n    save_file_path is {}',
                     self._download_storage_path, save_file_path)
        logger.info('start download : {}', save_file_path)
        await _download.save_as(save_file_path)
        logger.debug('finish download')
        save_file_name = os.path.basename(save_file_path)
        save_file_name_prefix, save_file_name_ext = os.path.splitext(save_file_name)
        if save_file_name_ext == '.csv' and dump_csv:
            from libiancrawlers.crawlers.smart_crawl.dump_obj_util import parse_csv
            await self._dump_obj(f'downloaded_csv_{current_download_count}', {
                'meta': dump_obj_meta,
                'data': await parse_csv(save_file_path),
            })

    @arg_conf('run_steps', desc="""循环执行此块。""")
    async def for_each(self, *,
                       run_steps: StepsBlock):
        """
        不停的执行 `run_steps` 块。
        """
        while True:
            await self._process_steps(run_steps)

    @arg_conf('probability', desc="执行 `if_steps` 块的概率，介于 [0,1] 之间。")
    @arg_conf('if_steps', desc="""`probability` 概率生效时，执行此块""")
    @arg_conf('else_steps', desc="""`probability` 概率未生效时，执行此块""")
    async def random(self, *,
                     probability: Union[float, str], if_steps: StepsBlock = None, else_steps: StepsBlock = None):
        """
        生成 `[0,1)` 之间的随机数，如果此数小于等于 `probability` 则执行 `if_steps` 块，否则执行 `else_steps` 块。
        """
        if isinstance(probability, str):
            probability = float(probability)
        value = random.random()
        logger.debug('Random result : value is {} , probability is {} , value {} probability',
                     value, probability, '==' if value == probability else '>' if value > probability else '<')
        if value <= probability:
            if if_steps is not None:
                await self._process_steps(if_steps)
        else:
            if else_steps is not None:
                await self._process_steps(else_steps)

    @arg_conf('key', desc="全局计数器 key 。调用此函数后，该计数器 +=1 。")
    @arg_conf('div', desc="""除数""")
    @arg_conf('expect_mod', desc="""
当此数等于 全局计数器值 除以 `div` 的余数 时，执行 `if_steps` 块; 否则执行 `else_steps 块。
""")
    @arg_conf('before_steps', desc="不论 `expect_mod` 是否匹配，该块都会在 `if_steps` 和 `else_steps` 块之前被执行。")
    @arg_conf('if_steps', desc="""`expect_mod` 等于 全局计数器值 除数 `div` 的余数 时，此块执行。""")
    @arg_conf('else_steps', desc="""`expect_mod` 不等于 全局计数器值 除数 `div` 的余数 时，此块执行。""")
    @arg_conf('after_steps', desc="不论 `expect_mod` 是否匹配，该块都会在 `if_steps` 和 `else_steps` 块之后被执行。")
    @arg_conf('run_if_steps_on_error',
              desc="""设为 true 时，如果发生了错误，会仅运行 `if_steps` 块之后（其他块都不运行）再抛出异常。""")
    async def every_times(self, *,
                          key: str,
                          div: int,
                          expect_mod=0,
                          before_steps: StepsBlock = None,
                          if_steps: StepsBlock = None,
                          else_steps: StepsBlock = None,
                          after_steps: StepsBlock = None,
                          run_if_steps_on_error=False):
        """
        一个根据该函数运行次数来执行不同代码块的工具函数。
        每调用一次此函数，`key`所对应的全局计数器 +=1。
        当全局计数器的值除以 `div` 的余数等于 `expect_mod` 时，
        运行 `if_steps` 块，否则执行 `else_steps` 块。
        """
        try:
            if before_steps is not None:
                await self._process_steps(before_steps)
            k = f'every_times__{key}'
            self._global_counter[k] += 1
            count = self._global_counter[k]
            logger.debug('Every times status: count={}, divmod(c, div)={}, expect_mod={}',
                         count,
                         divmod(count, div),
                         expect_mod)
            if divmod(count, div)[1] == expect_mod:
                if if_steps is not None:
                    await self._process_steps(if_steps)
            else:
                if else_steps is not None:
                    await self._process_steps(else_steps)

            if after_steps is not None:
                await self._process_steps(after_steps)
        except BaseException as err:
            if run_if_steps_on_error:
                logger.warning('Error on every times , run if_steps , err is {}', err)
                if if_steps is not None:
                    await self._process_steps(if_steps)
            else:
                logger.warning('Error on every times, err is {}', err)
            raise


StepMemberMetaType = TypedDict('StepMemberMetaType', {
    'py_hint': Optional[str],
    'conf_type': Optional[StepsApiArgConfType],
    'json_schema': Union[dict, list],
})

StepMemberMetaArg = TypedDict('StepMemberMetaArg', {
    'name': str,
    'index': int,
    'type': StepMemberMetaType,
    'desc': str,
    'require': bool,
    'default': Optional[str],
})

StepMemberMetaKw = TypedDict('StepMemberMetaKw', {
    'name': str,
    'type': StepMemberMetaType,
    'desc': str,
    'require': bool,
    'default': typing.Any,
})

StepMemberMeta = TypedDict('StepMemberMeta', {
    'name': str,
    'desc': str,
    'varargs': bool,
    'varargs_types': Optional[Union[StepMemberMetaType, List[StepMemberMetaType]]],
    'args': List[StepMemberMetaArg],
    'args_min': Optional[int],
    'args_max': Optional[int],
    'kwargs': List[StepMemberMetaKw],
    'kwargs_min': Optional[int],
    'kwargs_max': Optional[int],
})


def _trim_desc(text: Optional[str], *, lstrip=False):
    if text is None or text.strip() == '':
        return None
    return '\n'.join(map(lambda it: it.strip() if lstrip else it.rstrip(), text.strip().split('\n')))


def _to_json_schema(*,
                    _conf_type: Optional[StepsApiArgConfType] = None,
                    _desc: Optional[str] = None,
                    _hint: Optional[typing.Any] = None,
                    _args_hint_parent: Optional[List[typing.Any]] = None,
                    _examples: Optional[List[JSON]] = None) -> typing.Any:
    _examples_dict = dict(examples=_examples) if _examples is not None and len(_examples) > 0 else dict()
    try:
        if _conf_type is not None:
            if _conf_type == 'Timeout':
                return {
                    'type': 'integer',
                    "minimum": 33,
                    "maximum": 10 * 60 * 1000,
                    "description": '超时时间，单位为毫秒。' if _desc is None else _desc
                }
            if _conf_type == 'StepsBlock':
                return {
                    "$ref": f"#/definitions/{_conf_type}",
                    **(dict() if _desc is None else dict(description=_desc))
                }
            if _conf_type == 'str':
                return {
                    'type': 'string',
                }
            if _conf_type == 'float>=0':
                return {
                    'type': 'number',
                    "minimum": 0,
                }
            raise ValueError(f'Invalid _conf_type {_conf_type}')

        def _is_class(h):
            return _hint is None or isinstance(h, type)

        # print('_is_class(_hint)', _is_class(_hint), _hint)
        if _is_class(_hint):
            _hint: typing.Any = _hint
            if _hint is None or issubclass(_hint, type(None)):
                return {
                    'type': 'null',
                    **(dict() if _desc is None else dict(description=_desc)),
                    **_examples_dict,
                }
            if issubclass(_hint, str):
                return {
                    'type': 'string',
                    **(dict() if _desc is None else dict(description=_desc)),
                    **_examples_dict,
                }
            if issubclass(_hint, bool):
                return {
                    'type': 'boolean',
                    **(dict() if _desc is None else dict(description=_desc)),
                    **_examples_dict,
                }
            if issubclass(_hint, int):
                return {
                    'type': 'integer',
                    **(dict() if _desc is None else dict(description=_desc)),
                    **_examples_dict,
                }
            if issubclass(_hint, float):
                return {
                    'type': 'number',
                    **(dict() if _desc is None else dict(description=_desc)),
                    **_examples_dict,
                }
            if issubclass(_hint, list):
                if _args_hint_parent is None:
                    return {
                        "type": "array",
                        **(dict() if _desc is None else dict(description=_desc))
                    }
                elif len(_args_hint_parent) != 1:
                    raise ValueError('why _args_hint length not 1')
                else:
                    _res = _to_json_schema(_hint=_args_hint_parent[0])
                    if _res is None:
                        return {
                            "type": "array",
                            **(dict() if _desc is None else dict(description=_desc)),
                            **_examples_dict,
                        }
                    else:
                        return {
                            "type": "array",
                            **(dict() if _desc is None else dict(description=_desc)),
                            "items": {
                                "type": _res
                            },
                            **_examples_dict,
                        }
            if issubclass(_hint, tuple):
                return {
                    "type": "array",
                    **(dict() if _desc is None else dict(description=_desc)),
                    "prefixItems": list(
                        filter(
                            lambda it: it is not None,
                            map(
                                lambda h: _to_json_schema(_hint=h),
                                _args_hint_parent
                            )
                        )
                    ),
                    **_examples_dict,
                }
            origin = typing.get_origin(_hint)
            _args_hint = [*typing.get_args(_hint)]
            if issubclass(_hint, collections.abc.Mapping):
                try:
                    _hint.__annotations__.items()
                    _annotations_in_hint = True
                except BaseException as _:
                    _annotations_in_hint = False
                if _annotations_in_hint:
                    # noinspection PyUnresolvedReferences
                    _required = list(_hint.__required_keys__)

                    return {
                        "type": "object",
                        **(dict() if _desc is None else dict(description=_desc)),
                        "additionalProperties": False,
                        "properties": {k: _to_json_schema(_hint=v) for k, v in _hint.__annotations__.items() \
                                       if _to_json_schema(_hint=v) is not None},
                        "required": _required,
                        **_examples_dict,
                    }
                else:
                    return {
                        "type": "object",
                        **(dict() if _desc is None else dict(description=_desc)),
                        **_examples_dict,
                    }
            if str(_hint.__module__).startswith('playwright.') or issubclass(_hint, collections.abc.Callable):
                return None
            raise ValueError(
                f'unknown type , type(_hint) is {type(_hint)} , is_base_type(_hint) is true , origin is {origin} , _args_hint is {_args_hint} , _args_hint_parent is {_args_hint_parent} , _hint is {_hint} , ')
        else:
            origin = typing.get_origin(_hint)
            _args_hint = [*typing.get_args(_hint)]
            if origin is typing.Union:
                return {
                    **(dict() if _desc is None else dict(description=_desc)),
                    'anyOf': list(
                        filter(
                            lambda it: it is not None,
                            map(
                                lambda _hint_arg: _to_json_schema(_conf_type=None, _hint=_hint_arg),
                                _args_hint
                            )
                        )
                    ),
                    **_examples_dict,
                }
            if origin is typing.Literal:
                return {
                    "enum": _args_hint,
                    **(dict() if _desc is None else dict(description=_desc)),
                    **_examples_dict,
                }
            if origin is typing.Annotated:
                _desc2: Optional[str] = None
                for item in _args_hint[1:]:
                    if isinstance(item, str):
                        _desc2 = _trim_desc(item)
                return _to_json_schema(_hint=_args_hint[0], _desc=_desc2)
            if _is_class(origin):
                return _to_json_schema(_hint=origin, _args_hint_parent=_args_hint)
            if isinstance(_hint, typing.ForwardRef):
                return {
                    "$ref": f"#/definitions/{_hint.__forward_arg__}",
                    **(dict() if _desc is None else dict(description=_desc)),
                    **_examples_dict,
                }
            raise ValueError(
                f'unknown type , type(_hint) is {type(_hint)} , is_base_type(_hint) is false , origin is {origin} , _args_hint is {_args_hint} , , _args_hint_parent is {_args_hint_parent} , _hint is {_hint}')
    except BaseException as err:
        raise ValueError(
            f'to_json_schema failed , type(_hint) is {type(_hint)} , _conf_type is {_conf_type} , _hint is {_hint} , _args_hint_parent is {_args_hint_parent} , _desc is {_desc}') from err


def generate_steps_api_documents():
    import inspect
    members_meta_list: List[StepMemberMeta] = []
    warns: List[str] = []
    for member in inspect.getmembers(StepsApi):
        try:
            member_name, member_obj = member
            if member_name.startswith("_") or not inspect.isfunction(member_obj):
                continue
            print('---------------------')
            print('member          :', member)
            sig = inspect.signature(member_obj)
            print('sig.parameters  :', sig.parameters)
            hints = typing.get_type_hints(member_obj)
            print('hints           :', hints)
            argspec = inspect.getfullargspec(member_obj)
            print('argspec         :', argspec)
            # noinspection PyUnresolvedReferences
            arg_confs: List[StepsApiArgConf] = _arg_conf_map.get(member_name, [])
            print('arg_confs       :', arg_confs)

            func_doc = _trim_desc(member_obj.__doc__, lstrip=True)
            if func_doc is None:
                raise ValueError('doc empty')

            arg_list: List[StepMemberMetaArg] = []
            kwarg_list: List[StepMemberMetaKw] = []

            _func_conf = _func_conf_map.get(member_name)

            _self_exist = False
            _existed_param_names: typing.Set[str] = set()
            for index_with_self, param_entry in enumerate(sig.parameters.items()):
                try:
                    param_name, param_def = param_entry
                    _existed_param_names.add(param_name)
                    if param_name == 'self':
                        if index_with_self != 0:
                            raise ValueError('self should at 0 index')
                        _self_exist = True
                        continue
                    if param_name.startswith('_'):
                        continue
                    if argspec.varargs is not None and param_name == argspec.varargs:
                        continue
                    if argspec.varkw is not None and param_name == argspec.varkw:
                        continue

                    _require = param_def.default is inspect.Parameter.empty
                    _default = param_def.default if param_def.default is not inspect.Parameter.empty else None
                    _examples: List[JSON] = []
                    if _default is not None:
                        _examples.append(_default)
                    _hint = hints.get(param_name)

                    _type_py_hint = None if _hint is None else f'{_hint}'
                    steps_api_conf: Optional[StepsApiArgConf] = None
                    for _steps_api_conf in arg_confs:
                        if _steps_api_conf['name'] == param_name:
                            steps_api_conf = _steps_api_conf
                    if steps_api_conf is not None:
                        if steps_api_conf['hide']:
                            if _require:
                                raise ValueError(
                                    f'require is {_require} but hide set True , steps_api_conf is {steps_api_conf}')
                            continue
                    _conf_type: Optional[StepsApiArgConfType] = None if steps_api_conf is None else \
                        steps_api_conf['type']
                    _conf_type_hint = None if steps_api_conf is None else steps_api_conf['type_hint']
                    _conf_desc = None if steps_api_conf is None else steps_api_conf['desc']
                    _conf_examples = None if steps_api_conf is None else steps_api_conf['examples']
                    if _conf_examples is not None:
                        for _conf_example in _conf_examples:
                            _examples.append(_conf_example)

                    if _hint is None and _conf_type is None and _conf_type_hint is None:
                        if param_def.default is not inspect.Parameter.empty and param_def.default is not None:
                            _hint = type(param_def.default)
                        else:
                            raise ValueError(f'Missing hint , default is {param_def.default}')

                    _desc: Optional[str] = None
                    for __desc in [_conf_desc]:
                        _desc = __desc
                    _desc = _trim_desc(_desc)
                    if _desc is None:
                        warns.append(f'⚠️ WARN: {member_name}.{param_name} desc empty')

                    _json_schema: typing.Any = _to_json_schema(_conf_type=_conf_type,
                                                               _hint=_conf_type_hint if _conf_type_hint is not None else _hint,
                                                               _desc=_desc,
                                                               _examples=_examples)
                    _type: StepMemberMetaType = {
                        'py_hint': _type_py_hint,
                        'conf_type': _conf_type,
                        'json_schema': _json_schema
                    }

                    if param_name in argspec.args:
                        _arg: StepMemberMetaArg = {
                            'name': param_name,
                            'index': argspec.args.index(param_name) - (1 if _self_exist else 0),
                            'type': _type,
                            'desc': _desc,
                            'require': _require,
                            'default': _default,
                        }
                        arg_list.append(_arg)
                    else:
                        _kwarg: StepMemberMetaKw = {
                            'name': param_name,
                            'type': _type,
                            'desc': _desc,
                            'require': _require,
                            'default': _default,
                        }
                        kwarg_list.append(_kwarg)
                except BaseException as err:
                    raise ValueError(
                        f'failed parse param , index_with_self = {index_with_self} , param_entry={param_entry}') from err

            for ac in arg_confs:
                ac_name = ac['name']
                if ac_name in _existed_param_names:
                    continue
                if argspec.varkw is None:
                    raise ValueError('disallow arg_conf on no kwargs', ac)
                _desc = ac['desc']
                _desc = _trim_desc(_desc)
                if _desc is None:
                    warns.append(f'⚠️ WARN: {member_name}.{ac_name} desc empty')
                _conf_type = ac['type']
                _json_schema = _to_json_schema(_conf_type=_conf_type, _desc=_desc, _hint=ac['type_hint'])
                _type: StepMemberMetaType = {
                    'py_hint': f'{ac["type_hint"]}',
                    'conf_type': _conf_type,
                    'json_schema': _json_schema
                }
                kw: StepMemberMetaKw = {
                    'name': ac_name,
                    'type': _type,
                    'desc': _desc,
                    'require': False,
                    'default': None,
                }
                kwarg_list.append(kw)

            varargs = argspec.varargs is not None
            if not varargs or _func_conf is None or _func_conf['varargs_conf_types'] is None:
                _vararg_types = None
                _count_vararg_types = 0
            else:
                def _to_meta_type(_func_conf_type: StepsApiArgConfType) -> StepMemberMetaType:
                    return {
                        'py_hint': None,
                        'conf_type': _func_conf_type,
                        'json_schema': _to_json_schema(_conf_type=_func_conf_type),
                    }

                if isinstance(_func_conf['varargs_conf_types'], list):
                    _vararg_types = [
                        _to_meta_type(_func_conf_type_item) \
                        for _func_conf_type_item in _func_conf['varargs_conf_types']
                    ]
                    _count_vararg_types = len(_vararg_types)
                else:
                    _vararg_types = _to_meta_type(_func_conf['varargs_conf_types'])
                    _count_vararg_types = 1
            if not varargs and _count_vararg_types > 0:
                raise ValueError('assert _count_vararg_types == 0 if not varargs')

            _args_min = len([1 for item in arg_list if item['require']]) + (
                0 if _func_conf is None or _func_conf['varargs_min'] is None else _func_conf['varargs_min']
            )
            meta: StepMemberMeta = {
                'name': member_name,
                'desc': func_doc,
                'varargs': varargs,
                'varargs_types': _vararg_types,
                'args_min': _args_min,
                'args_max': len(arg_list) if not varargs else None,
                'args': arg_list,
                'kwargs': kwarg_list,
                'kwargs_min': None,
                'kwargs_max': None,
            }
            print('meta           :', json.dumps(meta, indent=2, ensure_ascii=False))
            members_meta_list.append(meta)
        except BaseException as err:
            raise ValueError(f'failed generate field {member}') from err
    members_meta_list.sort(key=lambda it: it['name'])
    _schema = {
        "$id": "libian_crawler/main/schema/v2",
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "oneOf": [
            {
                "type": "object",
                "properties": {
                    "steps": {
                        "type": "array",
                        "items": {
                            "$ref": "#/definitions/Step"
                        }
                    }
                }
            }
        ],
        "definitions": {
            "Step": {
                "oneOf": [
                    {
                        "description": "`continue` 指令不会起任何作用，通常作为回调块的占位符使用，以代替回调块的默认处理。\n\n比如，很多时候可以在 on_timeout 回调命令中使用，来阻止默认的抛出超时异常的行为。\n\n```json\n{\n  fn: \"page_click\",\n  args: [\n    \".cpCloseIcon\",\n  ],\n  on_timeout_steps: \"continue\"\n}\n```",
                        "type": "string",
                        "enum": [
                            "continue"
                        ]
                    },
                    {
                        "type": "string",
                        "enum": [
                            "break"
                        ]
                    },
                    {
                        "type": "string",
                        "enum": [
                            "stop"
                        ],
                        "description": "`stop` 指令会通过抛出异常终止爬虫。"
                    },
                    {
                        "type": "string",
                        "enum": [
                            "debug"
                        ],
                        "description": "仅当命令行 `--debug` 参数启用时，`stop` 指令会暂停爬虫执行，直到接收到确认命令（例如在 gui 界面确认或退出）。"
                    },
                    {
                        "description": "TODO: 这个功能尚未实现",
                        "type": "string",
                        "enum": [
                            "enable_devtool"
                        ]
                    },
                    *[
                        {
                            "description": meta['desc'],
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "fn",
                                *(['args'] if meta['args_min'] is not None and meta['args_min'] > 0 else []),
                                *(['kwargs'] if meta['kwargs_min'] is not None and meta['kwargs_min'] > 0 else [])
                            ],
                            "properties": {
                                "fn": {
                                    "type": "string",
                                    "enum": [
                                        meta['name']
                                    ]
                                },
                                "args": {
                                    "type": "array",
                                    **({
                                           "minItems": meta['args_min']
                                       } if meta['args_min'] is not None else {}),
                                    **({
                                           "maxItems": meta['args_max']
                                       } if meta['args_max'] is not None else {}),
                                    "additionalItems": meta['varargs'],
                                    **(
                                        {
                                            "prefixItems": [arg["type"]["json_schema"] for arg in meta["args"]]
                                        } if meta["args"] is not None and len(meta["args"]) > 0 else {}
                                    ),
                                    **(
                                        {
                                            "items": vararg["json_schema"] for vararg in meta["varargs_types"]
                                        } if isinstance(meta["varargs_types"], list) else {
                                            "items": meta["varargs_types"]["json_schema"]
                                        } if meta["varargs_types"] is not None else {
                                        }
                                    )
                                },
                                "kwargs": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    **({
                                           "minProperties": meta['kwargs_min'],
                                       } if meta['kwargs_min'] is not None else {}),
                                    **({
                                           "maxProperties": meta['kwargs_max'],
                                       } if meta['kwargs_max'] is not None else {}),
                                    "required": [
                                        kw["name"] for kw in meta['kwargs'] if kw["require"]
                                    ],
                                    "properties": {
                                        kw['name']: kw['type']['json_schema'] for kw in meta['kwargs']
                                    }
                                },
                                "on_success_steps": {
                                    "$ref": "#/definitions/StepsBlock"
                                },
                                "on_timeout_steps": {
                                    "$ref": "#/definitions/StepsBlock"
                                },
                                "description": {
                                    "type": "string"
                                }
                            }
                        } for meta in members_meta_list
                    ]
                ]
            },
            "StepsBlock": {
                "oneOf": [
                    {
                        "$ref": "#/definitions/Step"
                    },
                    {
                        "type": "array",
                        "items": {
                            "$ref": "#/definitions/Step"
                        }
                    }
                ]
            },
            "YMDParam": {
                "type": "array",
                "prefixItems": [
                    {
                        "type": "integer",
                    }, {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 12,
                    }, {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 31,
                    }
                ]
            },
            "JSON": {
                "type": ["number", "string", "boolean", "object", "array", "null"]
            },
            "OnLocatorBlockItem": {
                "type": "object",
                "required": [
                    "fn",
                ],
                "minProperties": 1,
                "maxProperties": 3,
                "properties": {
                    "fn": {
                        "type": "string",
                        "enum": [
                            func.__name__ for func in _on_locator_allow_methods
                        ]
                    },
                    "args": {
                        "type": "array",
                    },
                    "kwargs": {
                        "type": "object",
                    }
                }
            },
            "OnLocatorBlock": {
                "oneOf": [
                    {
                        "$ref": "#/definitions/OnLocatorBlockItem"
                    },
                    {
                        "type": "array",
                        "items": {
                            "$ref": "#/definitions/OnLocatorBlockItem"
                        }
                    }
                ]
            },
            "PageScrollDownPageClickIfFound": {
                "type": "object",
            }
        }
    }
    _schema_file_path = os.path.abspath(os.path.join('steps', 'schemas', 'v2.json'))
    with open(_schema_file_path, mode='wt', encoding='utf-8') as f:
        json.dump(_schema, f, ensure_ascii=False, indent=2)
    print('INFO: Output to schema file :', _schema_file_path)
    from jsonschema import validate
    for filename in os.listdir(os.path.abspath(os.path.join('steps'))):
        if not filename.endswith('.json'):
            continue
        with open(os.path.join('steps', filename), mode='rt', encoding='utf-8') as f:
            step_obj = json.load(f)
        try:
            validate(step_obj, _schema)
            warns.append(f'✅ INFO: success validate file {filename}')
        except BaseException as err:
            warns.append('\n    '.join(f'❌ ERROR: validate failed for file {filename} : {err}'.splitlines()[0:10]))
    for warn in warns:
        print(warn)
    with open(os.path.abspath(os.path.join('docs', 'develop', 'crawler', 'step_api_metas.json')), mode='wt',
              encoding='utf-8') as f:
        json.dump(members_meta_list, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    pass
