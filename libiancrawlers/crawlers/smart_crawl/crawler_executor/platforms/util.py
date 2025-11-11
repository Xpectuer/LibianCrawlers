# -*- coding: UTF-8 -*-
import abc
import os
import subprocess
import time
from datetime import datetime
from subprocess import Popen
from typing import List

from loguru import logger

from libiancrawlers.crawlers.smart_crawl.crawler_executor import CrawlerExecutor, SearchKeywordTaskData, SearchOption
from libiancrawlers.util.shell import shell_run, shell_run_sync, shell_run_and_show, CmdMulti


class _BrowserSearchCrawlerExecutor(CrawlerExecutor, metaclass=abc.ABCMeta):
    @property
    def is_search_support(self) -> bool:
        return True

    @property
    def is_search_need_browser(self) -> bool:
        return True

    @property
    @abc.abstractmethod
    def is_search_need_account(self) -> bool:
        raise Exception('need to set')


class _SearchByShellRunCrawlerExecutor(CrawlerExecutor, metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def get_cmds_on_search(self, *, option: SearchOption) -> List[CmdMulti]:
        raise Exception('Not implement')

    def start_search(self, *, option: SearchOption):
        logger.debug('{} start search by shell run', self._current_thread_name_tag)
        min_time_browser_not_quit = option['task_data'].get('min_time_browser_not_quit')
        if min_time_browser_not_quit is None or min_time_browser_not_quit < 0:
            if self.is_search_need_browser:
                min_time_browser_not_quit = 60
        cmds = self.get_cmds_on_search(option=option)
        if cmds.__len__() <= 0:
            raise ValueError(f'cmds empty ? self is {self}')
        if not cmds[0].raise_on_not_zero:
            logger.warning('Please set cmds[0].raise_on_not_zero = True , but value is {}', cmds[0].raise_on_not_zero)
            cmds[0].raise_on_not_zero = True

        def _run():
            _result = shell_run_and_show(
                cmds=cmds,
                run_in_new_thread=False,
                use_wt=False,
                no_exit=False,
            )
            logger.debug("{} finish search by shell run , _result is {}", self._current_thread_name_tag, _result)
            for _, _, popen in _result:
                popen: Popen[str] = popen
                logger.debug('{} popen info:\n        code  :  {}\n        args  :  {}',
                             self._current_thread_name_tag, popen.returncode, popen.args)

        if min_time_browser_not_quit is None or min_time_browser_not_quit < 0:
            _run()
        else:
            _retry_count = 0
            while True:
                start_at = datetime.now()
                logger.debug('start_at is {}s', start_at)
                logger.debug('min_time_browser_not_quit is {}s', min_time_browser_not_quit)
                try:
                    time.sleep(0.5)
                    _run()
                    _now = datetime.now()
                    if _now.timestamp() - start_at.timestamp() < float(min_time_browser_not_quit):
                        raise Exception(
                            f'not enough time to run , only {int(_now.timestamp() - start_at.timestamp())}s , need {min_time_browser_not_quit}s')
                    break
                except BaseException as err:
                    _now = datetime.now()
                    if _retry_count < 3 and (not isinstance(err, KeyboardInterrupt)
                                             and _now.timestamp() - start_at.timestamp() < float(
                                min_time_browser_not_quit)):
                        _retry_count += 1
                        logger.warning(
                            'Retry {} of start search .\n        start_at  :  {}\n        min_time_browser_not_quit  :  {}'
                            + '\n        _now  :  {}\n        type(err)  :  {}\n        err  :  {}',
                            _retry_count, start_at, min_time_browser_not_quit, _now, type(err), err)
                        continue
                    raise


if __name__ == '__main__':
    pass
