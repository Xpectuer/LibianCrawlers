# -*- coding: UTF-8 -*-
import shlex
import subprocess
import os
from dataclasses import dataclass
from typing import List, Optional

from loguru import logger

from libiancrawlers.app_util.types import TodoException, LibianCrawlerPermissionException, LibianCrawlerException, \
    LibianCrawlerBugException
from libiancrawlers.util.coroutines import blocking_func
from libiancrawlers.util.plat import is_windows
from libiancrawlers.util.timefmt import logd_time


class ShellRunFailedException(LibianCrawlerException):
    def __init__(self, *args: object,
                 proc: subprocess.Popen[str],
                 stdout_str: str,
                 stderr_str: str,
                 cmd_str: str,
                 cmd: List[str]
                 ) -> None:
        super().__init__(*args)
        self.proc = proc
        self.stdout_str = stdout_str
        self.stderr_str = stderr_str
        self.cmd_str = cmd_str
        self.cmd = cmd


class PipeclnrShellRunDenyException(LibianCrawlerPermissionException):
    def __init__(self, *args: object) -> None:
        super().__init__(*args)


# noinspection SpellCheckingInspection
@logd_time
# noinspection SpellCheckingInspection
def shell_run_sync(cmd: List[str],
                   *,
                   timeout: Optional[float] = None,
                   raise_on_not_zero: bool = True,
                   logd_cmd_str: bool = True,
                   capture_output: bool = True
                   ):
    if cmd[0] == 'ffmpeg' and '-y' not in cmd:
        if len(cmd) == 2 and cmd[1] == '-version':
            pass
        else:
            # Some script will wait input , it will block the no daemon thread !
            raise LibianCrawlerBugException(
                f'You should pass -y argument for command {cmd}')
    # noinspection PyTypeChecker
    proc: subprocess.Popen[str] = None
    stdout_str: str = '' if capture_output else None
    stderr_str: str = '' if capture_output else None
    cmd_str: str
    if is_windows():
        cmd_str = subprocess.list2cmdline(cmd)
    else:
        cmd_str = ' '.join(map(shlex.quote, cmd))
    try:
        proc = subprocess.Popen(
            cmd_str,
            shell=True,
            text=True,
            stdout=subprocess.PIPE if capture_output else None,
            stderr=subprocess.PIPE if capture_output else None,
            bufsize=-1,
        )

        from threading import current_thread
        ct = current_thread()
        logger.debug('🐤 Subprocess {} start , thread is <daemon={},name={}> , {}',
                     proc.pid,
                     ct.daemon,
                     ct.name,
                     cmd_str if logd_cmd_str else '(not logd cmd_str)'
                     )
        from datetime import datetime

        @logd_time
        def sub_proc_run():
            return proc.communicate(timeout=timeout)

        stdout_str, stderr_str = sub_proc_run()

        logger.debug('🐥 Subprocess {} finish', proc.pid)

        if raise_on_not_zero and proc.returncode != 0:
            raise ValueError('Return code not zero !')
        return stdout_str, stderr_str, proc
    except BaseException as err:
        raise ShellRunFailedException(
            ('A error on shell_run_sync !'
             + '\n code       :  %s'
             + '\n cmd_str    :  %s'
             + '\n stdout_str :  %s'
             + '\n stderr_str :  %s'
             + '\n cause      :  %s'
             ) % (
                None if proc is None else proc.returncode,
                cmd_str,
                stdout_str,
                stderr_str,
                repr(err)
            ),
            proc=proc,
            stdout_str=stdout_str,
            stderr_str=stderr_str,
            cmd_str=cmd_str,
            cmd=cmd,
        ) from err
    finally:
        if proc is not None and proc.returncode is None:
            logger.warning('{} was finish , but proc return code is None ! proc is {} ', shell_run_sync.__name__, proc)


shell_run = blocking_func(subprocess_communicate=True)(shell_run_sync)


@dataclass
class CmdMulti:
    cmd: List[str]
    title: str
    tab_color: Optional[str] = None
    timeout: Optional[float] = None
    raise_on_not_zero: Optional[bool] = None
    logd_cmd_str: Optional[bool] = None
    capture_output: Optional[bool] = None


