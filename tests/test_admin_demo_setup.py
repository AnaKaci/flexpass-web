"""Admin-only test account provisioning flow; secrets never logged or persisted in source."""
import os, subprocess, sys, tempfile
from pathlib import Path

def test_admin_setup_is_protected_and_repeat_safe():
    root=Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as tmp:
        env=os.environ.copy()
        env.update({'DATABASE_URL':'sqlite:///'+str(Path(tmp)/'db.sqlite'),
                    'FLEXPASS_ENV':'development','FLEXPASS_DEMO_MODE':'true',
                    'FLEXPASS_SEED_SHOWCASE_CATALOG':'true',
                    'FLEXPASS_BOOTSTRAP_TEMP_TEST_LOGINS':'false'})
        code=r"""
from fastapi.testclient import TestClient
from sqlalchemy import select
from backend.app import app, Session, User, Ledger, match_pass
c=TestClient(app)
path='/api/admin/demo/accounts/setup'
payload={'client_password':'client-unit-test-password-long-123','business_password':'business-unit-test-password-long-321'}
assert c.post(path,json=payload).status_code==401
r=c.post('/api/auth/admin/login',json={'email':'admin@flexpass.demo','password':'Demo123!','portal':'admin'})
assert r.status_code==200,r.text
h={'Authorization':'Bearer '+r.json()['token']}
bad=c.post(path,headers=h,json={'client_password':'short','business_password':'also-short'})
assert bad.status_code==422
result=c.post(path,headers=h,json=payload)
assert result.status_code==200,result.text
assert result.json()['created_client']==1 and result.json()['activated_business']==1
assert 'client_password' not in result.text and 'business_password' not in result.text
with Session() as s:
    cl=s.scalar(select(User).where(User.email=='demo.client@flexpass.test'))
    pa=s.scalar(select(User).where(User.email=='akaci@ccs.al'))
    assert cl.membership_status=='ACTIVE' and cl.role=='client'
    assert pa.membership_status=='ACTIVE' and pa.role=='partner'
    assert match_pass(payload['client_password'],cl.password_hash)
    assert match_pass(payload['business_password'],pa.password_hash)
    assert len(s.scalars(select(Ledger).where(Ledger.user_id==cl.id,Ledger.source=='DEMO_BOOTSTRAP')).all())==1
again=c.post(path,headers=h,json=payload)
assert again.status_code==200
assert again.json()['client_existing']==1 and again.json()['business_existing']==1
"""
        r=subprocess.run([sys.executable,'-c',code],cwd=root,env=env,capture_output=True,text=True,timeout=50)
        assert r.returncode==0,r.stderr
