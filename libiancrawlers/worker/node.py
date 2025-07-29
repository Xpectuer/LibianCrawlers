# -*- coding: UTF-8 -*-
import os.path

import aiofiles
import async_to_sync
from loguru import logger

from libiancrawlers.app_util.config import read_config, read_config_get_path
from libiancrawlers.util.bytesutil import xor_bytes
from libiancrawlers.util.fs import mkdirs, aios
from Crypto.PublicKey import RSA


def encrypt_identity_data(pwd: bytes, data: bytes):
    return bytes(a ^ b for a, b in zip(pwd, data))


async def generate_new_identity(pri_key_password: str):
    logger.debug('Start generated new identity')
    if pri_key_password.__len__() < 12:
        raise ValueError(f'pri_key_password length should >= 12 , but {pri_key_password.__len__()}')

    identity_store_dir = await read_config_get_path('worker', 'identity_store_dir',
                                                    allow_null=True,
                                                    create_if_not_exist=False)
    if identity_store_dir is None:
        identity_store_dir = os.path.join(os.path.expanduser("~"), '.libian', 'crawler', 'worker', 'identity_store')

    await mkdirs(identity_store_dir)

    keypair_file_path = os.path.join(identity_store_dir, 'default.keypair.json')

    if await aios.path.exists(keypair_file_path):
        raise ValueError('default keypair existed')

    key = RSA.generate(2048)



    key.exportKey()

    xor_bytes()

    async with aiofiles.open(keypair_file_path, mode='wt'):
        pass
    # pri_key_password.__len__()
    # logger.debug('')


generate_new_identity_sync = async_to_sync.function(generate_new_identity)

if __name__ == '__main__':
    pass
