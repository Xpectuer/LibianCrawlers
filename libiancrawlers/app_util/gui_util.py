# -*- coding: UTF-8 -*-
import multiprocessing

from aioify import aioify
from loguru import logger


@aioify
def gui_confirm(*, title: str, message: str, play_sound: bool = False):
    p = multiprocessing.Process(target=_gui_confirm,
                                kwargs=dict(title=title, message=message),
                                name=f'gui_confirm of {title}',
                                daemon=True)
    p.start()
    p.join()
    logger.debug('gui_confirm joined')


def _gui_confirm(*, title: str, message: str):
    import wx
    app = wx.App()
    try:
        dlg = wx.MessageDialog(None, message, title, wx.OK | wx.ICON_INFORMATION)
        res = dlg.ShowModal()
    finally:
        app.Destroy()
    logger.debug('confirmed , res is {}', res)


if __name__ == '__main__':
    pass
