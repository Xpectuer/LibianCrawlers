# -*- coding: UTF-8 -*-
import os

from loguru import logger


def is_windows():
    return os.name == 'nt'


class PreventTheScreenSaver:
    def __enter__(self):
        """
        https://stackoverflow.com/a/63077008/21185704
        """
        if is_windows():
            logger.debug('start prevent the screen saver for windows')
            import ctypes
            ctypes.windll.kernel32.SetThreadExecutionState(0x80000002)

    def __exit__(self, exc_type, exc_val, exc_tb):
        if is_windows():
            logger.debug('end prevent the screen saver for windows')
            import ctypes
            ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)  # set the setting back to normal


if __name__ == '__main__':
    pass
