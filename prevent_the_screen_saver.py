# -*- coding: UTF-8 -*-
import os.path
from time import sleep

from libiancrawlers.util.plat import PreventTheScreenSaver

project_root_dir = os.path.dirname(__file__)


def main():
    with PreventTheScreenSaver():
        while True:
            sleep(1)


if __name__ == '__main__':
    main()
