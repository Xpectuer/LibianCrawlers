# -*- coding: UTF-8 -*-
import asyncio
import random

from aioify import aioify
from loguru import logger
from playwright.async_api import Page

from libiancrawlers.util.coroutines import sleep


def _create_wait_steps_func_map(*, b_page: Page):
    async def mouse_move(*args, **kwargs):
        await asyncio.wait_for(b_page.mouse.move(*args, **kwargs), timeout=3)

    async def scroll_down(*args, **kwargs):
        await b_page.mouse.wheel(*args, **kwargs)

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

    fn_map = {
        'sleep': sleep,
        'logd': logd,
        'logi': logi,
        'logw': logw,
        'loge': loge,
        'page_wait_for_load_state': b_page.wait_for_load_state,
        'page_bring_to_front': b_page.bring_to_front,
        'page_wait_for_function': b_page.wait_for_function,
        'page_mouse_move': mouse_move,
        'page_type': b_page.type,
        'page_click': b_page.click
        # 'page_scroll_down': scroll_down,
    }

    return fn_map


def _random_mouse_move():
    return {
        'fn': 'page_mouse_move',
        'args': [random.randint(100, 1600), random.randint(100, 1600)],
        'kwargs': {
            'steps': 5
        },
        'on_timeout': 'continue',
    }


def _default_wait_steps():
    return [
        {
            'fn': 'page_bring_to_front',
        }, {
            'fn': 'page_wait_for_load_state',
            'args': ['networkidle'],
            'kwargs': {
                'timeout': 1,
            },
            'on_timeout': 'continue',
        }, {
            'fn': 'page_wait_for_load_state',
            'args': ['domcontentloaded'],
            'kwargs': {
                'timeout': 30,
            },
        }, {
            'fn': 'page_wait_for_load_state',
            'args': ['load'],
            'kwargs': {
                'timeout': 30,
            }
        },
        *([
              _random_mouse_move()
          ].__mul__(2)),
    ]


if __name__ == '__main__':
    pass
