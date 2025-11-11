# -*- coding: UTF-8 -*-


import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Literal, Optional, List, Union, Generator, Callable

import kazoo.client
import machineid
from kazoo.client import KazooClient
from kazoo.exceptions import NodeExistsError, NoNodeError
from loguru import logger

from libiancrawlers.app_util.cmdarg_util import parse_str_like_list, FireCmdArgInput
from libiancrawlers.crawlers import CrawlMode
from libiancrawlers.crawlers.smart_crawl.crawler_executor import CrawlerExecutor, Platform, TaskNode, TaskData, \
    SearchOption, RunTaskOption
from libiancrawlers.crawlers.smart_crawl.crawler_executor.platforms import get_all_crawler_executors
from libiancrawlers.util.fs import filename_slugify


def _get_machine_info(*,
                      machine_hashed_id: str,
                      _machine_id: str,
                      _cmd_arg: dict):
    return dict(
        machine_hashed_id=machine_hashed_id,
        machine_id=_machine_id,
        create_time_stamp=datetime.now().timestamp(),
        create_time_iso=datetime.now().isoformat(),
        os_name=os.name,
        username=os.getlogin(),
        pid=os.getpid(),
        cmd_arg=_cmd_arg,
    )


def _process_task_in_thread(*,
                            zk: KazooClient,
                            executor: CrawlerExecutor,
                            machine_hashed_id: str,
                            task_data: TaskData,
                            task_path: str,
                            max_browser: int,
                            executor_is_the_task_mode_need_account: Callable[[], bool],
                            executor_is_the_task_mode_need_browser: Callable[[], bool],
                            run_task: Callable[[RunTaskOption], None]
                            ):
    current_thread_tag = f'[{threading.current_thread().name}]'
    bddid_used = None
    acid_locked = None
    task_running_node_created = False
    running_node_path = f'{task_path}/running'
    run_task_success = False

    def zk_delete_task_running_node():
        try:
            zk.delete(running_node_path)
        except NoNodeError:
            pass

    def zk_delete_task():
        try:
            zk.delete(task_path, recursive=True)
        except NoNodeError:
            pass

    try:
        _bddid_must_use = None
        if executor_is_the_task_mode_need_account():
            bddid2acid = executor.get_bddid_to_acid()
            for _bddid, _acid in bddid2acid.items():
                if executor.try_acquire_account_id_lock(
                        acid=_acid,
                        bddid=_bddid,
                        machine_hashed_id=machine_hashed_id,
                        task_data=task_data,
                        current_thread_tag=current_thread_tag,
                ):
                    acid_locked = _acid
                    _bddid_must_use = _bddid
                    break
            if acid_locked is None:
                logger.info(
                    '{} Skip , no acid lock acquire success , bddid2acid is {}\n        task_path  :  {}\n        task_data  :  {}',
                    current_thread_tag, bddid2acid, task_path, task_data)
                return

        def check_max_browser_limit(*, allow_equal: bool):
            node_path_of_machine = f'/libian_crawler/bddid_machine_and_locks/{machine_hashed_id}'
            try:
                arr = zk.get_children(node_path_of_machine)
                logger.debug('length is {} of node {}', len(arr), node_path_of_machine)
            except NoNodeError:
                logger.debug('no node {}', node_path_of_machine)
                arr = []
            if allow_equal:
                allow = len(arr) <= max_browser
            else:
                allow = len(arr) < max_browser
            if not allow:
                logger.debug('current machine bddid lock count {} out of {}', len(arr), max_browser)
                return False
            else:
                logger.debug('current machine bddid lock count {} in range {}', len(arr), max_browser)
                return True

        if executor_is_the_task_mode_need_browser():
            if not check_max_browser_limit(allow_equal=False):
                logger.info(
                    '{} Skip , max_browser_limit before lock\n        task_path  :  {}\n        task_data  :  {}',
                    current_thread_tag, task_path, task_data)
                return

            if _bddid_must_use is None:
                _bddid_list = executor.get_browser_data_dir_ids()
            else:
                _bddid_list = [_bddid_must_use]
            for _bddid in _bddid_list:
                if executor.try_acquire_bddid_lock(
                        machine_hashed_id=machine_hashed_id,
                        bddid=_bddid,
                        task_data=task_data,
                        current_thread_tag=current_thread_tag,
                ):
                    bddid_used = _bddid
                    break
            if bddid_used is None:
                # no lock acquired
                logger.info(
                    '{} Skip , no bddid lock acquire success\n        _bddid_list  :  {}\n        _bddid_must_use  :  {}\n        task_path  :  {}\n        task_data  :  {}',
                    current_thread_tag, _bddid_list, _bddid_must_use, task_path, task_data)
                return
            # double check lock
            if not check_max_browser_limit(allow_equal=True):
                logger.info(
                    '{} Skip , max_browser_limit after lock\n        task_path  :  {}\n        task_data  :  {}',
                    current_thread_tag, task_path, task_data)
                return

        try:
            logger.debug('{} start create running node : {}', current_thread_tag, running_node_path)
            zk.create(running_node_path,
                      value=json.dumps(dict(
                          bddid_used=bddid_used,
                          acid_locked=acid_locked,
                          machine_hashed_id=machine_hashed_id,
                      ), ensure_ascii=False).encode(),
                      ephemeral=True,
                      makepath=False,
                      )
            logger.debug('{} running node created : {}', current_thread_tag, running_node_path)
            task_running_node_created = True
        except NodeExistsError:
            logger.info(
                '{} Skip , task is running by other worker ...\n        task_path  :  {}\n        task_data  :  {}',
                current_thread_tag, task_path, task_data)
            return
        except NoNodeError:
            logger.info(
                '{} Skip , task maybe finish by other worker ...\n        task_path  :  {}\n        task_data  :  {}',
                current_thread_tag, task_path, task_data)
            return

        logger.info('{} Start invoke task : {}', current_thread_tag, task_data)
        run_task_option: RunTaskOption = {
            "bddid": bddid_used
        }

        try:
            run_task(run_task_option)
            run_task_success = True
            logger.info('{} Success invoke task : {}', current_thread_tag, task_data)
        except BaseException:
            logger.warning('{} Failed invoke task : {}', current_thread_tag, task_data)
            raise

    except BaseException:
        logger.exception('{} Unexcepted error', current_thread_tag)
        raise
    finally:
        logger.debug('{} finish task schedule scope', current_thread_tag)
        error_list = []

        def ignore_with_log_error(tag: str, scope: Callable[[], None]):
            try:
                logger.debug('{} start scope {}', current_thread_tag, tag)
                scope()
            except BaseException as err:
                logger.exception('{} Unexpected error on {} , but we need continue ...', current_thread_tag, tag)
                error_list.append(err)

        if acid_locked is not None:
            ignore_with_log_error(
                tag='release_account_id_lock',
                scope=lambda: executor.release_account_id_lock(
                    acid=acid_locked,
                    current_thread_tag=current_thread_tag)
            )
        if bddid_used is not None:
            ignore_with_log_error(
                tag='release_bddid_lock',
                scope=lambda: executor.release_bddid_lock(
                    machine_hashed_id=machine_hashed_id,
                    bddid=bddid_used,
                    current_thread_tag=current_thread_tag)
            )
        if task_running_node_created:
            ignore_with_log_error(
                tag=zk_delete_task_running_node.__name__,
                scope=zk_delete_task_running_node,
            )
        if run_task_success:
            ignore_with_log_error(
                tag=zk_delete_task.__name__,
                scope=zk_delete_task,
            )
        if len(error_list) > 0:
            for _err in error_list:
                raise _err


