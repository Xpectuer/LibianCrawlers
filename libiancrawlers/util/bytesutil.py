# -*- coding: UTF-8 -*-


def xor_bytes(a: bytes, b: bytes) -> bytes:
    if len(a) != len(b):
        raise ValueError("Cannot xor non-equal length bytes")
    return bytes(a_byte ^ b_byte for a_byte, b_byte in zip(a, b))




if __name__ == '__main__':
    pass
