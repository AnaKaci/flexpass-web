"""Validate hosted configuration without changing the demo-mode test database."""
import os
import subprocess
import sys
from pathlib import Path


def run_import(extra_env, code='import backend.app'):
    env = os.environ.copy()
    env.update(extra_env)
    return subprocess.run(
        [sys.executable, '-c', code],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        text=True,
        capture_output=True,
        timeout=15,
    )


def test_production_requires_secure_secret(tmp_path):
    result = run_import({
        'DATABASE_URL': f'sqlite:///{tmp_path / "weak.db"}',
        'FLEXPASS_ENV': 'production',
        'FLEXPASS_DEMO_MODE': 'false',
        'FLEXPASS_SECRET': 'change-me-demo-only-local-secret',
        'FLEXPASS_ADMIN_EMAIL': 'owner@example.test',
        'FLEXPASS_ADMIN_PASSWORD': 'CorrectHorseBattery99!',
    })
    assert result.returncode != 0
    assert 'FLEXPASS_SECRET' in result.stderr


def test_production_admin_bootstrap_has_no_demo_accounts(tmp_path):
    result = run_import({
        'DATABASE_URL': f'sqlite:///{tmp_path / "prod.db"}',
        'FLEXPASS_ENV': 'production',
        'FLEXPASS_DEMO_MODE': 'false',
        'FLEXPASS_SECRET': 'unit-test-only-secret-with-more-than-32-characters',
        'FLEXPASS_ADMIN_EMAIL': 'owner@example.test',
        'FLEXPASS_ADMIN_PASSWORD': 'CorrectHorseBattery99!',
    }, code='''from fastapi.testclient import TestClient
from backend.app import app
c = TestClient(app)
assert c.get('/api/health').json() == {'status': 'ok'}
assert c.post('/api/auth/admin/login', json={'email':'owner@example.test', 'password':'CorrectHorseBattery99!', 'portal':'admin'}).status_code == 200
assert c.post('/api/auth/login', json={'email':'admin@flexpass.demo', 'password':'Demo123!'}).status_code == 401
assert c.get('/api/info').json()['demo_mode'] is False
''')
    assert result.returncode == 0, result.stderr
