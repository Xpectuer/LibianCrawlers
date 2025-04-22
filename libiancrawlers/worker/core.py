# -*- coding: UTF-8 -*-
import asyncio
import ipaddress
import socket
import threading
from enum import Enum
from typing import *

from loguru import logger

WorkerCoreStartOption = TypedDict('WorkerCoreStartOption', {
    'sonar_mode': Literal['active', 'passive'],
    'active_sonar_detection_addresses': Optional[List[str]],
})


def create_default_worker_core_start_option() -> WorkerCoreStartOption:
    option: WorkerCoreStartOption = {
        'sonar_mode': 'active',
        'active_sonar_detection_addresses': []
    }
    return option


def _parse_multi_address_str(addr_str: str) -> \
        Generator[Tuple[Union[ipaddress.IPv4Address, ipaddress.IPv6Address], int], Any, None]:
    for addr in addr_str.strip().strip(';').split(';'):
        addr_split = addr.strip().split(':')
        host_net = addr_split[0]
        ports = addr_split[1] if addr_split.__len__() > 1 else '0'
        for host in ipaddress.ip_network(host_net):
            for port in ports.split(','):
                port_range = port.split('-')
                if port_range.__len__() > 2:
                    raise ValueError(f'Invalid port range {port_range}')
                elif port_range.__len__() > 1:
                    for p in range(int(port_range[0]), int(port_range[1]) + 1):
                        yield host, p
                else:
                    yield host, int(port)


WorkerCoreSonarActiveDetectionUdpBroadcastSocket = TypedDict('WorkerCoreSonarActiveDetectionUdpBroadcastSocket', {
    'sock': socket.socket,
    'bind_host': str,
    'bind_port': int,
    'send_to': str,
    'thread': Optional[threading.Thread]
})

_WorkerCoreSonar_instance_counter = 0

HandlersOfReceivePacketOnDetectionFromUdpBroadcast = Tuple[str, Callable[[bytes, str, int], None]]


class WorkerCoreSonarState(Enum):
    Init = 1
    Inited = 2
    Starting = 3
    Started = 4
    Stopping = 5
    Stopped = 6