def shell_run_and_show(cmds: List[CmdMulti], *, total_title: str, run_in_new_thread=True, ):
    if is_windows():
        exist_wt_stdout, _, exist_wt_proc = shell_run_sync(['where', 'wt'], raise_on_not_zero=False)
        logger.debug('where wt {} , output : {}', exist_wt_proc.returncode, exist_wt_stdout)
        use_wt = exist_wt_proc.returncode == 0 and all(
            c.timeout is None
            and c.raise_on_not_zero is None
            and (c.capture_output is None or c.capture_output is False)
            and (c.logd_cmd_str is None or c.logd_cmd_str is True)
            for c in cmds
        )
    else:
        use_wt = False

    if use_wt:
        wt_cmd = []
        for idx in range(len(cmds)):
            c = cmds[idx]
            if idx == 0:
                wt_cmd.extend([
                    'wt',
                    'new-tab',
                    '--title',
                    total_title
                ])
            else:
                wt_cmd.extend([
                    ';',
                    'split-pane',
                    '--title',
                    total_title,
                ])

            _tab_color = c.tab_color
            if _tab_color is not None:
                wt_cmd.extend([
                    '--tabColor',
                    _tab_color
                ])
            wt_cmd.extend([
                'PowerShell',
                '-c',
                *c.cmd
            ])

        logger.debug('wt_cmd is {}', wt_cmd)
        if not run_in_new_thread:
            logger.warning('wt command will exit at start , so cmds always not blocking')
        return shell_run_sync(wt_cmd, capture_output=False, logd_cmd_str=True)
    elif is_windows():
        logger.debug('Start get-content log thread')

        def _start_cmd_func(_cmd: CmdMulti):
            return shell_run_sync(
                [
                    'start',
                    'cmd',
                    '/k',
                    'powershell.exe',
                    'chcp 65001',
                    ';',
                    *_cmd.cmd,
                ],
                timeout=_cmd.timeout,
                raise_on_not_zero=True if _cmd.raise_on_not_zero is None else _cmd.raise_on_not_zero,
                logd_cmd_str=True if _cmd.logd_cmd_str is None else _cmd.logd_cmd_str,
                capture_output=True if _cmd.capture_output is None else _cmd.capture_output,
            )

        if run_in_new_thread:
            from threading import Thread
            from libiancrawlers.util.iter import map_item_to_runnable

            def _create_and_start_thread(_c_local: CmdMulti):
                _thread = Thread(
                    name=f'Shell_Thread-{c.title}',
                    target=lambda: _start_cmd_func(_c_local),
                    daemon=True
                )
                _thread.start()
                return _thread

            return list(
                create_and_start_thread()
                for create_and_start_thread in map_item_to_runnable(cmds, _create_and_start_thread)
            )

        else:
            return list(_start_cmd_func(c) for c in cmds)

        # logger.debug('End get-content log thread , return code is {}', proc.returncode)
    else:
        raise TodoException()


def whereis_sync(exe_name: str) -> List[str]:
    if is_windows():
        stdout, _, _ = shell_run_sync(['where', exe_name])
        return stdout.strip().split('\r\n')
    else:
        stdout, _, _ = shell_run_sync(['whereis', exe_name])
        return stdout.strip().split('\n')


# def is_file_was_media_sync(media_file_path: str):
#     """
#     判断一个文件是否是音视频文件。
#     """
#     from pipeclnr.core.initializer import require_init_ffmpeg_shell_sync
#     require_init_ffmpeg_shell_sync()
#
#     stdout, _, proc = shell_run_sync(
#         [
#             'ffprobe',
#             '-loglevel',
#             'error',
#             "-show_entries",
#             "format=format_name,format_long_name",
#             "-of",
#             "default=nw=1",
#             media_file_path
#         ],
#         capture_output=False,
#         raise_on_not_zero=False,
#     )
#     if proc.returncode != 0:
#         return False
#     import filetype
#     return filetype.is_video(media_file_path) or filetype.is_audio(media_file_path)


def explore_windows(path: str):
    filebrowser_path = os.path.join(os.getenv('WINDIR'), 'explorer.exe')

    # explorer would choke on forward slashes
    path = os.path.normpath(path)

    if os.path.isdir(path):
        subprocess.run([filebrowser_path, path])
    elif os.path.isfile(path):
        subprocess.run([filebrowser_path, '/select,', path])


if __name__ == '__main__':
    pass
