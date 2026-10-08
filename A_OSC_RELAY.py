"""A-zone HTTP -> OSC. Paste into a TD Text DAT and Run Script, or run Python."""
import argparse
import builtins
import datetime
import json
import math
import os
import socket
import ssl
import struct
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from pathlib import Path


def validate_config(data):
    host = data.get('host')
    if not isinstance(host, str):
        raise ValueError('請輸入 A 主機 IPv4 位址')
    parts = host.split('.')
    if len(parts) != 4 or any(not p.isdigit() or str(int(p)) != p or not 0 <= int(p) <= 255 for p in parts):
        raise ValueError('請輸入 A 主機 IPv4 位址')
    result = dict(host=host, port=data.get('port'), replyPort=data.get('replyPort', 9202))
    for name in ('port', 'replyPort'):
        if type(result[name]) is not int or not (1024 if name == 'replyPort' else 1) <= result[name] <= 65535:
            raise ValueError('Port 超出有效範圍')
    for kind in ('scene', 'view'):
        name = kind + 'Address'
        if name in data:
            value = data[name]
            if not isinstance(value, str) or not value.startswith('/') or len(value) < 2 or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_/-' for c in value):
                raise ValueError('OSC 位址需以 / 開頭，使用英數字、底線或斜線')
            result[name] = value
    if result.get('sceneAddress', '/ac/scene') == result.get('viewAddress', '/ac/view'):
        raise ValueError('幕次與開關需使用不同 OSC 通道')
    return result


def validate_playback(data):
    values = data.get('durations')
    if not isinstance(values, list) or len(values) != 5 or values[2] is not None:
        raise ValueError('第三幕固定等待手勢，秒數需為 null')
    for i in (0, 1, 3, 4):
        if type(values[i]) not in (int, float) or not math.isfinite(values[i]) or not .1 <= values[i] <= 86400:
            raise ValueError('幕次秒數必須介於 0.1–86400')
    return dict(durations=values[:])


def osc_string(value):
    data = value.encode('utf-8') + b'\0'
    return data + b'\0' * (-len(data) % 4)


def encode_osc(address, value):
    return osc_string(address) + (osc_string(',s') + osc_string(value) if isinstance(value, str) else osc_string(',i') + struct.pack('>i', value))


def decode_osc(packet):
    offset = 0
    def string():
        nonlocal offset
        end = packet.index(b'\0', offset)
        value = packet[offset:end].decode('utf-8')
        offset = (end + 4) & ~3
        if offset > len(packet):
            raise ValueError('Truncated OSC')
        return value
    address, types = string(), string()
    if not address.startswith('/') or types != ',s':
        raise ValueError('Expected OSC state string')
    return address, string()


