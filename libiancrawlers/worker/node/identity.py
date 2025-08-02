# -*- coding: UTF-8 -*-
import hashlib
import os.path
from typing import Optional, Literal

import aiofiles
import async_to_sync
from Crypto.Cipher import AES
from Crypto.PublicKey import RSA
from Crypto.Util.Padding import pad, unpad
from loguru import logger

from libiancrawlers.app_util.config import read_config_get_path
from libiancrawlers.util.fs import mkdirs, aios, change_file_permissions


def _pwd_bytes_to_aes(password: bytes, opt: Literal['encrypt', 'decrypt'], data: bytes) -> bytes:
    logger.debug('opt is {} , source data length is {}',
                 opt, len(data))
    k = hashlib.sha256(password).digest()
    logger.debug('hashed k length is {}', len(k))
    aes = AES.new(k, AES.MODE_ECB)
    if opt == 'encrypt':
        return aes.encrypt(pad(data, 32))
    elif opt == 'decrypt':
        return unpad(aes.decrypt(data), 32)
    else:
        raise ValueError(f'Invalid opt {opt}')


async def _dump_key_file(*,
                         identity_store_dir: str,
                         key_bytes: bytes,
                         key_file_name: str,
                         password: Optional[str],
                         ):
    await mkdirs(identity_store_dir)

    key_file_path = os.path.join(identity_store_dir, key_file_name)

    if await aios.path.exists(key_file_path):
        logger.warning('key_file_path_existed : {}', key_file_path)
        return False, 'key_file_path_existed'

    invalid_format = False

    if invalid_format:
        logger.warning('unknown_format_key_content')
        return False, 'unknown_format_key_content'

    if password is not None:
        pwd_bytes = password.encode(encoding='utf-8')
        bytes_to_write = _pwd_bytes_to_aes(pwd_bytes, 'encrypt', key_bytes)
    else:
        logger.debug('no password')
        bytes_to_write = key_bytes

    logger.debug('bytes_to_write len {} to file {}',
                 bytes_to_write.__len__(), key_file_path)
    async with aiofiles.open(key_file_path, mode='wb') as f:
        await f.write(bytes_to_write)
        await f.flush()
    logger.debug('write finish')

    await change_file_permissions(key_file_path, 0o0600)

    return True, ''


async def load_identity(tag: str, password: str):
    identity_store_dir = os.path.join(os.path.expanduser("~"), '.libian', 'crawler', 'worker', 'identity_store')


async def generate_new_identity(password: str):
    logger.debug('Start generated new identity')
    if password.__len__() < 12:
        raise ValueError(f'password length should >= 12 , but {password.__len__()}')

    identity_store_dir = await read_config_get_path('worker', 'identity_store_dir',
                                                    allow_null=True,
                                                    create_if_not_exist=False)
    if identity_store_dir is None:
        identity_store_dir = os.path.join(os.path.expanduser("~"), '.libian', 'crawler', 'worker', 'identity_store')

    key = RSA.generate(2048)
    prikey_bytes = key.export_key()
    pubkey_bytes = key.public_key().export_key()

    prikey_res = await _dump_key_file(identity_store_dir=identity_store_dir,
                                      key_bytes=prikey_bytes,
                                      key_file_name='default.prikey.bin',
                                      password=password,
                                      )
    if not prikey_res[0]:
        return False, 'dump_prikey_file_failed', prikey_res
    pubkey_res = await _dump_key_file(identity_store_dir=identity_store_dir,
                                      key_bytes=pubkey_bytes,
                                      key_file_name='default.pubkey.bin',
                                      password=password,
                                      )
    if not pubkey_res[0]:
        return False, 'dump_pubkey_file_failed', prikey_res

    return True, ''


generate_new_identity_sync = async_to_sync.function(generate_new_identity)

if __name__ == '__main__':
    pass
