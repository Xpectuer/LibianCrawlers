# -*- coding: UTF-8 -*-
import asyncio
from datetime import datetime
import random
from typing import Optional, Literal, Any, TypedDict, Callable, Awaitable, Union

from aioify import aioify
from loguru import logger
from playwright.async_api import Page, BrowserContext

from libiancrawlers.util.coroutines import sleep, blocking_func


class SmartCrawlSignal(BaseException):
    pass


class SmartCrawlStopSignal(SmartCrawlSignal):
    pass


PageRef = TypedDict('PageRef', {'value': Page, })


def _create_wait_steps_func_map(*,
                                b_page: Page,
                                browser_context: BrowserContext,
                                _dump_page: Callable[[str, Page], Awaitable]):
    page_ref: PageRef = {'value': b_page}

    async def switch_page(to: Union[int, Literal['default']]):
        await sleep(1)
        if to == 'default':
            res = b_page
        elif isinstance(to, int):
            res = browser_context.pages[to]
        else:
            raise ValueError(f'Invalid param {to}')
        from_title = await page_ref['value'].title()
        to_title_prev = await res.title()
        logger.debug('Start switch page {} : from {} , to title on create {}',
                     to,
                     from_title,
                     to_title_prev,
                     )
        await page_wait_loaded(page=res)
        to_title_cur = await res.title()
        logger.debug('Finish switch page {} : from {} , to title ( {} >>> {} )',
                     to,
                     from_title,
                     to_title_prev,
                     to_title_cur,
                     )
        page_ref['value'] = res
        await sleep(1)
        logger.debug("page_ref['value'] = {}", page_ref['value'])

    async def page_wait_loaded(*, page: Page = None):
        if page is None:
            page = page_ref['value']
        from libiancrawlers.util.exceptions import is_timeout_error
        await page.bring_to_front()
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
        await page.bring_to_front()

    async def page_random_mouse_move():
        box = await page_ref['value'].locator('body').bounding_box(timeout=3000)
        viewport_size = page_ref['value'].viewport_size
        if box is None:
            raise ValueError("Can't get body bounding box")
        logger.debug('on mouse random move , box is {} , viewport_size is {}', box, viewport_size)
        try:
            await page_mouse_move(
                *[
                    random.randint(
                        min(max(30, int(box['x'])), viewport_size['width'] - 30),
                        min(max(30, int(box['x'] + box['width'])), viewport_size['width'] - 30)
                    ),
                    random.randint(
                        min(max(30, int(box['y'])), viewport_size['height'] - 30),
                        min(max(30, int(box['y'] + box['height'])), viewport_size['height'] - 30)
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

        await asyncio.wait_for(page_ref['value'].mouse.move(*args, steps=steps, **kwargs), timeout=timeout)

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

    async def page_scroll_down(*, delta_y=200.0, interval=1.0, max_height: Optional[float] = 40000):
        logger.debug('start page scroll down , current page title is {}', await page_ref['value'].title())

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
                continue
            if max_height is not None and prev_height > max_height:
                logger.debug('break scroll down because prev_height({}) > max_height({})', prev_height, max_height)
                break
            if prev_height == curr_height:
                if retry_scroll_down < 3:
                    retry_scroll_down += 1
                    logger.debug('retry_scroll_down {}', retry_scroll_down)
                    await sleep(random_interval())
                    continue

                retry_scroll_down = 0

                async def scroll_up():
                    await page_random_mouse_move()
                    prev_height_bottom['value'] = prev_height
                    for i in range(0, 4):
                        await page_ref['value'].mouse.wheel(delta_x=0, delta_y=-random_delta_y())
                        await sleep(random_interval())
                    logger.debug('after test scroll up if on bottom')
                    await sleep(0.1)
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
                    retry_scroll_up += 1
                    if retry_scroll_up >= 3:
                        logger.debug('retry_scroll_up {} break', retry_scroll_up)
                        break
                    else:
                        logger.debug('retry_scroll_up {}', retry_scroll_up)
                        await scroll_up()
                continue

            prev_height = curr_height
            await sleep(random_interval())

    async def page_click(selector: str,
                         *,
                         auto_check_and_switch_new_page: bool = True,
                         **kwargs):
        pages_size_old = browser_context.pages.__len__()
        logger.debug('page click : selector={} , kwargs={}', selector, kwargs)
        if kwargs.get('timeout') is None:
            timeout = 2000
        else:
            timeout = kwargs.pop('timeout')

        from playwright.async_api import Frame

        async def locator_and_click(*, frame: Frame, loop_timeout: float):
            return await frame.locator(selector=selector).click(timeout=loop_timeout, **kwargs)

        await page_any_frame(
            func=locator_and_click,
            timeout=timeout,
            err_msg=f'Not found selector or failed to click {selector}',
            suc_msg_template=f'Found selector and clicked {selector}'
        )

        # await page_ref['value'].locator(selector=selector).click(timeout=timeout, **kwargs)

        logger.debug('after page click')
        if auto_check_and_switch_new_page:
            wait_any_page_create_at = datetime.now().timestamp()
            while datetime.now().timestamp() - wait_any_page_create_at < 3:
                if pages_size_old != browser_context.pages.__len__():
                    logger.debug('Some page created , page list is {}', browser_context.pages)
                    await switch_page(-1)
                    break
                else:
                    logger.debug('not found new page created after click')
                    await sleep(0.5)

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
        'switch_page': switch_page,
        'page_random_mouse_move': page_random_mouse_move,
        'page_wait_loaded': page_wait_loaded,
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


if __name__ == '__main__':
    pass
