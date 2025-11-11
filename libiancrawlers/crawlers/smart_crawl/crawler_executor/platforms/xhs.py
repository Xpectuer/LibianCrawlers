# -*- coding: UTF-8 -*-
from typing import List

from libiancrawlers.crawlers.smart_crawl.crawler_executor import CrawlerExecutor, SearchKeywordTaskData, SearchOption
from libiancrawlers.crawlers.smart_crawl.crawler_executor.platforms.util import _BrowserSearchCrawlerExecutor, \
    _SearchByShellRunCrawlerExecutor
from libiancrawlers.util.shell import CmdMulti


class XhsCrawlerExecutor(_BrowserSearchCrawlerExecutor, _SearchByShellRunCrawlerExecutor):
    @property
    def platform_alias(self) -> List[str]:
        return ['xiaohongshu']

    @property
    def is_search_need_account(self) -> bool:
        return True

    def get_cmds_on_search(self, *, option: SearchOption) -> List[CmdMulti]:
        max_time_browser_to_quit = option['task_data'].get('max_time_browser_to_quit')
        if max_time_browser_to_quit is None or max_time_browser_to_quit < 0:
            max_time_browser_to_quit = 4 * 60 * 60  # 4h auto quit default
        bddid = option['run_task_option']['bddid']
        if bddid is None:
            raise ValueError('bddid is None')
        return [
            CmdMulti(
                title=f'{self.platform} search',
                work_dir=self.project_root_dir,
                raise_on_not_zero=True,
                cmd=[
                    'poetry', 'run', 'smart-crawl',
                    '--url', 'https://xiaohongshu.com/',
                    '--locale', 'zh-CN',
                    '--dump_page_ignore_names', 'script,svg',
                    '--steps', f'jsonfile:steps/xiaohongshu-search.json?q={option["task_data"]["keyword"]}',
                    '--browser_data_dir_id', bddid,
                    '--screen_min_width', '1000',
                    '--mode', option['save_data_mode'],
                    '--zookeeper_hosts', option['zookeeper_hosts'],
                    *(['--max_time_browser_to_quit', str(max_time_browser_to_quit)]
                      if max_time_browser_to_quit is not None and max_time_browser_to_quit > 0 else []),
                ],
            )
        ]


if __name__ == '__main__':
    pass
