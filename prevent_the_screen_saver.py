# -*- coding: UTF-8 -*-
from time import sleep

from libiancrawlers.util.plat import PreventTheScreenSaver


def main():
    with PreventTheScreenSaver():
        while True:
            sleep(1)


if __name__ == '__main__':
    main()
