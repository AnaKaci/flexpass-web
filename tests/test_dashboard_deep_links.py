"""Dashboard URL deep links must load the SPA after a hard refresh."""
import os
import tempfile
from pathlib import Path

os.environ.setdefault('DATABASE_URL', 'sqlite:///' + str(Path(tempfile.mkdtemp()) / 'deep_link_test.db'))

from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

SECTIONS = {
    'client': ('overview', 'shop', 'discover', 'orders', 'bookings', 'wallet'),
    'employee': ('overview', 'shop', 'discover', 'orders', 'bookings', 'wallet'),
    'partner': ('overview', 'calendar', 'reservations', 'services', 'settlements'),
    'admin': ('overview', 'clients', 'partners', 'products', 'orders', 'settlements', 'audit'),
}


def test_every_dashboard_section_is_served_on_hard_refresh():
    for role, sections in SECTIONS.items():
        for section in sections:
            response = client.get(f'/{role}/{section}')
            assert response.status_code == 200, f'{role}/{section}: {response.status_code}'
            assert 'text/html' in response.headers.get('content-type', '')


def test_invalid_dashboard_section_is_not_served():
    for role in SECTIONS:
        response = client.get(f'/{role}/not-a-real-section')
        assert response.status_code == 404, role


def test_login_and_api_routes_remain_separate_from_dashboard_routes():
    assert client.get('/admin/login').status_code == 200
    assert client.get('/login/client').status_code == 200
    assert client.get('/api/partner/summary').status_code == 401