class WorkerCoreSonar:

    @property
    def state(self):
        return self._state

    def __str__(self):
        name = f'WorkerCoreSonar-{self._instance_counter}'
        info_list: List[str] = []
        if self.state is not None:
            info_list.append(self.state.name)
        if self._active_detection_udp_server_socket_list.__len__() > 0:
            info_list.append('udp-' +
                             ','.join(
                                 map(lambda it: str(it['bind_port']), self._active_detection_udp_server_socket_list)))
        return name + (f"({' '.join(info_list)})" if info_list.__len__() > 0 else '')

    def __init__(self, loop: asyncio.AbstractEventLoop):
        global _WorkerCoreSonar_instance_counter

        self.enable_noisy_debug_logger = False
        self.create_ping_buf_sync = lambda: b'Hi'
        self._state = WorkerCoreSonarState.Init
        self.loop = loop
        self._active_detection_udp_addr_lock = threading.Lock()
        self._active_detection_udp_server_socket_list: List[WorkerCoreSonarActiveDetectionUdpBroadcastSocket] = []
        self._next_thread_name_tag_counters: Dict[str, int] = dict()
        try:
            self._instance_counter = _WorkerCoreSonar_instance_counter
        finally:
            _WorkerCoreSonar_instance_counter += 1
        self._handlers_of_receive_packet_on_detection_from_udp_server: Dict[
            str, HandlersOfReceivePacketOnDetectionFromUdpBroadcast] = dict()
        self.active_detection_timer_interval = 1
        self._active_detection_timer = self._create_active_detection_timer()
        self._state = WorkerCoreSonarState.Inited

    def _create_active_detection_timer(self):
        t = threading.Timer(
            interval=self.active_detection_timer_interval,
            function=self._active_detection_sync,
        )
        t.setDaemon(True)
        t.setName(self._next_thread_name('active_detection_timer'))
        return t

    async def add_detection_addr(self, addr: str):
        return await self.loop.run_in_executor(None, self.add_detection_addr_sync, addr)

    def add_detection_addr_sync(self, addr: str):
        addr = addr.strip('|').split('|')
        if addr[0] == 'udp-server':
            if len(addr) != 5 or addr[1] != 'bind' or addr[3] != 'sendto':
                raise ValueError(f'Invalid udp_server format ! value is {addr}')
            bind_addr = addr[2].split(':')
            if len(bind_addr) == 1:
                bind_host = bind_addr[0]
                bind_port = 0
            else:
                bind_host = bind_addr[0]
                bind_port = int(bind_addr[1])
            if bind_host.strip() == '':
                bind_host = '127.0.0.1'
            send_to = addr[4]
            with self._active_detection_udp_addr_lock:
                for info in self._active_detection_udp_server_socket_list:
                    if info['bind_host'] == bind_host and info['bind_port'] == bind_port:
                        logger.warning(
                            '[{}] already bind socket at {}:{} for worker core sonar active detection udp-server',
                            self, bind_host, bind_port)
                        return False
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                tag_name = self._next_thread_name('udp_server')

                def _worker_thread_for_udp_server():
                    try:
                        if self.enable_noisy_debug_logger:
                            logger.debug('[{}] start worker thread for {}', self, tag_name)
                        while True:
                            try:
                                if self._state == WorkerCoreSonarState.Stopping or self._state == WorkerCoreSonarState.Stopped:
                                    logger.debug('[{}] state is stop , finish worker thread before `sock.recvfrom`')
                                    return
                                packet, _addr = sock.recvfrom(1024)
                                if self.enable_noisy_debug_logger:
                                    logger.debug('[{}] receive packet {} by {}', self, packet, tag_name)
                                for handler_key in self._handlers_of_receive_packet_on_detection_from_udp_server.keys():
                                    if self._state == WorkerCoreSonarState.Stopping or self._state == WorkerCoreSonarState.Stopped:
                                        logger.debug('[{}] state is stop , finish worker thread after `sock.recvfrom`')
                                        return
                                    handler = \
                                        self._handlers_of_receive_packet_on_detection_from_udp_server[handler_key][1]
                                    handler(packet, _addr[0], _addr[1])
                            except BaseException as err:
                                try:
                                    if isinstance(err, ConnectionResetError):
                                        if self.enable_noisy_debug_logger:
                                            logger.debug('[{}] ignore connection reset', self)
                                        continue
                                    if self.state == WorkerCoreSonarState.Stopping or self.state == WorkerCoreSonarState.Stopped:
                                        logger.debug('[{}] Ignore error on sonar stop : {}', self, err)
                                        return
                                    logger.exception('[{}] handle err in sonar udp server worker thread', self)
                                except BaseException as err2:
                                    logger.exception(
                                        'BUG ! Handle err in process other err , in sonar udp server worker thread')
                                    raise err2 from err
                                continue
                        logger.error('Why loop quit ?')
                        raise Exception('Why loop quit ?')
                    finally:
                        if self.enable_noisy_debug_logger:
                            logger.debug('[{}] finish worker thread for {}', self, tag_name)

                thread = threading.Thread(
                    name=tag_name,
                    daemon=True,
                    target=_worker_thread_for_udp_server)

                self._active_detection_udp_server_socket_list.append({
                    'sock': sock,
                    'bind_host': bind_host,
                    'bind_port': bind_port,
                    'send_to': send_to,
                    'thread': thread
                })
                return True
        else:
            raise ValueError(f'Invalid address for sonar : {addr}')

    async def start_with_core(self):
        self._state = WorkerCoreSonarState.Starting
        logger.debug('[{}] sonar starting...', self)

        def launch_udp_server_sync():
            for udp_server in self._active_detection_udp_server_socket_list:
                udp_server['sock'].bind((udp_server['bind_host'], udp_server['bind_port']))
                logger.debug('[{}] socket start bind {}:{} for worker core sonar active detection udp-server',
                             self, udp_server['bind_host'], udp_server['bind_port'])
                udp_server['thread'].start()

        await self.loop.run_in_executor(None, launch_udp_server_sync)
        self._active_detection_timer.start()

        self._state = WorkerCoreSonarState.Started
        logger.debug('[{}] sonar started', self)

    async def stop_with_core(self):
        self._state = WorkerCoreSonarState.Stopping
        logger.debug('[{}] sonar stopping...', self)
        self._active_detection_timer.cancel()

        def stop_udp_server_sync():
            for udp_server in self._active_detection_udp_server_socket_list:
                udp_server['sock'].close()
                if udp_server['thread'].is_alive():
                    pass
                    # udp_server['thread']

        await self.loop.run_in_executor(None, stop_udp_server_sync)
        self._state = WorkerCoreSonarState.Stopped
        logger.debug('[{}] sonar stopped', self)

    def _next_thread_name(self, tag):
        if tag not in self._next_thread_name_tag_counters.keys():
            self._next_thread_name_tag_counters[tag] = 0
        tag_name = f'WorkerCoreSonar-{self._instance_counter}-{tag}-{self._next_thread_name_tag_counters[tag]}'
        self._next_thread_name_tag_counters[tag] += 1
        return tag_name

    async def manually_activate_once(self):
        return self.loop.run_in_executor(None, self.manually_activate_once_sync)

    def manually_activate_once_sync(self):
        if self.enable_noisy_debug_logger:
            logger.debug('[{}] Manually activate once sonar', self)
        self._active_detection_sync()

    def _active_detection_sync(self):
        try:
            if self._state == WorkerCoreSonarState.Stopping or self._state == WorkerCoreSonarState.Stopped:
                return
            t = self._create_active_detection_timer()
            t.start()
            with self._active_detection_udp_addr_lock:
                for udp_server in self._active_detection_udp_server_socket_list:
                    for send_to_host, send_to_port in _parse_multi_address_str(udp_server['send_to']):
                        if self._state == WorkerCoreSonarState.Stopping or self._state == WorkerCoreSonarState.Stopped:
                            t.cancel()
                            return
                        send_to_target = (send_to_host.__str__(), send_to_port)
                        if self.enable_noisy_debug_logger:
                            logger.debug('[{}] send ping packet to {}', self, send_to_target)
                        udp_server['sock'].sendto(self.create_ping_buf_sync(), send_to_target)
        except BaseException:
            logger.exception('[{}] Error on active detection sync', self)
            raise

    def set_handler_of_receive_packet_on_detection_from_udp_server(self,
                                                                   handler: HandlersOfReceivePacketOnDetectionFromUdpBroadcast):
        if handler[0] in self._handlers_of_receive_packet_on_detection_from_udp_server.keys():
            logger.debug('[{}] set and remove handler which key is {}', self, handler[0])
        else:
            logger.debug('[{}] set handler which key is {}', self, handler[0])
        self._handlers_of_receive_packet_on_detection_from_udp_server[handler[0]] = handler


