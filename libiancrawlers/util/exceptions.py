# -*- coding: UTF-8 -*-


def is_timeout_error(err: BaseException):
    import playwright.async_api
    import asyncio

    for err_type_timeout in [playwright.async_api.TimeoutError,
                             asyncio.TimeoutError,
                             TimeoutError]:
        if isinstance(err, err_type_timeout):
            return True
    return False


if __name__ == '__main__':
    pass