def _start_worker(*,
                  zk: kazoo.client.KazooClient,
                  executors: List[CrawlerExecutor],
                  machine_hashed_id: str,
                  _machine_info: dict,
                  max_browser: int,
                  max_thread: int,
                  save_data_mode: CrawlMode,
                  zookeeper_hosts: str,
                  ):
    thread_pool = ThreadPoolExecutor(max_workers=max_thread, thread_name_prefix='scc-worker')
    try:
        logger.info('Run as worker daemon process ...')
        _connect_retry_count = 10
        while True:
            try:
                zk.create(f'/libian_crawler/worker_clients/{machine_hashed_id}',
                          value=json.dumps(_machine_info, ensure_ascii=False).encode(),
                          ephemeral=True,
                          sequence=False,  # 同一台机子上只能跑一个 worker
                          makepath=True)
                break
            except NodeExistsError:
                node = zk.get(f'/libian_crawler/worker_clients/{machine_hashed_id}')
                logger.warning('同一台机子上只能跑一个 worker ！other worker info is {}', node)
                time.sleep(1)
                if _connect_retry_count <= 0:
                    raise
                _connect_retry_count -= 1

        def _is_support_platform(_platform: str):
            for _executor in executors:
                if _executor.platform_or_alia_is_contained_by_list([_platform]):
                    return True
            return False

        def _get_executor_of_platform(_platform: Platform):
            for _executor in executors:
                if _executor.platform_or_alia_is_contained_by_list([_platform]):
                    return _executor
            raise ValueError(f'BUG , not executor support platform {_platform} , executors is {executors}')

        for task_node in _task_node_finder(
                zk=zk,
                _is_support_platform=_is_support_platform,
        ):
            time.sleep(1)
            logger.debug('find task : {}', task_node)
            task_data = task_node['task_data']
            task_path = task_node['task_path']
            while task_path.endswith('/'):
                task_path = task_path.removesuffix('/')
            if task_data['mode'] == 'search_keyword':
                task_platform = task_data['platform']
                executor = _get_executor_of_platform(task_platform)
                if not executor.is_search_support:
                    logger.warning(
                        'Unsupported search_keyword task of platform [{}] , maybe worker version is too old ? task_path is {} , task_data is {}',
                        task_platform, task_path, task_data)
                    continue
                executor_is_the_task_mode_need_account = lambda: executor.is_search_need_account
                executor_is_the_task_mode_need_browser = lambda: executor.is_search_need_browser

                def _run_task(option: RunTaskOption):
                    search_option: SearchOption = {
                        "task_data": task_data,
                        "save_data_mode": save_data_mode,
                        "run_task_option": option,
                        "zookeeper_hosts": zookeeper_hosts,
                    }
                    return executor.start_search(option=search_option)

                run_task = _run_task
            else:
                logger.error(
                    'Unknown task_data.mode {} , maybe worker version is too old ? task_path is {} , task_data is {}',
                    task_data['mode'], task_path, task_data)
                continue

            def _process_task_runnable():
                return _process_task_in_thread(
                    zk=zk,
                    executor=executor,
                    machine_hashed_id=machine_hashed_id,
                    task_data=task_data,
                    task_path=task_path,
                    max_browser=max_browser,
                    executor_is_the_task_mode_need_account=executor_is_the_task_mode_need_account,
                    executor_is_the_task_mode_need_browser=executor_is_the_task_mode_need_browser,
                    run_task=run_task
                )

            thread_pool.submit(_process_task_runnable)
    finally:
        _shutdown_finish = dict(value=False)

        def print_shutdown_state():
            while not _shutdown_finish['value']:
                logger.debug('start shutdown thread pool , it will wait to all task finish...')
                time.sleep(1)

        print_shutdown_state_thread = threading.Thread(target=print_shutdown_state)
        print_shutdown_state_thread.setDaemon(True)
        try:
            print_shutdown_state_thread.start()
            thread_pool.shutdown(wait=True, cancel_futures=True)
        finally:
            _shutdown_finish['value'] = True
        logger.debug('Finish thread pool shutdown')


