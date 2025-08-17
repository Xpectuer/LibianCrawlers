# -*- coding: UTF-8 -*-
import json
import random
from datetime import datetime
import os.path
from pathlib import Path
from typing import *

import aiofiles.os as aios
import aiofiles.ospath
import json5
from filelock import AsyncFileLock
from loguru import logger

from libiancrawlers.util.coroutines import sleep
from libiancrawlers.util.fs import OsPath, mkdirs

T = TypeVar('T')

StoreExpireTime = Optional[float]


class RollupStore(Generic[T]):
    def __init__(self, *,
                 name: str,
                 desc: str,
                 store_dir: OsPath,
                 value_checker: Optional[Callable[[T], Awaitable[bool]]], ):
        _store_dir = Path(store_dir)
        self._store_dir = _store_dir
        logger.debug('[{}] absolute store dir is {}', name, _store_dir.absolute())
        self._lock: Optional[AsyncFileLock] = None
        self.inited = False
        self._value_checker = value_checker
        self.name = name
        self.desc = desc

    @property
    def _lock_path(self):
        return self._store_dir / 'refresh.lock'

    @property
    def _objects_dir_path(self):
        return self._store_dir / 'objects'

    @property
    def _latest_object_path(self):
        return self._objects_dir_path / 'latest.json'

    @property
    def _readme_path(self):
        return self._store_dir / 'readme.md'

    async def init(self):
        if self.inited:
            raise Exception('already inited')
        logger.debug('[{}] start init rollup store', self.name)
        try:
            await mkdirs(self._store_dir)
            self._lock = AsyncFileLock(self._lock_path)
            async with self._lock:
                if not await aiofiles.ospath.exists(self._readme_path):
                    async with aiofiles.open(self._readme_path, mode='wt', encoding='utf-8') as f:
                        await f.write(f'''# RollupStore of {self.name}

{self.desc}

- `objects` 目录下存放数据记录。
- `.lock` 文件为更新锁，如果你看到它没有被删除，说明进程意外退出了。
''')
        finally:
            self.inited = True

    async def _read_obj(self, object_filename: OsPath) -> Tuple[
        Literal['empty', 'failed_parse_json', 'failed_check', 'ok'],
        Optional[T],
    ]:
        async with aiofiles.open(object_filename, mode='rt', encoding='utf-8') as f:
            latest_text = await f.read()
        if len(latest_text.strip()) == 0:
            return 'empty', None
        try:
            _latest_obj = json.loads(latest_text)
        except ValueError:
            return 'failed_parse_json', None
        if self._value_checker is not None and not await self._value_checker(_latest_obj):
            return 'failed_check', None
        return 'ok', _latest_obj

    async def _find_latest_from_sources(self):
        latest_source_filename_prefix_int: int = -1
        latest_source_filename: Optional[str] = None
        latest_obj: Optional[T] = None
        await mkdirs(self._objects_dir_path)
        object_filenames = await aios.listdir(self._objects_dir_path)
        for object_filename in object_filenames:
            logger.debug('[{}] start check history : {}', self.name, object_filename)
            if object_filename.endswith('.json') or object_filename == 'latest.json':
                continue
            object_filename_prefix = object_filename[:len(object_filename) - len('.json')]
            try:
                object_filename_prefix_int = int(object_filename_prefix)
            except ValueError:
                logger.warning('[{}] ignore invalid object_filename_prefix={} , _objects_dir_path={}',
                               self.name, object_filename_prefix, self._objects_dir_path)
                continue
            if latest_source_filename_prefix_int >= object_filename_prefix_int:
                continue

            _state, _latest_obj = await self._read_obj(object_filename=object_filename)
            if _state == 'ok':
                latest_source_filename_prefix_int = object_filename_prefix_int
                latest_source_filename = object_filename
                latest_obj = _latest_obj
            elif _state == 'empty' or _state == 'failed_check':
                continue
            elif _state == 'failed_parse_json':
                logger.warning('[{}] Failed to parse json from {}',
                               self.name,
                               os.path.join(self._objects_dir_path, object_filename))
                continue
            else:
                raise ValueError('unknown state {}', _state)
        return latest_source_filename, latest_source_filename_prefix_int, latest_obj

    async def _symlink_latest(self, *, latest_source_filename: OsPath):
        logger.debug('[{}] symlink latest src {}', self.name, latest_source_filename)
        src = (self._objects_dir_path / latest_source_filename).absolute()
        if not await aiofiles.ospath.exists(src):
            raise ValueError(f'Not found src : {src}')
        if await aiofiles.ospath.exists(self._latest_object_path):
            await aiofiles.os.remove(self._latest_object_path)
        await aiofiles.os.symlink(
            src=src,
            dst=self._latest_object_path,
            target_is_directory=False,
        )

    async def read_latest(self, *, expire_time: StoreExpireTime = None):
        logger.debug('[{}] start read latest', self.name)
        async with self._lock:
            logger.debug('[{}] start read latest got lock', self.name)
            if not await aiofiles.ospath.exists(self._latest_object_path):
                latest_source_filename, latest_time, _ = await self._find_latest_from_sources()

                if latest_source_filename is None:
                    return None
                else:
                    await self._symlink_latest(latest_source_filename=latest_source_filename)

                    async def _checker_create_latest():
                        return await aiofiles.ospath.exists(self._latest_object_path)

                    if not await sleep(3, interval=0.5, checker=_checker_create_latest):
                        raise Exception(f'Failed to create latest symlink at {self._latest_object_path} , '
                                        + f'latest_source_filename={latest_source_filename}')
            else:
                link_target = await aiofiles.os.readlink(self._latest_object_path.__str__())
                link_target_basename = os.path.basename(link_target)
                if not link_target_basename.endswith('.json'):
                    raise ValueError(f'Invalid latest.json point to {link_target}')
                latest_time = int(link_target_basename[0:len(link_target_basename) - len('.json')])
                logger.debug('[{}] latest object path exist', self.name)

            logger.debug('[{}] latest_time is {} >>> {}', self.name, latest_time, datetime.fromtimestamp(latest_time))
            if expire_time is not None:
                _now = datetime.now().timestamp()
                if latest_time + expire_time < _now:
                    logger.debug(
                        '[{}] it will return empty because latest_time({}) + expire_time({}) (=={}) < now({}) , delta is {}',
                        self.name, latest_time, expire_time, latest_time + expire_time, _now,
                                                             _now - latest_time - expire_time)
                    return None

            logger.debug('[{}] start read obj from {}', self.name, self._latest_object_path)
            try:
                _state, latest_obj = await self._read_obj(object_filename=self._latest_object_path)
            finally:
                logger.debug('[{}] finish read obj', self.name)
            if _state != 'ok':
                raise Exception(f'Why read latest object failed ? state is {_state} , latest_obj is {latest_obj}')
            return latest_obj

    async def update_latest(self, *, value: T):
        logger.debug('[{}] start update latest', self.name)
        async with self._lock:
            logger.debug('[{}] start update latest got lock', self.name)
            await mkdirs(self._objects_dir_path)
            while True:
                new_file_name = f'{int(datetime.now().timestamp())}.json'
                new_file_path = self._objects_dir_path / new_file_name
                if not await aiofiles.ospath.exists(new_file_path):
                    break
                await sleep(total=1)
            async with aiofiles.open(new_file_path, mode='wt', encoding='utf-8') as f:
                await f.write(json.dumps(value, ensure_ascii=False, indent=2))
            await self._symlink_latest(latest_source_filename=new_file_name)


if __name__ == '__main__':
    pass