class WorkerCore:
    def __init__(self,
                 loop: asyncio.AbstractEventLoop,
                 option: Optional[WorkerCoreStartOption] = None):
        self.loop = loop
        self._default_socket_server = None
        self._get_default_socket_server_lock = asyncio.Lock()
        if option is None:
            option = create_default_worker_core_start_option()
        self._option = option
        self.sonar = WorkerCoreSonar(loop=self.loop)
        # self._active_sonar_detection_addresses = list(
        #     map(lambda addr: Multiaddr(addr), self._option['active_sonar_detection_addresses'])
        # )

    async def start(self):
        logger.debug('worker core starting ...')
        if self._option['active_sonar_detection_addresses'] \
                and len(self._option['active_sonar_detection_addresses']) > 0:
            for _addr in self._option['active_sonar_detection_addresses']:
                await self.sonar.add_detection_addr(_addr)
        await self.sonar.start_with_core()
        logger.debug('worker core started')

    # async def pause(self):
    #     pass
    #
    # async def resume(self):
    #     pass

    async def stop(self):
        logger.debug('worker core stopping ...')
        await self.sonar.stop_with_core()
        logger.debug('worker core stopped')

    async def _handle_self_node_create_task(self):
        pass

    async def _handle_other_node_create_task(self):
        pass


async def start_worker_core():
    core = WorkerCore(loop=asyncio.get_event_loop())
    await core.start()


def cli():
    from fire import Fire
    Fire(start_worker_core)


if __name__ == '__main__':
    pass
