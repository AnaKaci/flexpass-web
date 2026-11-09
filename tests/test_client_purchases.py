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

def test_demo_bank_transfer_is_idempotent_and_owner_scoped():
    from backend.app import Session, User, CreditProduct, ClientOrder, Ledger, hash_pass, now
    from sqlalchemy import select
    with Session() as db:
        user=User(email='bank.test.client@example.test',full_name='Bank QA Client',role='client',
                  password_hash=hash_pass('TestBankPassword123!'),membership_status='ACTIVE')
        db.add(user)
        product=CreditProduct(name='QA Sandbox Bank Pack',credits=7,price_cents=199900)
        db.add(product)
        db.commit()
        user_id=user.id
        product_id=product.id
    response=client.post('/api/auth/login',json={'email':'bank.test.client@example.test','password':'TestBankPassword123!','portal':'client'})
    assert response.status_code==200,response.text
    auth={'Authorization':'Bearer '+response.json()['token']}
    placed=client.post('/api/client/orders',headers=auth,json={'product_id':product_id,'request_key':'test-sandbox-bank-transfer-12345'})
    assert placed.status_code==200,placed.text
    order_id=placed.json()['id']
    assert placed.json()['status']=='PENDING'
    assert placed.json()['bank_reference']==f'FP-ORDER-{order_id:06d}'
    assert client.get('/api/client/summary',headers=auth).json()['balance']==0
    other=client.post('/api/auth/login',json={'email':'employee@flexpass.demo','password':'Demo123!','portal':'client'})
    assert other.status_code==200
    other_auth={'Authorization':'Bearer '+other.json()['token']}
    assert client.post(f'/api/client/orders/{order_id}/demo-bank-transfer',headers=other_auth,json={}).status_code==403
    paid=client.post(f'/api/client/orders/{order_id}/demo-bank-transfer',headers=auth,json={})
    assert paid.status_code==200,paid.text
    assert paid.json()['status']=='DEMO_PAID'
    assert paid.json()['payment_reference']==f'DEMO-BANK-{order_id:06d}'
    assert paid.json()['simulated'] is True
    replay=client.post(f'/api/client/orders/{order_id}/demo-bank-transfer',headers=auth,json={})
    assert replay.status_code==200
    assert client.get('/api/client/summary',headers=auth).json()['balance']==7
    admin=admin_header()
    assert client.post(f'/api/admin/client-orders/{order_id}/confirm',headers=admin,json={'payment_reference':'REAL-TEST-123'}).status_code==409
    with Session() as db:
        allocations=db.scalars(select(Ledger).where(Ledger.user_id==user_id,Ledger.source=='DEMO_BANK')).all()
        assert len(allocations)==1
        assert allocations[0].amount==7

def test_demo_bank_endpoint_is_disabled_in_production():
    import subprocess, sys, os, tempfile
    from pathlib import Path
    root=Path(__file__).resolve().parents[1]
    env=os.environ.copy()
    env.update({'DATABASE_URL':'sqlite:///'+str(Path(tempfile.mkdtemp())/'prod_demo_block.db'),
                'FLEXPASS_ENV':'production','FLEXPASS_DEMO_MODE':'false',
                'FLEXPASS_SECRET':'production-unit-test-secret-longer-than-thirty-two',
                'FLEXPASS_ADMIN_EMAIL':'admin@testing.invalid','FLEXPASS_ADMIN_PASSWORD':'TestingPassword123456!'})
    code="""from fastapi.testclient import TestClient
from backend.app import app
c=TestClient(app)
assert c.get('/api/info').json()['bank_transfer']['demo_enabled'] is False
assert c.post('/api/client/orders/1/demo-bank-transfer',json={}).status_code==401 or c.post('/api/client/orders/1/demo-bank-transfer',json={}).status_code==403
"""
    result=subprocess.run([sys.executable,'-c',code],cwd=root,env=env,capture_output=True,text=True,timeout=20)
    assert result.returncode==0,result.stderr