def _task_node_finder(*,
                      zk: kazoo.client.KazooClient,
                      _is_support_platform: Callable[[str], bool],
                      ) -> Generator[TaskNode, None, None]:
    while True:
        try:
            search_keywords_task_platforms = zk.get_children('/libian_crawler/tasks/search_keywords')
        except NoNodeError:
            search_keywords_task_platforms = None
            logger.debug('no node /libian_crawler/tasks/search_keywords')
        if search_keywords_task_platforms is not None and len(search_keywords_task_platforms) > 0:
            for platform in search_keywords_task_platforms:
                if not _is_support_platform(platform):
                    logger.debug('skip search keywords task on platform [{}]', platform)
                    continue
                logger.debug('start search keywords task on platform [{}]', platform)
                try:
                    search_keyword_task_names = zk.get_children(f'/libian_crawler/tasks/search_keywords/{platform}')
                except NoNodeError:
                    continue
                for search_keyword_key_name in search_keyword_task_names:
                    logger.debug('found keyword-key [{}] on platform [{}]', search_keyword_key_name, platform)
                    task_path = f'/libian_crawler/tasks/search_keywords/{platform}/{search_keyword_key_name}'
                    try:
                        task_info = zk.get(task_path)
                    except NoNodeError:
                        logger.debug('not found task , maybe other worker finish it ... path is {}', task_path)
                        continue
                    # logger.debug('task info : {}', task_info)
                    task_data_bytes, node_stat = task_info
                    try:
                        task_data: TaskData = json.loads(task_data_bytes)
                    except BaseException:
                        logger.exception('Invalid task data bytes : {}', task_data_bytes)
                        continue
                    result: TaskNode = {
                        "task_path": task_path,
                        "node_stat": node_stat,
                        "task_data": task_data,
                    }
                    yield result
                    time.sleep(5)
        # -------------------------------
        logger.debug('task each end , i will take a break ...')
        time.sleep(60)


