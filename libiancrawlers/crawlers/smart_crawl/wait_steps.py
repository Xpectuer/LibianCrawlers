# -*- coding: UTF-8 -*-
import asyncio
from datetime import datetime
import random
from typing import Optional, Literal, Any, TypedDict, Callable, Awaitable

from aioify import aioify
from loguru import logger
from playwright.async_api import Page

from libiancrawlers.util.coroutines import sleep, blocking_func


class SmartCrawlSignal(BaseException):
    pass


class SmartCrawlStopSignal(SmartCrawlSignal):
    pass


PageRef = TypedDict('PageRef', {'value': Page, })


def _create_wait_steps_func_map(*, b_page: Page, _dump_page: Callable[[str, Page], Awaitable]):
    page_ref: PageRef = {'value': b_page}

    async def page_mouse_move(*args, **kwargs):
        await asyncio.wait_for(page_ref['value'].mouse.move(*args, **kwargs), timeout=3)

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

    async def page_any_frame(*, func, timeout: Optional[float], err_msg: str, suc_msg_template: str):
        start_at = datetime.utcnow().timestamp() * 1000.0
        last_timeout_err = None
        out_loop = True
        while out_loop:
            if start_at + timeout < datetime.utcnow().timestamp() * 1000.0:
                break
            for frame in page_ref['value'].frames:
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
        if last_timeout_err is None:
            raise TimeoutError(err_msg)
        else:
            raise TimeoutError(err_msg) from last_timeout_err

    async def page_wait_for_selector_in_any_frame(selector: str, *, timeout: Optional[float], **kwargs):
        from playwright.async_api import Frame

        async def fn(*, frame: Frame, loop_timeout: float):
            return await frame.wait_for_selector(selector, timeout=loop_timeout, **kwargs)

        return await page_any_frame(func=fn, timeout=timeout, err_msg=f'not found selector {selector} in any frame',
                                    suc_msg_template=f'success found selector {selector} in frame {{}} , result is {{}}')

    async def page_scroll_down(*, delta_y=100.0, interval=1.0):

        def random_interval():
            return interval * (random.randint(3, 16) / 10.0)

        def random_delta_y():
            return delta_y * (random.randint(3, 16) / 10.0)

        prev_height = None
        prev_height_bottom = {
            'value': -1
        }
        retry_scroll_down = 0
        retry_scroll_up = 0
        while True:
            await page_ref['value'].mouse.wheel(delta_x=0, delta_y=random_delta_y())
            curr_height = await page_ref['value'].evaluate('(window.innerHeight + window.scrollY)')
            if not prev_height:
                prev_height = curr_height
                await sleep(random_interval())
            elif prev_height == curr_height:
                if retry_scroll_down < 5:
                    retry_scroll_down += 1
                    logger.debug('retry_scroll_down {}', retry_scroll_down)
                    continue

                retry_scroll_down = 0

                async def scroll_up():
                    await sleep(0.4)
                    prev_height_bottom['value'] = prev_height
                    for i in range(0, 5):
                        await page_ref['value'].mouse.wheel(delta_x=0, delta_y=-random_delta_y())
                        await sleep(random_interval())
                    logger.debug('after test scroll up if on bottom')
                    await sleep(0.4)
                    try:
                        await page_ref['value'].wait_for_load_state('networkidle', timeout=3)
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
                    if retry_scroll_up >= 3:
                        logger.debug('retry_scroll_up {} break', retry_scroll_up)
                        break
                    else:
                        await scroll_up()
                        retry_scroll_up += 1

                logger.debug('retry_scroll_up {}', retry_scroll_up)
                continue
            else:
                prev_height = curr_height
                await sleep(random_interval())

    async def page_click(selector: str, **kwargs):
        if kwargs.get('button') is None:
            kwargs['button'] = 'middle'
        if kwargs.get('delay') is None:
            kwargs['delay'] = random.randint(170, 340)
        logger.debug('page click : selector={} , kwargs={}', selector, kwargs)
        await page_ref['value'].click(selector, **kwargs)

    from libiancrawlers.app_util.gui_util import gui_confirm

    async def dump_page(dump_tag: str):
        return await _dump_page(dump_tag, page_ref['value'])

    fn_map = {
        'sleep': sleep,
        'logd': logd,
        'logi': logi,
        'logw': logw,
        'loge': loge,
        'dump_page': dump_page,
        'gui_confirm': gui_confirm,
        'page_wait_for_load_state': page_ref['value'].wait_for_load_state,
        'page_bring_to_front': page_ref['value'].bring_to_front,
        'page_wait_for_function': page_ref['value'].wait_for_function,
        'page_mouse_move': page_mouse_move,
        'page_type': page_ref['value'].type,
        'page_click': page_click,
        'page_wait_for_selector': page_ref['value'].wait_for_selector,
        'page_wait_for_selector_in_any_frame': page_wait_for_selector_in_any_frame,
        'page_scroll_down': page_scroll_down,
    }

    return fn_map


def _random_mouse_move_json():
    return {
        'fn': 'page_mouse_move',
        'args': [random.randint(100, 1600), random.randint(100, 1600)],
        'kwargs': {
            'steps': 2
        },
        'on_timeout_steps': 'continue',
    }


def _default_wait_steps():
    return [
        {
            'fn': 'page_bring_to_front',
        }, {
            'fn': 'page_wait_for_load_state',
            'args': ['networkidle'],
            'kwargs': {
                'timeout': 5000,
            },
            'on_timeout_steps': 'continue',
        }, {
            'fn': 'page_wait_for_load_state',
            'args': ['domcontentloaded'],
            'kwargs': {
                'timeout': 5000,
            },
            'on_timeout_steps': 'continue',
        }, {
            'fn': 'page_wait_for_load_state',
            'args': ['load'],
            'kwargs': {
                'timeout': 5000,
            },
            'on_timeout_steps': 'continue',
        },
        *([
            _random_mouse_move_json(),
            _random_mouse_move_json(),
        ]),
    ]


if __name__ == '__main__':
    pass