class Relay:
    def __init__(self, bind='0.0.0.0', http_port=8788, osc_host='127.0.0.1',
                 osc_port=9200, reply_port=9202, cert=None, key=None, config_path=None):
        socket.inet_aton(osc_host)
        for port in (http_port, osc_port, reply_port):
            if type(port) is not int or not 1 <= port <= 65535:
                raise ValueError('Ports must be 1..65535')
        self.config = dict(host=osc_host, port=osc_port, replyPort=reply_port)
        self.bind, self.config_path = bind, Path(config_path) if config_path else None
        if self.config_path and self.config_path.exists():
            self.config = validate_config(json.loads(self.config_path.read_text(encoding='utf-8-sig')))
        self.lock = threading.RLock()
        self.stopped = threading.Event()
        self.live, self.received, self.count, self.last_sent = None, 0.0, 0, None
        self.primary_at, self.pending, self.hand_pending, self.hand_clients = 0.0, {}, False, {}
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.bind((bind, self.config['replyPort']))
        self.socket.settimeout(0.5)
        self.http = None
        try:
            self.http = ThreadingHTTPServer((bind, http_port), Handler)
            self.http.relay = self
            if cert or key:
                if not cert or not key:
                    raise ValueError('HTTPS requires both certificate and key')
                context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                context.load_cert_chain(cert, key)
                self.http.socket = context.wrap_socket(self.http.socket, server_side=True)
            self.scheme, self.port = 'https' if cert else 'http', http_port
        except Exception:
            self.socket.close()
            if self.http is not None:
                self.http.server_close()
            raise

    def send(self, address, value):
        self.socket.sendto(encode_osc(address, value), (self.config['host'], self.config['port']))

    def receive(self):
        while not self.stopped.is_set():
            try:
                packet, peer = self.socket.recvfrom(65535)
                if peer[0] != self.config['host']:
                    continue
                address, data = decode_osc(packet)
                state = json.loads(data)
                if (address != '/ac/web/state' or type(state.get('sceneIndex')) is not int
                        or not 0 <= state['sceneIndex'] <= 4 or type(state.get('view')) is not int
                        or state['view'] not in (0, 1)):
                    continue
                with self.lock:
                    self.live, self.received = state, time.monotonic()
                    for kind, value in list(self.pending.items()):
                        actual = int(bool(state.get('playback', {}).get('automatic'))) if kind == 'mode' else state['sceneIndex' if kind == 'scene' else 'view']
                        if actual == value:
                            self.pending.pop(kind)
                    if state['sceneIndex'] != 2:
                        self.hand_pending = False
            except socket.timeout:
                continue
            except (ValueError, KeyError, TypeError, UnicodeError, AttributeError):
                continue
            except OSError:
                if self.stopped.is_set():
                    return

    def ping(self):
        while not self.stopped.is_set():
            try:
                self.send('/ac/web/ping', self.config['replyPort'])
            except OSError:
                pass
            self.stopped.wait(1.0)

    def status(self):
        with self.lock:
            age = time.monotonic() - self.received
            return dict(config=dict(self.config), connected=bool(self.live and age < 3.5),
                        ageMs=round(age * 1000) if self.received else None,
                        state=dict(self.live) if self.live else None, lastSent=self.last_sent,
                        count=self.count, lastError='', replyPort=self.config['replyPort'], urls=[])

    def record(self, address, value, source):
        self.count += 1
        self.last_sent = dict(address=address, value=value, source=source,
                              time=datetime.datetime.now(datetime.timezone.utc).isoformat())

    def command(self, data):
        kind, value = data.get('kind'), data.get('value')
        maximum = 4 if kind == 'scene' else 1 if kind in ('view', 'mode') else -1
        if type(value) is not int or not 0 <= value <= maximum:
            raise ValueError('Scene 需為 0–4；View 需為 0／1')
        with self.lock:
            if not self.status()['connected']:
                raise ValueError('TD 尚未回報，請確認 A 檔已開啟及 OSC 9200')
            if kind == 'mode' and not self.live.get('playback'):
                raise ValueError('此 TD 版本尚未支援自動／手動，請使用更新後的 A 檔')
            address = self.config.get(kind + 'Address', '/ac/' + kind)
            self.send(address, value)
            self.pending[kind] = value
            self.primary_at, self.hand_pending = time.monotonic(), False
            self.record(address, value, 'primary')
            self.send('/ac/web/ping', self.config['replyPort'])
        return dict(sent=True, address=address, value=value)

    def hand(self, data):
        value, client = data.get('value'), data.get('clientId')
        if type(value) is not int or value not in (0, 1) or not isinstance(client, str) or not 0 < len(client) <= 100:
            raise ValueError('手勢需 clientId 與數字 0／1')
        with self.lock:
            previous = self.hand_clients.get(client, 0)
            if len(self.hand_clients) >= 512 and client not in self.hand_clients:
                self.hand_clients.pop(next(iter(self.hand_clients)))
            self.hand_clients[client] = value
            reason = None
            if value == 0 or previous == 1:
                reason = '放開或重複訊號'
            elif not self.status()['connected']:
                reason = 'A 主機未連線'
            elif self.pending or time.monotonic() - self.primary_at < 1.5 or self.hand_pending:
                reason = 'A 區主控正在切換'
            elif self.live['view'] != 1 or self.live['sceneIndex'] != 2:
                reason = '僅 A 區開啟且位於 Scene3 時可觸發'
            if reason:
                return dict(sent=False, reason=reason)
            address = self.config.get('sceneAddress', '/ac/scene')
            self.send(address, 3)
            self.hand_pending = True
            self.record(address, 3, 'hand')
            self.send('/ac/web/ping', self.config['replyPort'])
            return dict(sent=True, sceneIndex=3, reason='已請求 Scene3 → Scene4')

    def configure(self, data):
        next_config = validate_config(data)
        with self.lock:
            replacement = None
            if next_config['replyPort'] != self.config['replyPort']:
                replacement = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                try:
                    replacement.bind((self.bind, next_config['replyPort']))
                    replacement.settimeout(.5)
                except OSError:
                    replacement.close()
                    raise ValueError('回傳 Port 已被其他程式使用，原設定保留')
            try:
                if self.config_path:
                    self.config_path.parent.mkdir(parents=True, exist_ok=True)
                    temporary = self.config_path.with_suffix('.tmp')
                    temporary.write_text(json.dumps(next_config, indent=2) + '\n', encoding='utf-8')
                    os.replace(temporary, self.config_path)
            except OSError:
                if replacement:
                    replacement.close()
                raise
            if replacement:
                previous, self.socket = self.socket, replacement
                previous.close()
            self.config = next_config
            self.live, self.received, self.pending = None, 0.0, {}
            self.hand_pending, self.hand_clients = False, {}
            self.send('/ac/web/ping', self.config['replyPort'])
            return dict(config=dict(self.config))

    def playback(self, data):
        profile = validate_playback(data)
        with self.lock:
            if not self.status()['connected'] or not self.live.get('playback'):
                raise ValueError('請先連線至支援自動／手動的 A 檔')
            value = json.dumps(profile, separators=(',', ':'))
            self.send('/ac/playback', value)
            self.record('/ac/playback', profile, 'primary')
            self.send('/ac/web/ping', self.config['replyPort'])
        return dict(sent=True, **profile)

    def start(self):
        for task in (self.receive, self.ping, self.http.serve_forever):
            threading.Thread(target=task, daemon=True).start()
        print('A OSC Relay %s://電腦IP:%d | UDP %s:%d | reply %d' %
              (self.scheme, self.port, self.config['host'], self.config['port'], self.config['replyPort']))
        return self

    def stop(self):
        self.stopped.set()
        self.http.shutdown()
        self.http.server_close()
        self.socket.close()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def allowed(self):
        origin = self.headers.get('Origin')
        return not origin or origin == 'https://vistwinproject.github.io' or urlsplit(origin).netloc == self.headers.get('Host')

    def reply(self, code, data):
        payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        origin = self.headers.get('Origin')
        if origin and self.allowed():
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '600')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(0 if code == 204 else len(payload)))
        self.end_headers()
        if code != 204:
            self.wfile.write(payload)

    def do_OPTIONS(self):
        self.reply(204 if self.allowed() else 403, {})

    def do_GET(self):
        if not self.allowed():
            return self.reply(403, {'error': 'Origin denied'})
        if urlsplit(self.path).path == '/api/status':
            return self.reply(200, self.server.relay.status())
        self.reply(404, {'error': 'Not found'})

    def do_POST(self):
        if not self.allowed():
            return self.reply(403, {'error': 'Origin denied'})
        route = urlsplit(self.path).path
        routes = {'/api/command': 'command', '/api/hand': 'hand', '/api/config': 'configure', '/api/playback': 'playback'}
        if route not in routes:
            return self.reply(404, {'error': 'Not found'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 4096:
                raise ValueError('Invalid request length')
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('Expected command object')
            value = getattr(self.server.relay, routes[route])(data)
            self.reply(200, value)
        except (ValueError, KeyError, TypeError, OSError) as error:
            self.reply(400, {'error': str(error)})


def start(**options):
    # A repeat run releases only this script's own previous relay.
    previous = getattr(builtins, '_ac_a_zone_osc_relay', None)
    if previous is not None:
        previous.stop()
    if 'config_path' not in options:
        if 'td' in sys.modules and 'project' in globals():
            options['config_path'] = str(Path(project.folder) / 'web/A_ZONE_OSC/config.json')
        elif '__file__' in globals():
            options['config_path'] = str(Path(__file__).with_name('config.json'))
    instance = Relay(**options).start()
    globals()['A_OSC_RELAY_INSTANCE'] = instance
    builtins._ac_a_zone_osc_relay = instance
    return instance


if __name__ == '__main__':
    if 'td' in sys.modules:
        start()
    else:
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument('--bind', default='0.0.0.0')
        parser.add_argument('--http-port', type=int, default=8788)
        parser.add_argument('--osc-host', default='127.0.0.1')
        parser.add_argument('--osc-port', type=int, default=9200)
        parser.add_argument('--reply-port', type=int, default=9202)
        parser.add_argument('--cert')
        parser.add_argument('--key')
        instance = start(**vars(parser.parse_args()))
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            instance.stop()
elif 'td' in sys.modules:
    start()
