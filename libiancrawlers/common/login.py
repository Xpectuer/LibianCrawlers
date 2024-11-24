# -*- coding: UTF-8 -*-
from abc import abstractmethod


class AbstractLoginState:
    @abstractmethod
    def check(self):
        pass


if __name__ == '__main__':
    pass