def _emit_task(*, task: TaskData, zk: kazoo.client.KazooClient) -> Literal['success', 'exist']:
    if task['mode'] == 'search_keyword':
        zk_path = f'/libian_crawler/tasks/search_keywords/{task["platform"]}/{filename_slugify((task["keyword"]), allow_unicode=True)}'
        try:
            zk.create(
                zk_path,
                value=json.dumps(task, ensure_ascii=False).encode(),
                ephemeral=False,
                sequence=False,
                makepath=True,
            )
            logger.info('\n+ Success emit task to zookeeper: \n    path is  :  {}\n    data is  :  {}',
                        zk_path, json.dumps(task, ensure_ascii=False))
            return 'success'
        except NodeExistsError:
            logger.info('\n> Duplicated task in zookeeper : \n    path is  :  {}', zk_path)
            return 'exist'
    else:
        raise ValueError(f'BUG , unknown task type : {task}')


def _check_platform_names(*, names: List[str], cmdarg_name: str, executors: List[CrawlerExecutor]):
    name_found = False
    for name in names:
        for executor in executors:
            if not name_found:
                if executor.platform_or_alia_is_contained_by_list([name]):
                    name_found = True
        if not name_found:
            _next_line = "\n"
            _msg = _next_line.join(
                map(lambda _ex: "    " + " or ".join([_ex.platform, *_ex.platform_alias]), executors))
            raise ValueError(
                f'Invalid {cmdarg_name} , please use --ls arg to check available platforms:\n{_msg}\n\nBut value is: {name}\n')


