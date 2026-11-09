"""Personal customer onboarding, credit-package orders and payment separation."""
from urllib.parse import parse_qs, urlparse
from fastapi.testclient import TestClient
from backend.app import app

client=TestClient(app)

def admin_header():
    response=client.post('/api/auth/admin/login',json={'email':'admin@flexpass.demo','password':'Demo123!','portal':'admin'})
    assert response.status_code==200,response.text
    return {'Authorization':'Bearer '+response.json()['token']}

def test_customer_self_registration_purchase_requires_confirmation():
    response=client.post('/api/auth/register',json={'full_name':'Personal QA Client','email':'personal.qa.client@example.test'})
    assert response.status_code==200,response.text
    payload=response.json()
    assert payload['status']=='INVITED'
    token=parse_qs(urlparse(payload['dev_activation_url']).query)['token'][0]
    assert client.post('/api/auth/login',json={'email':'personal.qa.client@example.test','password':'PersonalPassword123!','portal':'client'}).status_code==401
    activated=client.post('/api/auth/activate',json={'token':token,'password':'PersonalPassword123!'})
    assert activated.status_code==200,activated.text
    assert activated.json()['role']=='client'
    assert client.post('/api/auth/activate',json={'token':token,'password':'PersonalPassword123!'}).status_code==400
    login=client.post('/api/auth/login',json={'email':'personal.qa.client@example.test','password':'PersonalPassword123!','portal':'client'})
    assert login.status_code==200,login.text
    assert login.json()['user']['company_id'] is None
    assert login.json()['user']['plan_id'] is None
    auth={'Authorization':'Bearer '+login.json()['token']}
    summary=client.get('/api/client/summary',headers=auth).json()
    assert summary['personal_account'] is True
    assert summary['balance']==0
    assert client.post('/api/auth/admin/login',json={'email':'personal.qa.client@example.test','password':'PersonalPassword123!','portal':'admin'}).status_code==401
    admin=admin_header()
    product=client.post('/api/admin/client-products',json={'name':'QA Personal Pack','credits':12,'price_cents':249900},headers=admin)
    assert product.status_code==200,product.text
    product_id=product.json()['id']
    assert client.post('/api/admin/client-products',json={'name':'Unauthorized Pack','credits':1,'price_cents':100},headers=auth).status_code==403
    key='qa-personal-purchase-key-2026'
    request=client.post('/api/client/orders',headers=auth,json={'product_id':product_id,'request_key':key})
    assert request.status_code==200,request.text
    order=request.json()
    assert order['status']=='PENDING'
    assert order['credits']==12
    assert order['amount_cents']==249900
    repeated=client.post('/api/client/orders',headers=auth,json={'product_id':product_id,'request_key':key})
    assert repeated.status_code==200
    assert repeated.json()['id']==order['id']
    assert client.get('/api/client/summary',headers=auth).json()['balance']==0
    assert client.post(f"/api/admin/client-orders/{order['id']}/confirm",headers=auth,json={'payment_reference':'TEST-PAID-001'}).status_code==403
    confirmed=client.post(f"/api/admin/client-orders/{order['id']}/confirm",headers=admin,json={'payment_reference':'TEST-PAID-001'})
    assert confirmed.status_code==200,confirmed.text
    assert confirmed.json()['status']=='CONFIRMED'
    assert client.get('/api/client/summary',headers=auth).json()['balance']==12
    assert client.post(f"/api/admin/client-orders/{order['id']}/confirm",headers=admin,json={'payment_reference':'TEST-PAID-002'}).status_code==409
    assert client.get('/api/client/summary',headers=auth).json()['balance']==12
    ledger=client.get('/api/client/ledger',headers=auth).json()
    assert len([x for x in ledger if x['kind']=='ALLOCATION' and x['amount']==12])==1

def test_customer_cannot_access_another_customers_orders():
    admin=admin_header()
    all_orders=client.get('/api/admin/client-orders',headers=admin).json()
    assert all_orders
    other=client.post('/api/auth/login',json={'email':'employee@flexpass.demo','password':'Demo123!','portal':'client'})
    assert other.status_code==200
    private={'Authorization':'Bearer '+other.json()['token']}
    orders=client.get('/api/client/orders',headers=private).json()
    assert all(order['client_id']==other.json()['user']['id'] for order in orders)
    assert client.get('/api/admin/client-orders',headers=private).status_code==403
    assert client.post('/api/client/orders',json={'product_id':1,'request_key':'anonymous-test-key'}).status_code==401
