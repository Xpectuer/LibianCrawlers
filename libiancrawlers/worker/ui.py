# -*- coding: UTF-8 -*-
import threading
from typing import Optional, TypedDict

import async_to_sync
from websockets.sync.client import connect
import webview
from loguru import logger
from webview import Window
from requests import request

from libiancrawlers.util.exceptions import is_timeout_error

WebviewVariablesRef = TypedDict('WebviewVariablesRef', {
    'window': Optional[Window]
})

webview_variables_ref: WebviewVariablesRef = {
    'window': None
}


# noinspection PyMethodMayBeStatic
class JsApi:

    def __init__(self):
        pass

    def logd(self, *args):
        logger.debug(*args)

    def window_hide(self):
        webview_variables_ref['window'].hide()

    def window_show(self):
        webview_variables_ref['window'].show()

    def generate_new_identity(self, aes_password: str):
        from libiancrawlers.worker.node import generate_new_identity_sync



        return generate_new_identity_sync(aes_password)


def _backend_thread(pass_args: dict):
    logger.debug('backend thread start , pass args is {}', pass_args)
    try:
        pass
    finally:
        logger.debug('backend thread finish')


def start_worker_ui(*, debug: bool = False, vite_server_port: int = 7007):
    logger.info('Start worker ui ...')
    try:
        _found_vue_dev_tools = request('GET',
                                       f'http://localhost:{vite_server_port}/__devtools__/',
                                       timeout=1.5)
    except BaseException as err:
        logger.debug('failed find vue devtools , err is {}', err)
        _found_vue_dev_tools = None
    if _found_vue_dev_tools is not None and _found_vue_dev_tools.ok:
        logger.debug('found_vue_dev_tools.ok , resp is {}', _found_vue_dev_tools)
        is_vite_dev = True
    else:
        is_vite_dev = False
    logger.debug('is_vite_dev is {}', is_vite_dev)

    jsapi = JsApi()
    window = webview.create_window(
        title='LibianCrawler工作台',
        url=f'http://localhost:{vite_server_port}',
        width=750,
        height=750,
        # min_size=(380, 380),
        frameless=False,
        text_select=True,
        easy_drag=True,
        # shadow=True,
        # on_top=False,
        # transparent=False,
        confirm_close=True,
        js_api=jsapi,
        http_port=7008,
    )
    webview_variables_ref['window'] = window
    logger.debug('webview create window : {}', window)
    webview.start(
        func=_backend_thread,
        args=[dict(
            window=window,
        )],
        debug=debug,
        http_server=True,
    )

    logger.debug('webview finish')


def cli():
    from fire import Fire
    Fire(start_worker_ui)


if __name__ == '__main__':
    pass
