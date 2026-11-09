"""One-time test account bootstrap: no known passwords in code, no real payments."""
from sqlalchemy import select
from backend.app import Session, User, Partner, Ledger, bootstrap_temporary_test_logins, seed_showcase_catalog, match_pass

def test_bootstrap_activates_client_and_demo_business_without_reset(monkeypatch):
    monkeypatch.setenv('FLEXPASS_SEED_SHOWCASE_CATALOG','true')
    monkeypatch.setenv('FLEXPASS_TEMP_CLIENT_PASSWORD','unit-test-client-password-do-not-use')
    monkeypatch.setenv('FLEXPASS_TEMP_BUSINESS_PASSWORD','unit-test-business-password-do-not-use')
    with Session() as s:
        seed_showcase_catalog(s)
        s.commit()
        first=bootstrap_temporary_test_logins(s)
        s.commit()
        assert first['created_client']==1
        assert first['activated_business']==1
        client=s.scalar(select(User).where(User.email=='demo.client@flexpass.test'))
        business=s.scalar(select(User).where(User.email=='akaci@ccs.al'))
        assert client.role=='client' and client.membership_status=='ACTIVE'
        assert client.company_id is None and client.plan_id is None
        assert business.role=='partner' and business.membership_status=='ACTIVE'
        assert s.get(Partner,business.partner_id).name=='FlexPass Demo Studio [DEMO]'
        assert match_pass('unit-test-client-password-do-not-use',client.password_hash)
        assert match_pass('unit-test-business-password-do-not-use',business.password_hash)
        balances=s.scalars(select(Ledger).where(Ledger.user_id==client.id,Ledger.source=='DEMO_BOOTSTRAP')).all()
        assert len(balances)==1 and balances[0].amount==25
        client_hash,business_hash=client.password_hash,business.password_hash
        again=bootstrap_temporary_test_logins(s)
        s.commit()
        assert again['client_existing']==1 and again['business_existing']==1
        assert client.password_hash==client_hash and business.password_hash==business_hash
        assert len(s.scalars(select(Ledger).where(Ledger.user_id==client.id,Ledger.source=='DEMO_BOOTSTRAP')).all())==1

def test_bootstrap_requires_distinct_strong_passwords(monkeypatch):
    monkeypatch.setenv('FLEXPASS_SEED_SHOWCASE_CATALOG','true')
    monkeypatch.setenv('FLEXPASS_TEMP_CLIENT_PASSWORD','weak')
    monkeypatch.setenv('FLEXPASS_TEMP_BUSINESS_PASSWORD','weak')
    with Session() as s:
        import pytest
        with pytest.raises(RuntimeError):
            bootstrap_temporary_test_logins(s)
