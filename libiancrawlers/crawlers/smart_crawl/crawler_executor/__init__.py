# -*- coding: UTF-8 -*-
import abc
import json
import threading
from typing import *

import kazoo.client
from kazoo.exceptions import NodeExistsError, NoNodeError
from kazoo.protocol.states import ZnodeStat
from loguru import logger

from libiancrawlers.app_util.cmdarg_util import FireCmdArgInput, parse_str_like_list
from libiancrawlers.crawlers import CrawlMode
from libiancrawlers.util.exceptions import is_timeout_error

Platform = str

SearchKeywordTaskData = TypedDict('SearchKeywordTaskData', {
    "mode": Literal['search_keyword'],
    "keyword": str,
    "platform": Platform,
    "get_comment": Optional[bool],
    "get_sub_comment": Optional[bool],
    "min_time_browser_not_quit": Optional[int],
    "max_time_browser_to_quit": Optional[int],
})

TaskData = Union[SearchKeywordTaskData]

TaskNode = TypedDict('TaskNode', {
    "task_path": str,
    "node_stat": ZnodeStat,
    "task_data": TaskData,
})

RunTaskOption = TypedDict('RunTaskOption', {
    "bddid": Optional[str],
})

SearchOption = TypedDict('SearchOption', {
    "task_data": SearchKeywordTaskData,
    'save_data_mode': CrawlMode,
    'run_task_option': RunTaskOption,
    'zookeeper_hosts': str,
})


