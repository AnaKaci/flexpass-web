"""Regression coverage for features transferred from the earlier FlexPass pilot."""
from fastapi.testclient import TestClient
from backend.app import app
client=TestClient(app)
def auth(role):
    response=client.post('/api/auth/login',json={'email':f'{role}@flexpass.demo','password':'Demo123!'})
    assert response.status_code==200,response.text
    return {'Authorization':'Bearer '+response.json()['token']}

def test_booking_idempotency_key_replays_once():
    employee = auth('employee')
    service = client.get('/api/catalog?group=wellness').json()[0]
    slot_id = service['slots'][-1]['id']
    headers = {**employee, 'Idempotency-Key': 'test-previous-demo-key'}
    first = client.post('/api/bookings', headers=headers, json={'slot_id': slot_id})
    assert first.status_code == 200, first.text
    second = client.post('/api/bookings', headers=headers, json={'slot_id': slot_id})
    assert second.status_code == 200
    assert second.json()['id'] == first.json()['id']
    other_slot = service['slots'][-2]['id']
    assert client.post('/api/bookings', headers=headers, json={'slot_id': other_slot}).status_code == 409

def test_only_three_mvp_roles_are_exposed():
    from backend.app import app
    paths={route.path for route in app.routes}
    assert not any(path.startswith('/api/hr/') for path in paths)
    assert '/hr' not in paths
    assert client.post('/api/auth/login',json={'email':'hr@flexpass.demo','password':'Demo123!'}).status_code==401

def test_partner_payout_csv_access():
    partner=auth('partner')
    admin=auth('admin')
    employee=auth('employee')
    assert client.get('/api/partner/payouts/export',headers=partner).status_code==200
    assert client.get('/api/partner/payouts/export?start=invalid',headers=partner).status_code==400
    assert client.get('/api/partner/payouts/export',headers=employee).status_code==403
    assert client.get('/api/partner/payouts/export',headers=admin).status_code==403
    r=client.get('/api/partner/payouts/export',headers=partner)
    assert r.text.startswith('Booking reference,Service,Completed at (UTC),Credits,Partner payout (ALL),Status')