def smart_crawl_compose(*,
                        ls: Optional[bool] = None,
                        zookeeper_hosts: Optional[str] = None,
                        search_keywords: Optional[FireCmdArgInput] = None,
                        get_comment: bool = False,
                        get_sub_comment: bool = False,
                        min_time_browser_not_quit: Optional[int] = None,
                        max_time_browser_to_quit: Optional[int] = None,
                        platforms_include: Optional[FireCmdArgInput] = None,
                        platforms_exclude: Optional[FireCmdArgInput] = None,
                        worker: bool = False,
                        worker_save_data_mode: CrawlMode = 'insert_to_db',
                        worker_max_browser: Optional[int] = None,
                        worker_max_thread: Optional[int] = None,
                        worker_platform_to_bddid: Optional[FireCmdArgInput] = None,
                        worker_bddid_to_acid: Optional[FireCmdArgInput] = None,
                        # **kwargs,
                        ):
    _cmd_arg = json.loads(json.dumps(locals(), ensure_ascii=False))
    # if len(kwargs.keys()) > 0:
    #     raise ValueError(f'unknown kwargs , please use --help argument , kwargs is {kwargs}')
    executors = get_all_crawler_executors()
    for executor in executors:
        executor.mount_worker_bddid_and_acid(
            worker_platform_to_bddid=worker_platform_to_bddid,
            worker_bddid_to_acid=worker_bddid_to_acid,
        )
    _no_worker = False or search_keywords
    if ls:
        print('platform available :')
        for executor in executors:
            print(executor.get_ls_output_string())
        print()
        sys.exit(0)

    def parse_int(v: Optional[Union[int, str, bool, float]], default_value: int):
        if v is None or isinstance(v, bool):
            v = default_value
        v = int(v)
        if v <= 0:
            v = default_value
        return v

    worker_max_browser = parse_int(worker_max_browser, 5)
    worker_max_thread = parse_int(worker_max_thread, 10)

    platforms_include_list = parse_str_like_list(platforms_include, cmdarg_name='--platforms_include')
    platforms_exclude_list = parse_str_like_list(platforms_exclude, cmdarg_name='--platforms_exclude')
    _check_platform_names(names=platforms_include_list, cmdarg_name='--platforms_include', executors=executors)
    _check_platform_names(names=platforms_exclude_list, cmdarg_name='--platforms_exclude', executors=executors)

    if worker and _no_worker or (not worker and not _no_worker):
        raise ValueError('Choice --worker else (no worker option, such as --search_keywords)')

    _machine_id = machineid.id()
    logger.debug('machine_id : {}', _machine_id)
    machine_hashed_id = machineid.hashed_id(app_id='libian_crawler')
    logger.debug('machine_hashed_id : {}', machine_hashed_id)
    _machine_info = _get_machine_info(_machine_id=_machine_id, machine_hashed_id=machine_hashed_id, _cmd_arg=_cmd_arg)

    if worker and not zookeeper_hosts:
        raise ValueError('require argument --zookeeper_hosts 127.0.0.1:2181')

    zk = KazooClient(
        hosts=zookeeper_hosts,
    )
    try:
        logger.debug('zk starting ... zk is {}', zk)
        zk.start()
        while not zk.connected:
            logger.debug('wait zk connected ...')
            time.sleep(1)
        logger.debug('zk success connected')
        for executor in executors:
            executor.mount_zookeeper(zk=zk)
        zk.create(f'/libian_crawler/connected_clients/{machine_hashed_id}',
                  value=json.dumps(_machine_info, ensure_ascii=False).encode(),
                  ephemeral=True,
                  sequence=True,
                  makepath=True)

        if _no_worker:
            if search_keywords:
                keywords = parse_str_like_list(search_keywords, cmdarg_name='--search_keywords')
                if len(keywords) <= 0:
                    raise ValueError('Invalid empty --search_keywords')
            else:
                keywords = []

            executors_available = []
            for executor in executors:
                if len(platforms_include_list) > 0 and not executor.platform_or_alia_is_contained_by_list(
                        platforms_include_list):
                    logger.debug('Skip platform {} not in platforms_include_list {}',
                                 executor.platform, platforms_include_list)
                    continue
                if executor.platform_or_alia_is_contained_by_list(platforms_exclude_list):
                    logger.debug('Skip platform {} in platforms_exclude_list {}',
                                 executor.platform, platforms_include_list)
                    continue
                executors_available.append(executor)
            executors_available_search: List[CrawlerExecutor] = []
            if search_keywords:
                for executor in executors_available:
                    if not executor.is_search_support:
                        logger.debug('platform {} not support search', executor.platform)
                        continue
                    executors_available_search.append(executor)

            if search_keywords:
                platforms_search = list(map(lambda ex: ex.platform, executors_available_search))
                if len(platforms_search) <= 0:
                    raise ValueError('no available platform support --search_keywords')
                for keyword in keywords:
                    for executor in executors_available_search:
                        _emit_task(
                            zk=zk,
                            task={
                                "mode": "search_keyword",
                                "keyword": keyword,
                                "platform": executor.platform,
                                "get_comment": get_comment,
                                "get_sub_comment": get_sub_comment,
                                "min_time_browser_not_quit": min_time_browser_not_quit,
                                "max_time_browser_to_quit": max_time_browser_to_quit,
                            }
                        )
        if worker:
            _start_worker(
                zk=zk,
                executors=executors,
                machine_hashed_id=machine_hashed_id,
                _machine_info=_machine_info,
                max_browser=worker_max_browser,
                max_thread=worker_max_thread,
                save_data_mode=worker_save_data_mode,
                zookeeper_hosts=zookeeper_hosts,
            )
            logger.warning('Break worker loop , process will shutdown after 60s ...')
            time.sleep(60)
    finally:
        logger.debug('zk stopping and closing ...')
        zk.stop()
        zk.close()


if __name__ == '__main__':
    pass
