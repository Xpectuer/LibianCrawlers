import asyncio
import os.path
from typing import List, Any, Optional
import js2py
from loguru import logger

from libiancrawlers.util.plat import PreventTheScreenSaver


def _check_is_str_list(obj: Any, tag: str) -> List[str]:
    if not isinstance(obj, list):
        raise ValueError(f'{tag} must be Array<string> , but it not a list')
    for item in obj:
        if not isinstance(item, str):
            raise ValueError(
                f'{tag} must be Array<string> , but item in it not a string , it is : {item}  , type(item) is {type(item)}')
    return obj


async def smart_crawl_urls(*,
                           keys: str,
                           key2url_jsfunc: Optional[str] = None,
                           _should_init_app=True,
                           **kwargs):
    logger.info('Start smart crawl urls\n    len(keys) is {}\n    key2url_jsfunc is {}\n    kwargs is {}',
                len(keys), key2url_jsfunc, kwargs)

    from libiancrawlers.app_util.cmdarg_util import parse_json_or_read_file_json_like
    from libiancrawlers.app_util.types import Initiator
    from libiancrawlers.app_util.app_init import init_app

    if _should_init_app:
        init_app(Initiator(postgres=False, playwright=False))

    keys = _check_is_str_list(await parse_json_or_read_file_json_like(keys), '--keys')
    if key2url_jsfunc is not None and len(key2url_jsfunc) > 0:
        key2url = js2py.eval_js(key2url_jsfunc)
        urls = _check_is_str_list([key2url(key) for key in keys], 'map_keys_to_urls_result')
    else:
        urls = keys
    logger.debug('smart crawl urls len is {}', len(urls))
    for url_idx in range(0, len(urls)):
        url = urls[url_idx]
        logger.info('[{}/{}] start crawl url : {}', url_idx + 1, len(urls), url)
        logger.debug('kwargs is {}', kwargs)
        _args: List[str] = ['--url', url]
        for k in kwargs.keys():
            _args.append(f'--{k}')
            _args.append(f'{kwargs[k]}')
        logger.debug('subprocess args: {}', _args)
        proc = await asyncio.create_subprocess_exec(
            os.path.join('.venv', 'scripts', 'python'),
            os.path.join('.venv', 'scripts', 'smart-crawl'),
            *_args,
        )
        logger.debug('created subprocess ...')
        code = await proc.wait()
        if code != 0:
            raise ValueError('Subprocess quit not 0 !')
        logger.debug('finish subprocess , code is {}', code)


def cli():
    with PreventTheScreenSaver():
        from fire import Fire
        Fire(smart_crawl_urls)
