# -*- coding: UTF-8 -*-
from typing import Optional, TypedDict

import webview
from loguru import logger
from webview import Window

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


def _backend_thread(pass_args: dict):
    logger.debug('backend thread start , pass args is {}', pass_args)
    try:
        pass
    finally:
        logger.debug('backend thread finish')


def start_worker_ui(*, debug=False, vite_server_port=5173, no_frameless=False):
    logger.info('Start worker ui ...')
    jsapi = JsApi()
    window = webview.create_window(
        title='LibianCrawlerWorkerUI',
        url=f'http://localhost:{vite_server_port}',
        width=750,
        height=750,
        min_size=(380, 380),
        frameless=not no_frameless,
        text_select=True,
        # easy_drag=False,
        # shadow=True,
        # on_top=False,
        # transparent=False,
        confirm_close=True,
        js_api=jsapi
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
