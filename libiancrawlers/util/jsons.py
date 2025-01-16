# -*- coding: UTF-8 -*-
from typing import Any


def is_json_basic_type(v: Any):
    return (v is None
            or isinstance(v, str)
            or isinstance(v, int)
            or isinstance(v, float)
            or isinstance(v, bool)
            or ((
                        isinstance(v, list)
                        # or isinstance(v, set)
                        or isinstance(v, tuple)
                ) and all([is_json_basic_type(v2) for v2 in v]))
            or (isinstance(v, dict) and all([
                isinstance(k, str) and is_json_basic_type(v[k]) for k in v
            ]))
            )


if __name__ == '__main__':
    pass
