# -*- coding: UTF-8 -*-
from dataclasses import dataclass
from typing import Union, Mapping, List, Optional

JSONRaw = Union[str, int, float, bool, None]
JSONArray = List['JSON']
JSONObject = Mapping[str, 'JSON']
JSON = Union[JSONRaw, JSONArray, JSONObject]

if __name__ == '__main__':
    pass


@dataclass(frozen=True)
class Initiator:
    playwright: bool
    postgres: bool


@dataclass(frozen=True)
class LaunchBrowserParam:
    browser_data_dir_id: Optional[str]


class LibianCrawlerException(Exception):
    def __init__(self, *args: object) -> None:
        super().__init__(*args)


class LibianCrawlerInitConfDisabled(LibianCrawlerException):
    def __init__(self, *args: object) -> None:
        super().__init__(*args)


class LibianCrawlerPermissionException(LibianCrawlerException):
    def __init__(self, *args: object) -> None:
        super().__init__(*args)


class LibianCrawlerBugException(LibianCrawlerException):
    def __init__(self, *args: object) -> None:
        super().__init__(*args)


class TodoException(LibianCrawlerBugException):
    pass
