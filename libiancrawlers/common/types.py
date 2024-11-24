# -*- coding: UTF-8 -*-
from dataclasses import dataclass
from typing import Union, Mapping, List

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


class TODO(Exception):
    def __init__(self, *args: object) -> None:
        super().__init__(*args)


class AppInitConfDisable(Exception):
    def __init__(self, *args: object) -> None:
        super().__init__(*args)


@dataclass(frozen=True)
class LaunchBrowserParam:
    browser_data_dir_id: str
