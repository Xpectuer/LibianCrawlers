# -*- coding: UTF-8 -*-
from typing import TypeVar, Dict, List, Union, Tuple, Optional, Literal

K = TypeVar('K')
V = TypeVar('V')


def find_first_value_not_null(d: Dict[K, V], *, keys: List[K]) -> Tuple[bool, Optional[K], Optional[V]]:
    for k in keys:
        v = d.get(k)
        if v is not None:
            return True, k, v
    return False, None, None


if __name__ == '__main__':
    pass
