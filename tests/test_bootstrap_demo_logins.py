"""Isolated subprocess checks for temporary demonstration account provisioning."""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

def test_bootstrap_creates_accounts_once_without_resetting_or_recrediting():
    root=Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as folder:
        env=os.environ.copy()
        env.update({
            'DATABASE_URL':'sqlite:///'+str(Path(folder)/'demo-bootstrap.sqlite3'),
            'FLEXPASS_ENV':'development',
            'FLEXPASS_DEMO_MODE':'true',
            'FLEXPASS_SEED_SHOWCASE_CATALOG':'true',
            'FLEXPASS_BOOTSTRAP_TEMP_TEST_LOGINS':'false',
            'FLEXPASS_TEMP_CLIENT_PASSWORD':'unit-test-client-password-do-not-use',
            'FLEXPASS_TEMP_BUSINESS_PASSWORD':'unit-test-business-password-do-not-use',
        })
        program=r"""
from backend.app import Session, User, Partner, Ledger, bootstrap_temporary_test_logins, seed_showcase_catalog, match_pass
from sqlalchemy import select
with Session() as s:
    seed_showcase_catalog(s)
    s.commit()
    first=bootstrap_temporary_test_logins(s)
    s.commit()
    assert first['created_client']==1 and first['activated_business']==1
    client=s.scalar(select(User).where(User.email=='demo.client@flexpass.test'))
    business=s.scalar(select(User).where(User.email=='akaci@ccs.al'))
    assert client.role=='client' and client.membership_status=='ACTIVE'
    assert client.company_id is None and client.plan_id is None
    assert business.role=='partner' and business.membership_status=='ACTIVE'
    assert s.get(Partner,business.partner_id).name=='FlexPass Demo Studio [DEMO]'
    assert match_pass('unit-test-client-password-do-not-use',client.password_hash)
    assert match_pass('unit-test-business-password-do-not-use',business.password_hash)
    allocations=s.scalars(select(Ledger).where(Ledger.user_id==client.id,Ledger.source=='DEMO_BOOTSTRAP')).all()
    assert len(allocations)==1 and allocations[0].amount==25
    previous_hashes=(client.password_hash,business.password_hash)
    again=bootstrap_temporary_test_logins(s)
    s.commit()
    assert again['client_existing']==1 and again['business_existing']==1
    assert (client.password_hash,business.password_hash)==previous_hashes
    assert len(s.scalars(select(Ledger).where(Ledger.user_id==client.id,Ledger.source=='DEMO_BOOTSTRAP')).all())==1
"""
        result=subprocess.run([sys.executable,'-c',program],cwd=root,env=env,capture_output=True,text=True,timeout=45)
        assert result.returncode==0,result.stderr

def test_bootstrap_rejects_weak_passwords():
    root=Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as folder:
        env=os.environ.copy()
        env.update({
            'DATABASE_URL':'sqlite:///'+str(Path(folder)/'demo-bootstrap.sqlite3'),
            'FLEXPASS_ENV':'development',
            'FLEXPASS_SEED_SHOWCASE_CATALOG':'true',
            'FLEXPASS_BOOTSTRAP_TEMP_TEST_LOGINS':'false',
            'FLEXPASS_TEMP_CLIENT_PASSWORD':'weak',
            'FLEXPASS_TEMP_BUSINESS_PASSWORD':'weak',
        })
        program=r"""
from backend.app import Session, bootstrap_temporary_test_logins
with Session() as s:
    try:
        bootstrap_temporary_test_logins(s)
    except RuntimeError:
        pass
    else:
        raise AssertionError('Weak bootstrap credentials must be rejected')
"""
        result=subprocess.run([sys.executable,'-c',program],cwd=root,env=env,capture_output=True,text=True,timeout=45)
        assert result.returncode==0,result.stderr
