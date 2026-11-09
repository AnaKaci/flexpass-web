"""Invitation-only registration and partner onboarding regression tests."""
from urllib.parse import urlparse, parse_qs
from fastapi.testclient import TestClient
from backend.app import app
client=TestClient(app)
def auth(role):
    path='/api/auth/admin/login' if role=='admin' else '/api/auth/login'
    response=client.post(path,json={'email':f'{role}@flexpass.demo','password':'Demo123!','portal':role})
    assert response.status_code==200,response.text
    return {'Authorization':'Bearer '+response.json()['token']}

def extract_token(payload):
    url = payload.get('dev_activation_url')
    assert url, 'Local test mode should return an activation URL'
    return parse_qs(urlparse(url).query)['token'][0]

def test_client_must_be_invited_and_can_activate_once():
    admin=auth('admin')
    companies=client.get('/api/admin/companies',headers=admin).json()
    plans=client.get('/api/admin/plans',headers=admin).json()
    response=client.post('/api/admin/employees',headers=admin,json={
        'full_name':'Invited QA Member','email':'invited.qa.member@example.test',
        'company_id':companies[0]['id'],'plan_id':plans[0]['id']})
    assert response.status_code==200,response.text
    invited=response.json()
    token=extract_token(invited)
    assert client.post('/api/auth/login',json={'email':'invited.qa.member@example.test','password':'SamplePassword123!','portal':'employee'}).status_code==401
    assert client.post('/api/auth/activate',json={'token':'wrong'*12,'password':'SamplePassword123!'}).status_code==400
    activated=client.post('/api/auth/activate',json={'token':token,'password':'SamplePassword123!'})
    assert activated.status_code==200,activated.text
    assert activated.json()['role']=='client'
    assert client.post('/api/auth/activate',json={'token':token,'password':'SamplePassword123!'}).status_code==400
    sign_in=client.post('/api/auth/login',json={'email':'invited.qa.member@example.test','password':'SamplePassword123!','portal':'employee'})
    assert sign_in.status_code==200
    assert sign_in.json()['user']['company_id']==companies[0]['id']

def test_admin_registers_partner_and_partner_activates():
    admin=auth('admin')
    assert client.post('/api/admin/partners',json={'name':'Unauthorized','zone':'Blloku','contact_name':'Someone','contact_email':'no@example.test'}).status_code==401
    response=client.post('/api/admin/partners',headers=admin,json={
        'name':'QA Partner Studio','zone':'Blloku','contact_name':'Studio QA',
        'contact_email':'studio.qa.partner@example.test'})
    assert response.status_code==200,response.text
    payload=response.json()
    assert payload['status']=='INVITED'
    token=extract_token(payload)
    assert client.post('/api/auth/activate',json={'token':token,'password':'StrongPartnerPassword123!'}).status_code==200
    login=client.post('/api/auth/login',json={'email':'studio.qa.partner@example.test','password':'StrongPartnerPassword123!','portal':'partner'})
    assert login.status_code==200
    assert login.json()['user']['partner_id']==payload['partner_id']
    assert client.post('/api/auth/admin/login',json={'email':'studio.qa.partner@example.test','password':'StrongPartnerPassword123!','portal':'admin'}).status_code==401
