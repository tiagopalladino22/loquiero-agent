#!/usr/bin/env python3
import os, re, signal, subprocess, time, urllib.request
from pathlib import Path

ROOT = Path('/opt/data/loquiero-agent')
ENV_FILE = ROOT / '.env'
BRIDGE = ROOT / 'kapso-bridge.mjs'
PID_BRIDGE = ROOT / 'kapso-bridge.pid'
PID_TUNNEL = ROOT / 'cloudflared.pid'
TUNNEL_LOG = ROOT / 'cloudflared.log'
PUBLIC_URL_FILE = ROOT / 'public-url.txt'
PHONE_NUMBER_ID = '1329393980246912'
WEBHOOK_ID = 'bf68e5d3-c4c3-4aef-88c5-f1631db65f80'
CLOUDFLARED = '/opt/data/bin/cloudflared'

def load_env():
    env = os.environ.copy()
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if not line.strip() or line.lstrip().startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    env['KAPSO_PHONE_NUMBER_ID'] = PHONE_NUMBER_ID
    env.pop('KAPSO_BRIDGE_SECRET', None)
    return env

def alive(pidfile):
    try:
        pid = int(pidfile.read_text().strip())
        os.kill(pid, 0)
        return pid
    except Exception:
        return None

def kill(pidfile):
    pid = alive(pidfile)
    if pid:
        try: os.kill(pid, signal.SIGTERM)
        except Exception: pass
    try: pidfile.unlink()
    except Exception: pass

def http_ok(url, timeout=8):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return 200 <= r.status < 300
    except Exception:
        # Docker's embedded DNS sometimes fails to resolve fresh quick-tunnel
        # hostnames. Fall back to curl with DNS-over-HTTPS before declaring it bad.
        if '.trycloudflare.com' in url and 'api.trycloudflare.com' not in url:
            try:
                r = subprocess.run(
                    ['curl', '-fsS', '--doh-url', 'https://cloudflare-dns.com/dns-query', '--max-time', str(timeout), url],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=timeout + 3
                )
                return r.returncode == 0
            except Exception:
                return False
        return False

def start_bridge(env):
    if http_ok('http://127.0.0.1:8787/health', 3):
        return False
    kill(PID_BRIDGE)
    log = open(ROOT / 'kapso-bridge.stdout.log', 'ab')
    p = subprocess.Popen(['node', str(BRIDGE)], env=env, stdout=log, stderr=log, start_new_session=True)
    PID_BRIDGE.write_text(str(p.pid))
    time.sleep(2)
    return True

def start_tunnel():
    current = PUBLIC_URL_FILE.read_text().strip() if PUBLIC_URL_FILE.exists() else ''
    if current == 'https://api.trycloudflare.com':
        current = ''
    if current and http_ok(current + '/health', 8):
        return None
    kill(PID_TUNNEL)
    TUNNEL_LOG.write_text('')
    log = open(TUNNEL_LOG, 'ab')
    p = subprocess.Popen([CLOUDFLARED, 'tunnel', '--url', 'http://127.0.0.1:8787', '--no-autoupdate'], stdout=log, stderr=log, start_new_session=True)
    PID_TUNNEL.write_text(str(p.pid))
    url = None
    for _ in range(30):
        time.sleep(1)
        text = TUNNEL_LOG.read_text(errors='ignore') if TUNNEL_LOG.exists() else ''
        urls = re.findall(r'https://[-a-z0-9]+\.trycloudflare\.com', text)
        for url in urls:
            # Ignore Cloudflare's API host from error messages; it is not a public tunnel.
            if url == 'https://api.trycloudflare.com':
                continue
            if http_ok(url + '/health', 8):
                PUBLIC_URL_FILE.write_text(url)
                return url
    raise RuntimeError('cloudflared did not produce a healthy URL')

def update_webhook(url):
    subprocess.run([
        'npx','-y','@kapso/cli','whatsapp','webhooks','update',WEBHOOK_ID,
        '--phone-number-id',PHONE_NUMBER_ID,'--url',url + '/kapso','--active','--output','json'
    ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=90)

changed=[]
env=load_env()
if start_bridge(env): changed.append('bridge restarted')
new_url=start_tunnel()
if new_url:
    update_webhook(new_url)
    changed.append('tunnel updated '+new_url)
if changed:
    print('LO QUIERO watchdog: ' + '; '.join(changed))