class CrawlerExecutor(metaclass=abc.ABCMeta):
    def __init__(self):
        self._zk: Optional[kazoo.client.KazooClient] = None
        self._bddid_set: Set[str] = set()
        self._bddid2acid: Dict[str, str] = dict()

    @property
    def platform(self) -> Platform:
        return self.__class__.__name__.removesuffix('CrawlerExecutor').lower()

    @property
    def platform_alias(self) -> List[str]:
        return []

    def platform_or_alia_is_contained_by_list(self, arr: List[str]):
        for name in arr:
            if self.platform == name or name in self.platform_alias:
                return True
        return False

    @property
    def is_search_support(self) -> bool:
        return False

    @property
    def is_search_need_browser(self) -> bool:
        return False

    @property
    def is_search_need_account(self) -> bool:
        return False

    @property
    def is_get_comment_support(self) -> bool:
        return False

    @property
    def is_get_sub_comment_support(self) -> bool:
        return False

    def get_browser_data_dir_ids(self) -> List[str]:
        """
        return no empty List[str]
        """
        if len(self._bddid_set) <= 0:
            arr: List[str] = []
            if self.is_search_need_account:
                arr.append(f'login_{self.platform}')
            else:
                arr.append(f'no_trace_{self.platform}')
            arr.sort()
            return arr
        else:
            arr = [*self._bddid_set]
            arr.sort()
            return arr

    def get_bddid_to_acid(self) -> Dict[str, str]:
        # res = {k: self._bddid2acid[k] for k in self._bddid2acid if k in self.get_browser_data_dir_ids()}
        res: Dict[str, str] = dict()
        for bddid in self.get_browser_data_dir_ids():
            if bddid in self._bddid2acid.keys():
                res[bddid] = self._bddid2acid[bddid]
            else:
                if self.is_search_need_browser:
                    logger.warning('not set --worker_bddid_to_account_id for browser_data_dir_id {}', bddid)
                    res[bddid] = 'default_account'
                else:
                    res[bddid] = 'no_need_account_in_browser'
        return res

    def get_ls_output_string(self):
        s = f'\n    {self.platform}'
        s += f'\n        alias={",".join(self.platform_alias)}'
        _trait_arr = [
            *(["is_search_support"] if self.is_search_support else []),
            *(["is_search_need_account"] if self.is_search_need_account else []),
            *(["is_search_need_browser"] if self.is_search_need_browser else []),
            *(["is_get_comment_support"] if self.is_get_comment_support else []),
            *(["is_get_sub_comment_support"] if self.is_get_sub_comment_support else []),
        ]
        s += f'\n        trait={",".join(_trait_arr)}'
        s += f'\n        browser_data_dir_ids={",".join(self.get_browser_data_dir_ids())}'
        s += f'\n        bddid_to_acid={self.get_bddid_to_acid()}'
        return s

    def mount_worker_bddid_and_acid(self, *,
                                    worker_platform_to_bddid: Optional[FireCmdArgInput],
                                    worker_bddid_to_acid: Optional[FireCmdArgInput],
                                    ):
        for entry in parse_str_like_list(worker_platform_to_bddid, cmdarg_name='--worker_platform_to_bddid'):
            entry_arr = entry.split('=')
            if len(entry_arr) != 2:
                raise ValueError(f'Invalid --worker_platform_to_bddid : {entry}')
            k, v = entry_arr
            if not self.platform_or_alia_is_contained_by_list([k]):
                continue
            self._bddid_set.add(v)
        for entry in parse_str_like_list(worker_bddid_to_acid, cmdarg_name='--worker_bddid_to_acid'):
            entry_arr = entry.split('=')
            if len(entry_arr) != 2:
                raise ValueError(f'Invalid --worker_bddid_to_acid : {entry}')
            k, v = entry_arr
            self._bddid2acid[k] = v

    def mount_zookeeper(self, *, zk: kazoo.client.KazooClient):
        self._zk = zk

    def try_acquire_account_id_lock(self, *,
                                    acid: str,
                                    bddid: str,
                                    machine_hashed_id: str,
                                    task_data: TaskData,
                                    current_thread_tag: str,
                                    ):
        zk = self._zk
        try:
            zk.create(f'/libian_crawler/account_id_locks/{acid}',
                      value=json.dumps(dict(
                          acid=acid,
                          machine_hashed_id=machine_hashed_id,
                          bddid=bddid,
                          platform=self.platform,
                          task_data=task_data,
                      )).encode(),
                      makepath=True,
                      ephemeral=True)
            logger.debug('{} success acquire account id lock {}', current_thread_tag, acid)
            return True
        except NodeExistsError:
            logger.debug('{} account id already used ... acid is {}', current_thread_tag, acid)
            return False

    def release_account_id_lock(self, *,
                                acid: str,
                                current_thread_tag: str):
        zk = self._zk
        logger.debug('{} release account id lock {}', current_thread_tag, acid)
        while True:
            try:
                zk.delete(f'/libian_crawler/account_id_locks/{acid}')
                break
            except BaseException as err:
                if is_timeout_error(err):
                    logger.warning('{} retry on timeout error on on release account id lock {}', current_thread_tag,
                                   acid)
                    continue
                if isinstance(err, NoNodeError):
                    logger.exception('{} Concurrent error on release account id lock {}', current_thread_tag, acid)
                    break
                logger.exception('{} Unexcepted error on release account id lock {}', current_thread_tag, acid)
                raise

    def try_acquire_bddid_lock(self, *,
                               machine_hashed_id: str,
                               bddid: str,
                               task_data: TaskData,
                               current_thread_tag: str, ):
        zk = self._zk
        try:
            zk.create(f'/libian_crawler/bddid_machine_and_locks/{machine_hashed_id}/{bddid}',
                      value=json.dumps(dict(
                          machine_hashed_id=machine_hashed_id,
                          bddid=bddid,
                          platform=self.platform,
                          task_data=task_data,
                      )).encode(),
                      makepath=True,
                      ephemeral=True)
            logger.debug('{} success acquire bddid lock {}/{}', current_thread_tag, machine_hashed_id, bddid)
            return True
        except NodeExistsError:
            logger.warning('{} Why bddid already used ? it should only one worker on one machine ! value is {}/{}',
                           current_thread_tag, machine_hashed_id, bddid)
            return False

    def release_bddid_lock(self, *,
                           machine_hashed_id: str,
                           bddid: str,
                           current_thread_tag: str):
        zk = self._zk
        logger.debug('{} release bddid lock {}/{}', current_thread_tag, machine_hashed_id, bddid)
        while True:
            try:
                zk.delete(f'/libian_crawler/bddid_machine_and_locks/{machine_hashed_id}/{bddid}')
                break
            except BaseException as err:
                if is_timeout_error(err):
                    logger.warning('{} retry on timeout error on on release bddid lock {}/{}',
                                   current_thread_tag, machine_hashed_id, bddid)
                    continue
                if isinstance(err, NoNodeError):
                    logger.exception('{} Concurrent error on release bddid lock {}/{}',
                                     current_thread_tag, machine_hashed_id, bddid)
                    break
                logger.exception('{} Unexcepted error on release bddid lock {}/{}',
                                 current_thread_tag, machine_hashed_id, bddid)
                raise

    @property
    def _current_thread_name_tag(self):
        return f'[{threading.current_thread().name}]'

    @abc.abstractmethod
    def start_search(self, *, option: SearchOption):
        raise ValueError(f'Unsupported search , self is {self} , locals is :{locals()}')

    @property
    def project_root_dir(self):
        import prevent_the_screen_saver
        return str(prevent_the_screen_saver.project_root_dir)


if __name__ == '__main__':
    pass
