from loguru import logger
import sys
import os


# noinspection PyUnresolvedReferences
def cli():
    for _module in [os, sys]:
        for prop in dir(_module):
            if prop.startswith('_'):
                continue
            prop_k, prop_v = eval(
                f'''('{_module.__name__}.{prop}', {_module.__name__}.{prop})''')
            if hasattr(prop_v, '__call__'):
                continue
            if str(prop_v).__len__() > 200:
                continue
            logger.debug('{} : {}', prop_k, prop_v)
