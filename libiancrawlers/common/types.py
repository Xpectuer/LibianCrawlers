# -*- coding: UTF-8 -*-
from typing import Union, Mapping, List, TYPE_CHECKING

JSONRaw = Union[str, int, float, bool, None]
JSONArray = List['JSON']
JSONObject = Mapping[str, 'JSON']
JSON = Union[JSONRaw, JSONArray, JSONObject]

if __name__ == '__main__':
    pass
