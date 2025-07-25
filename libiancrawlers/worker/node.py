# -*- coding: UTF-8 -*-
import async_to_sync
from loguru import logger


def encrypt_identity_data(pwd: bytes, data: bytes):
    return bytes(a ^ b for a, b in zip(pwd, data))


async def generate_new_identity(pri_key_password: str):
    logger.debug('Start generated new identity')


generate_new_identity_sync = async_to_sync.function(generate_new_identity)

if __name__ == '__main__':
    pass
