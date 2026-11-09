"""Repeatable, clearly labeled fake catalogue fixtures for the FlexPass demonstration."""
from sqlalchemy import select, func
from backend.app import (
    Session, Partner, Service, Slot, CreditProduct, User,
    SHOWCASE_BUSINESSES, SHOWCASE_PRODUCTS, seed_showcase_catalog
)

def test_showcase_seed_is_idempotent_and_invites_demo_business():
    with Session() as s:
        first=seed_showcase_catalog(s)
        s.commit()
        assert first['partners']==len(SHOWCASE_BUSINESSES)
        assert first['services']==sum(len(b[2]) for b in SHOWCASE_BUSINESSES)
        assert first['slots']==first['services']*5
        assert first['credit_products']==len(SHOWCASE_PRODUCTS)
        assert first['invited_accounts']==1

        account=s.scalar(select(User).where(User.email=='akaci@ccs.al'))
        assert account and account.role=='partner' and account.membership_status=='INVITED'
        assert s.get(Partner,account.partner_id).name=='FlexPass Demo Studio [DEMO]'
        partner_id=account.partner_id
        before=s.scalar(select(func.count(Service.id)).where(Service.partner_id==partner_id))

        second=seed_showcase_catalog(s)
        s.commit()
        assert all(x==0 for x in second.values())
        assert s.scalar(select(func.count(Service.id)).where(Service.partner_id==partner_id))==before
        assert all(item.name.endswith('[DEMO]') for item in s.scalars(select(CreditProduct).where(CreditProduct.name.like('%[DEMO]'))).all())  # fictional packaging

def test_demo_catalog_is_bookable_by_client_but_partner_is_isolated():
    from fastapi.testclient import TestClient
    from backend.app import app
    client=TestClient(app)
    r=client.post('/api/auth/login',json={'email':'employee@flexpass.demo','password':'Demo123!','portal':'client'})
    assert r.status_code==200
    auth={'Authorization':'Bearer '+r.json()['token']}
    catalog=client.get('/api/catalog',headers=auth)
    assert catalog.status_code==200
    fictional=[x for x in catalog.json() if x['name'].endswith('[DEMO]')]
    assert len(fictional)==sum(len(b[2]) for b in SHOWCASE_BUSINESSES)
    assert all(x['slots'] and x['slots'][0]['available']>0 for x in fictional)
    demo_partner=next(x for x in fictional if x['partner']=='FlexPass Demo Studio [DEMO]')
    assert len([x for x in fictional if x['partner_id']==demo_partner['partner_id']])==3
    with Session() as s:
        business=s.scalar(select(User).where(User.email=='akaci@ccs.al'))
        assert business.membership_status=='INVITED'
    assert client.post('/api/auth/login',json={'email':'akaci@ccs.al','password':'anything','portal':'partner'}).status_code==401
