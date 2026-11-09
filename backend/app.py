"""FlexPass functional pilot API. Development auth and seed data; not production-ready."""
import csv
import hashlib
import hmac
import io
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import (Boolean, Column, DateTime, ForeignKey, Integer, MetaData,
                        String, Text, UniqueConstraint, create_engine, event, select, func)
from sqlalchemy.orm import declarative_base, sessionmaker

ROOT = Path(__file__).resolve().parent.parent
DB_URL = os.environ.get('DATABASE_URL', f'sqlite:///{ROOT / "flexpass.db"}')
# Render supplies postgresql://; use the installed psycopg 3 driver explicitly.
if DB_URL.startswith('postgres://'):
    DB_URL = 'postgresql+psycopg://' + DB_URL[len('postgres://'):]
elif DB_URL.startswith('postgresql://'):
    DB_URL = 'postgresql+psycopg://' + DB_URL[len('postgresql://'):]
ENVIRONMENT = os.environ.get('FLEXPASS_ENV', 'development').lower()
DEMO_MODE = os.environ.get('FLEXPASS_DEMO_MODE', 'false' if ENVIRONMENT == 'production' else 'true').lower() in ('true', '1', 'yes')
CANCELLATION_CUTOFF_HOURS = max(0, int(os.environ.get('FLEXPASS_CANCELLATION_CUTOFF_HOURS', '0')))
SECRET = os.environ.get('FLEXPASS_SECRET', 'change-me-demo-only-local-secret')
if ENVIRONMENT == 'production':
    if len(SECRET) < 32 or SECRET == 'change-me-demo-only-local-secret':
        raise RuntimeError('FLEXPASS_SECRET must be a secure random value of at least 32 characters in production.')
    if DEMO_MODE:
        for role in ('ADMIN', 'PARTNER', 'EMPLOYEE'):
            pwd = os.environ.get(f'FLEXPASS_DEMO_{role}_PASSWORD', '')
            if len(pwd) < 12 or pwd == 'Demo123!':
                raise RuntimeError(f'Set a unique strong FLEXPASS_DEMO_{role}_PASSWORD for publicly hosted demo mode.')
    elif len(os.environ.get('FLEXPASS_ADMIN_PASSWORD', '')) < 12 or not os.environ.get('FLEXPASS_ADMIN_EMAIL'):
        raise RuntimeError('FLEXPASS_ADMIN_EMAIL and a secure FLEXPASS_ADMIN_PASSWORD (12+ characters) are required for initial production setup.')
engine = create_engine(DB_URL, connect_args={'check_same_thread': False, 'timeout': 30} if DB_URL.startswith('sqlite') else {}, future=True)
if DB_URL.startswith('sqlite'):
    @event.listens_for(engine, 'connect')
    def pragma_on_connect(dbapi_conn, _):
        c = dbapi_conn.cursor(); c.execute('PRAGMA foreign_keys = ON'); c.execute('PRAGMA busy_timeout = 30000'); c.close()
Session = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base(metadata=MetaData())

def now(): return datetime.now(timezone.utc).replace(tzinfo=None)
def iso(v): return v.isoformat() + 'Z' if isinstance(v, datetime) else None

class Company(Base):
    __tablename__ = 'companies'
    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False, unique=True)
    hr_email = Column(String(200), default='')
    status = Column(String(25), default='ACTIVE')

class Plan(Base):
    __tablename__ = 'plans'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    credits = Column(Integer, nullable=False)
    monthly_price = Column(Integer, default=0) # cents, illustrative; not a live offer
    currency = Column(String(10), default='ALL')

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    email = Column(String(200), nullable=False, unique=True)
    full_name = Column(String(160), nullable=False)
    password_hash = Column(String(180), nullable=False)
    role = Column(String(20), nullable=False)
    company_id = Column(Integer, ForeignKey('companies.id'))
    partner_id = Column(Integer, ForeignKey('partners.id'))
    plan_id = Column(Integer, ForeignKey('plans.id'))
    membership_status = Column(String(25), default='ACTIVE')
    created_at = Column(DateTime, default=now)

class Partner(Base):
    __tablename__ = 'partners'
    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    zone = Column(String(100), default='Blloku')
    status = Column(String(20), default='ACTIVE')

class Service(Base):
    __tablename__ = 'services'
    id = Column(Integer, primary_key=True)
    partner_id = Column(Integer, ForeignKey('partners.id'), nullable=False)
    name = Column(String(160), nullable=False)
    group_name = Column(String(50), nullable=False)
    subcategory = Column(String(70), nullable=False)
    description = Column(Text, default='')
    credits = Column(Integer, nullable=False)
    payout_cents = Column(Integer, default=0)
    duration_minutes = Column(Integer, default=60)
    active = Column(Boolean, default=True)

class Slot(Base):
    __tablename__ = 'slots'
    id = Column(Integer, primary_key=True)
    service_id = Column(Integer, ForeignKey('services.id'), nullable=False)
    start_at = Column(DateTime, nullable=False)
    capacity = Column(Integer, nullable=False)
    reserved = Column(Integer, default=0, nullable=False)

class Booking(Base):
    __tablename__ = 'bookings'
    id = Column(Integer, primary_key=True)
    reference = Column(String(35), nullable=False, unique=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    slot_id = Column(Integer, ForeignKey('slots.id'), nullable=False)
    service_id = Column(Integer, ForeignKey('services.id'), nullable=False)
    partner_id = Column(Integer, ForeignKey('partners.id'), nullable=False)
    status = Column(String(30), nullable=False, default='BOOKED')
    credits_snapshot = Column(Integer, nullable=False)
    payout_snapshot_cents = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=now)
    checked_in_at = Column(DateTime)
    checked_in_by = Column(Integer, ForeignKey('users.id'))
    cancelled_at = Column(DateTime)
    __table_args__ = (UniqueConstraint('user_id','slot_id',name='uq_user_slot'),)

class BookingRequest(Base):
    __tablename__ = 'booking_requests'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    idempotency_key = Column(String(128), nullable=False)
    slot_id = Column(Integer, ForeignKey('slots.id'), nullable=False)
    booking_id = Column(Integer, ForeignKey('bookings.id'), nullable=False)
    __table_args__ = (UniqueConstraint('user_id', 'idempotency_key', name='uq_booking_request_key'),)

class Ledger(Base):
    __tablename__ = 'credit_ledger'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    booking_id = Column(Integer, ForeignKey('bookings.id'))
    kind = Column(String(30), nullable=False) # ALLOCATION, DEBIT, REFUND, ADJUSTMENT, EXPIRY
    amount = Column(Integer, nullable=False)  # signed integers
    source = Column(String(30), default='COMPANY')
    period = Column(String(7), nullable=False)
    actor_id = Column(Integer, ForeignKey('users.id'))
    reason = Column(Text, default='')
    created_at = Column(DateTime, default=now)

class Invoice(Base):
    __tablename__ = 'invoices'
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    period = Column(String(7), nullable=False)
    reference = Column(String(80), nullable=False, unique=True)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(10), default='ALL')
    status = Column(String(25), default='DRAFT')
    due_date = Column(String(20), default='')
    payment_reference = Column(String(100), default='')
    paid_at = Column(DateTime)
    notes = Column(Text, default='')

class Settlement(Base):
    __tablename__ = 'settlements'
    id = Column(Integer, primary_key=True)
    partner_id = Column(Integer, ForeignKey('partners.id'), nullable=False)
    period = Column(String(7), nullable=False)
    status = Column(String(25), default='DRAFT')
    invoice_reference = Column(String(80), default='')
    payment_reference = Column(String(80), default='')
    __table_args__ = (UniqueConstraint('partner_id','period',name='uq_settlement_partner_period'),)

class SettlementLine(Base):
    __tablename__ = 'settlement_lines'
    id = Column(Integer, primary_key=True)
    settlement_id = Column(Integer, ForeignKey('settlements.id'), nullable=False)
    booking_id = Column(Integer, ForeignKey('bookings.id'), unique=True, nullable=False)
    amount_cents = Column(Integer, nullable=False)

class Audit(Base):
    __tablename__ = 'audit_log'
    id = Column(Integer, primary_key=True)
    actor_id = Column(Integer)
    action = Column(String(70), nullable=False)
    detail = Column(Text, default='')
    created_at = Column(DateTime, default=now)

class LoginBody(BaseModel):
    email: str
    password: str
    portal: Optional[str] = None
class BookBody(BaseModel):
    slot_id: int
class CompanyBody(BaseModel):
    name: str = Field(min_length=2)
    hr_email: str = ''
class EmployeeBody(BaseModel):
    full_name: str
    email: str
    company_id: int
    plan_id: int
    initial_credits: Optional[int] = None
class InvoiceBody(BaseModel):
    company_id: int
    period: str
    reference: str
    amount_cents: int = Field(ge=0)
    due_date: str = ''
class InvoiceStatus(BaseModel):
    status: str
    payment_reference: str = ''
class SettlementUpdate(BaseModel):
    status: str
    invoice_reference: str = ''
    payment_reference: str = ''
class ServiceBody(BaseModel):
    name: str
    group_name: str
    subcategory: str
    description: str = ''
    credits: int = Field(ge=1)
    payout_cents: int = Field(ge=0)
    duration_minutes: int = Field(default=60, ge=1)
class SlotBody(BaseModel):
    service_id: int
    start_at: datetime
    capacity: int = Field(ge=1)
class AdjustBody(BaseModel):
    user_id: int
    amount: int
    reason: str = Field(min_length=3)

app = FastAPI(title='FlexPass MVP API', version='0.2.0')


def hash_pass(raw):
    salt = secrets.token_hex(12)
    digest = hashlib.pbkdf2_hmac('sha256', raw.encode(), bytes.fromhex(salt), 180000).hex()
    return salt + '$' + digest

def match_pass(raw, h):
    try:
        salt,digest = h.split('$')
        x = hashlib.pbkdf2_hmac('sha256',raw.encode(), bytes.fromhex(salt),180000).hex()
        return hmac.compare_digest(x,digest)
    except Exception: return False

def token_for(u):
    payload = {'sub':str(u.id),'role':u.role,'exp':datetime.now(timezone.utc)+timedelta(hours=12)}
    return jwt.encode(payload, SECRET, algorithm='HS256')

def get_user(req:Request):
    header=req.headers.get('authorization','')
    if not header.startswith('Bearer '): raise HTTPException(401,'Sign in to continue')
    try: uid=int(jwt.decode(header[7:],SECRET,algorithms=['HS256'])['sub'])
    except Exception: raise HTTPException(401,'Session expired')
    with Session() as s:
        u=s.get(User,uid)
        if not u or u.membership_status != 'ACTIVE' or u.role not in ('admin','partner','employee'): raise HTTPException(403,'Account inactive')
        s.expunge(u);return u

def roles(*allowed):
    def dep(u=Depends(get_user)):
        if u.role not in allowed: raise HTTPException(403,'Insufficient permissions')
        return u
    return dep

def balance(s,uid):
    return int(s.scalar(select(func.coalesce(func.sum(Ledger.amount),0)).where(Ledger.user_id==uid)) or 0)

def audit(s,actor,action,detail): s.add(Audit(actor_id=actor, action=action, detail=detail))

def lock_transaction(s):
    # SQLite serialize writers before reading capacity/balance; PostgreSQL: row locks below.
    if DB_URL.startswith('sqlite'):
        s.connection().exec_driver_sql('BEGIN IMMEDIATE')

def user_view(u):
    return {'id':u.id,'full_name':u.full_name,'email':u.email,'role':u.role,'company_id':u.company_id,'partner_id':u.partner_id,'plan_id':u.plan_id,'status':u.membership_status}

GROUPS = ['fitness','sport','wellness','glow','kids-family']
ZONES = ['Blloku','Komuna e Parisit','Arena','Liqeni i Thate','Myslym Shyri','Pazari i Ri','21 Dhjetori','ABA Center','Farka','Air Albania']
SUBCATS = {'fitness':['Gyms','Pilates','Yoga','Zumba','CrossFit','Aerobics'], 'sport':['Swimming','Tennis','Football','Martial Arts','Dance'], 'wellness':['Spa','Massage','Sauna','Recovery'], 'glow':['Facials','Hair','Beauty'], 'kids-family':['Kids Sports','Family Activities','Creative Play']}

@app.get('/api/health')
def health():
    with Session() as s:
        s.execute(select(1))
    return {'status': 'ok'}

@app.get('/api/info')
def info():
    return {'app':'FlexPass','preview':True,'seeded':DEMO_MODE,'demo_mode':DEMO_MODE,'groups':GROUPS,'zones':ZONES,'subcategories':SUBCATS,'tagline':'Private-launch access pass for premium daily services, real booking, and hard-to-reach routines.'}

def authenticate_portal(body:LoginBody, allowed_roles):
    # The selected portal is verified on the server. The admin portal is isolated
    # from employee/partner login even when credentials are otherwise valid.
    with Session() as s:
        u=s.scalar(select(User).where(User.email==body.email.strip().lower()))
        if (not u or not match_pass(body.password,u.password_hash)
            or u.membership_status!='ACTIVE' or u.role not in allowed_roles
            or (body.portal and body.portal != u.role)):
            raise HTTPException(401,'Invalid credentials for this portal')
        return {'token':token_for(u),'user':user_view(u)}

@app.post('/api/auth/login')
def login(body:LoginBody):
    return authenticate_portal(body, ('employee','partner'))

@app.post('/api/auth/admin/login')
def admin_login(body:LoginBody):
    return authenticate_portal(body, ('admin',))

@app.get('/api/auth/me')
def me(u=Depends(get_user)):return user_view(u)

@app.get('/api/catalog')
def catalog(group:Optional[str]=None,subcategory:Optional[str]=None,search:str='',zone:str='',maxCredits:Optional[int]=None,u=Depends(get_user)):
    with Session() as s:
        q=select(Service,Partner).join(Partner,Service.partner_id==Partner.id).where(Service.active==True,Partner.status=='ACTIVE')
        if group and group in GROUPS:q=q.where(Service.group_name==group)
        if subcategory:q=q.where(Service.subcategory==subcategory)
        if zone:q=q.where(Partner.zone==zone)
        if maxCredits:q=q.where(Service.credits<=maxCredits)
        if search:
            key=f'%{search.lower()}%'
            q=q.where((func.lower(Service.name).like(key)) | (func.lower(Partner.name).like(key)) | (func.lower(Service.description).like(key)))
        rows=s.execute(q.order_by(Service.id)).all()
        out=[]
        for service,partner in rows:
            slots=s.scalars(select(Slot).where(Slot.service_id==service.id,Slot.start_at>now()).order_by(Slot.start_at).limit(20)).all()
            out.append({'id':service.id,'name':service.name,'group':service.group_name,'subcategory':service.subcategory,'description':service.description,'credits':service.credits,'duration_minutes':service.duration_minutes,'partner':partner.name,'partner_id':partner.id,'zone':partner.zone,'slots':[{'id':x.id,'start_at':iso(x.start_at),'capacity':x.capacity,'available':max(0,x.capacity-x.reserved)} for x in slots]})
        return out

@app.get('/api/employee/summary')
def employee_summary(u=Depends(roles('employee'))):
    with Session() as s:
        c=s.get(Company,u.company_id);p=s.get(Plan,u.plan_id)
        rows=s.scalars(select(Booking).where(Booking.user_id==u.id)).all()
        return {'user':user_view(u),'company':c.name if c else '', 'plan':p.name if p else '', 'monthly_credits':p.credits if p else 0,'balance':balance(s,u.id), 'active_bookings':sum(x.status=='BOOKED' for x in rows), 'visits':sum(x.status=='CHECKED_IN' for x in rows)}

def booking_view(s,b):
    sv=s.get(Service,b.service_id);p=s.get(Partner,b.partner_id);sl=s.get(Slot,b.slot_id);u=s.get(User,b.user_id)
    return {'id':b.id,'reference':b.reference,'service':sv.name,'partner':p.name,'partner_id':b.partner_id,'user':u.full_name,'email':u.email,'start_at':iso(sl.start_at),'credits':b.credits_snapshot,'payout_cents':b.payout_snapshot_cents,'status':b.status,'created_at':iso(b.created_at),'checked_in_at':iso(b.checked_in_at),'zone':p.zone}

@app.get('/api/employee/bookings')
def employee_bookings(u=Depends(roles('employee'))):
    with Session() as s:return [booking_view(s,b) for b in s.scalars(select(Booking).where(Booking.user_id==u.id).order_by(Booking.id.desc())).all()]

@app.get('/api/employee/ledger')
def employee_ledger(u=Depends(roles('employee'))):
    with Session() as s:
        return [{'id':x.id,'kind':x.kind,'amount':x.amount,'period':x.period,'created_at':iso(x.created_at),'reason':x.reason,'booking_id':x.booking_id} for x in s.scalars(select(Ledger).where(Ledger.user_id==u.id).order_by(Ledger.id.desc())).all()]

@app.post('/api/bookings')
def make_booking(body:BookBody,req:Request,u=Depends(roles('employee'))):
    key = req.headers.get('Idempotency-Key', '').strip()
    if len(key) > 128: raise HTTPException(400, 'Idempotency key is too long')
    with Session() as s:
        try:
            lock_transaction(s)
            # Lock membership first so two simultaneous bookings for different
            # slots cannot both spend the same last credits on PostgreSQL.
            member=s.scalar(select(User).where(User.id==u.id).with_for_update())
            if not member or member.membership_status!='ACTIVE':raise HTTPException(403,'Membership inactive')
            if key:
                previous=s.scalar(select(BookingRequest).where(BookingRequest.user_id==u.id,BookingRequest.idempotency_key==key))
                if previous:
                    if previous.slot_id != body.slot_id: raise HTTPException(409,'Idempotency key already used for another slot')
                    return booking_view(s,s.get(Booking,previous.booking_id))
            sl=s.scalar(select(Slot).where(Slot.id==body.slot_id).with_for_update())
            if not sl: raise HTTPException(404,'Slot not found')
            service=s.get(Service,sl.service_id)
            if not service or not service.active:raise HTTPException(400,'Service unavailable')
            if sl.start_at <= now():raise HTTPException(409,'Slot already started')
            if sl.reserved>=sl.capacity:raise HTTPException(409,'No remaining places')
            if balance(s,u.id)<service.credits: raise HTTPException(409,'Insufficient credits')
            if s.scalar(select(Booking).where(Booking.user_id==u.id,Booking.slot_id==sl.id)):raise HTTPException(409,'Already booked this slot')
            sl.reserved+=1
            b=Booking(reference='FP-'+secrets.token_hex(4).upper(),user_id=u.id,slot_id=sl.id,service_id=service.id,partner_id=service.partner_id,credits_snapshot=service.credits,payout_snapshot_cents=service.payout_cents,status='BOOKED')
            s.add(b);s.flush()
            if key: s.add(BookingRequest(user_id=u.id,idempotency_key=key,slot_id=sl.id,booking_id=b.id))
            s.add(Ledger(user_id=u.id,booking_id=b.id,kind='DEBIT',amount=-service.credits,period=now().strftime('%Y-%m'),actor_id=u.id,reason=f'Booking {b.reference}'))
            audit(s,u.id,'BOOKING_CREATED',b.reference)
            s.commit(); return booking_view(s,b)
        except HTTPException:
            s.rollback();raise
        except Exception:
            s.rollback();raise

@app.post('/api/bookings/{booking_id}/cancel')
def cancel_booking(booking_id:int,u=Depends(roles('employee'))):
    with Session() as s:
        try:
            lock_transaction(s)
            b=s.scalar(select(Booking).where(Booking.id==booking_id).with_for_update())
            if not b:raise HTTPException(404,'Booking not found')
            if b.user_id!=u.id:raise HTTPException(403,'Not your booking')
            if b.status!='BOOKED':raise HTTPException(409,'Only active bookings may be cancelled')
            sl=s.scalar(select(Slot).where(Slot.id==b.slot_id).with_for_update())
            if sl.start_at<=now()+timedelta(hours=CANCELLATION_CUTOFF_HOURS):raise HTTPException(409,'Cancellation window closed for this pilot')
            b.status='CANCELLED';b.cancelled_at=now();sl.reserved-=1
            s.add(Ledger(user_id=b.user_id,booking_id=b.id,kind='REFUND',amount=b.credits_snapshot,period=now().strftime('%Y-%m'),actor_id=u.id,reason=f'Cancellation {b.reference}'))
            audit(s,u.id,'BOOKING_CANCELLED',b.reference)
            s.commit();return {'status':'CANCELLED','refunded':b.credits_snapshot}
        except HTTPException:s.rollback();raise
        except Exception:s.rollback();raise

@app.get('/api/partner/summary')
def partner_summary(u=Depends(roles('partner'))):
    with Session() as s:
        p=s.get(Partner,u.partner_id); rows=s.scalars(select(Booking).where(Booking.partner_id==u.partner_id)).all()
        return {'partner':p.name,'zone':p.zone,'services':s.scalar(select(func.count(Service.id)).where(Service.partner_id==u.partner_id)),'bookings':len(rows),'checkins':sum(x.status=='CHECKED_IN' for x in rows),'pending':sum(x.status=='BOOKED' for x in rows),'earnings_cents':sum(x.payout_snapshot_cents for x in rows if x.status=='CHECKED_IN')}

@app.get('/api/partner/bookings')
def partner_bookings(u=Depends(roles('partner'))):
    with Session() as s:return [booking_view(s,b) for b in s.scalars(select(Booking).where(Booking.partner_id==u.partner_id).order_by(Booking.id.desc())).all()]

@app.post('/api/partner/bookings/{booking_id}/checkin')
def checkin(booking_id:int,u=Depends(roles('partner','admin'))):
    with Session() as s:
        try:
            lock_transaction(s)
            b=s.scalar(select(Booking).where(Booking.id==booking_id).with_for_update())
            if not b:raise HTTPException(404,'Booking not found')
            if u.role=='partner' and b.partner_id!=u.partner_id:raise HTTPException(403,'Not your partner booking')
            if b.status!='BOOKED':raise HTTPException(409,'Check-in already recorded or booking cancelled')
            b.status='CHECKED_IN';b.checked_in_at=now();b.checked_in_by=u.id
            audit(s,u.id,'CHECK_IN',b.reference);s.commit()
            return {'status':'CHECKED_IN','reference':b.reference}
        except HTTPException:s.rollback();raise
        except Exception:s.rollback();raise

@app.get('/api/partner/services')
def partner_services(u=Depends(roles('partner'))):
    with Session() as s:
        return [{'id':sv.id,'name':sv.name,'group':sv.group_name,'subcategory':sv.subcategory,'credits':sv.credits,'payout_cents':sv.payout_cents,'active':sv.active,'slots':[{'id':sl.id,'start_at':iso(sl.start_at),'capacity':sl.capacity,'reserved':sl.reserved} for sl in s.scalars(select(Slot).where(Slot.service_id==sv.id).order_by(Slot.start_at)).all()]} for sv in s.scalars(select(Service).where(Service.partner_id==u.partner_id)).all()]

@app.post('/api/partner/services')
def create_service(body:ServiceBody,u=Depends(roles('partner'))):
    if body.group_name not in GROUPS:raise HTTPException(400,'Invalid category')
    with Session() as s:
        sv=Service(partner_id=u.partner_id,**body.model_dump());s.add(sv);s.flush();audit(s,u.id,'SERVICE_CREATED',str(sv.id));s.commit();return {'id':sv.id}

@app.post('/api/partner/slots')
def create_slot(body:SlotBody,u=Depends(roles('partner'))):
    with Session() as s:
        sv=s.get(Service,body.service_id)
        if not sv or sv.partner_id!=u.partner_id:raise HTTPException(403,'Not your service')
        if body.start_at.replace(tzinfo=None)<=now():raise HTTPException(400,'Slot must be in future')
        sl=Slot(service_id=body.service_id,start_at=body.start_at.replace(tzinfo=None),capacity=body.capacity,reserved=0)
        s.add(sl);s.flush();audit(s,u.id,'SLOT_CREATED',str(sl.id));s.commit();return {'id':sl.id}


@app.get('/api/partner/payouts/export')
def partner_payout_export(start:Optional[str]=None,end:Optional[str]=None,u=Depends(roles('partner'))):
    def parse_date(value):
        if not value: return None
        try: return datetime.strptime(value,'%Y-%m-%d').date()
        except ValueError: raise HTTPException(400,'Dates must use YYYY-MM-DD')
    from_date,to_date=parse_date(start),parse_date(end)
    if from_date and to_date and from_date>to_date: raise HTTPException(400,'Start must not exceed end')
    with Session() as s:
        bookings=s.scalars(select(Booking).where(Booking.partner_id==u.partner_id,Booking.status=='CHECKED_IN').order_by(Booking.id)).all()
        out=io.StringIO()
        writer=csv.writer(out)
        writer.writerow(['Booking reference','Service','Completed at (UTC)','Credits','Partner payout (ALL)','Status'])
        for b in bookings:
            completed=b.checked_in_at.date() if b.checked_in_at else None
            if (from_date and (not completed or completed<from_date)) or (to_date and (not completed or completed>to_date)):continue
            sv=s.get(Service,b.service_id)
            writer.writerow([b.reference,sv.name if sv else '',iso(b.checked_in_at),b.credits_snapshot,
                             f'{b.payout_snapshot_cents/100:.2f}',b.status])
        return Response(content=out.getvalue(),media_type='text/csv; charset=utf-8',
                        headers={'Content-Disposition':'attachment; filename="flexpass-partner-payouts.csv"',
                                 'Cache-Control':'no-store'})

@app.get('/api/admin/summary')
def admin_summary(u=Depends(roles('admin'))):
    with Session() as s:
        count=lambda model:s.scalar(select(func.count(model.id)))
        bookings=s.scalars(select(Booking)).all()
        return {'companies':count(Company),'employees':s.scalar(select(func.count(User.id)).where(User.role=='employee')),'partners':count(Partner),'services':count(Service),'bookings':len(bookings),'visits':sum(x.status=='CHECKED_IN' for x in bookings),'credits_issued':s.scalar(select(func.coalesce(func.sum(Ledger.amount),0)).where(Ledger.kind=='ALLOCATION')),'partner_payables_cents':sum(x.payout_snapshot_cents for x in bookings if x.status=='CHECKED_IN')}

@app.get('/api/admin/companies')
def companies(u=Depends(roles('admin'))):
    with Session() as s:return [{'id':c.id,'name':c.name,'hr_email':c.hr_email,'status':c.status,'employees':s.scalar(select(func.count(User.id)).where(User.company_id==c.id,User.role=='employee'))} for c in s.scalars(select(Company).order_by(Company.name)).all()]

@app.post('/api/admin/companies')
def create_company(body:CompanyBody,u=Depends(roles('admin'))):
    with Session() as s:
        if s.scalar(select(Company).where(Company.name==body.name)):raise HTTPException(409,'Company already exists')
        c=Company(**body.model_dump());s.add(c);s.flush();audit(s,u.id,'COMPANY_CREATED',str(c.id));s.commit();return {'id':c.id}

@app.get('/api/admin/plans')
def plans(u=Depends(roles('admin'))):
    with Session() as s:return [{'id':p.id,'name':p.name,'credits':p.credits,'monthly_price':p.monthly_price,'currency':p.currency} for p in s.scalars(select(Plan).order_by(Plan.id)).all()]

@app.get('/api/admin/employees')
def employees(u=Depends(roles('admin'))):
    with Session() as s:
        return [{'id':e.id,'full_name':e.full_name,'email':e.email,'company':s.get(Company,e.company_id).name if e.company_id else '', 'company_id':e.company_id,'plan':s.get(Plan,e.plan_id).name if e.plan_id else '','status':e.membership_status,'balance':balance(s,e.id)} for e in s.scalars(select(User).where(User.role=='employee').order_by(User.id)).all()]

@app.post('/api/admin/employees')
def create_employee(body:EmployeeBody,u=Depends(roles('admin'))):
    with Session() as s:
        if s.scalar(select(User).where(User.email==body.email.lower())):raise HTTPException(409,'Email already registered')
        p=s.get(Plan,body.plan_id)
        if not p or not s.get(Company,body.company_id):raise HTTPException(400,'Unknown company or plan')
        e=User(email=body.email.lower(),full_name=body.full_name,role='employee',password_hash=hash_pass('InviteOnly!234'),company_id=body.company_id,plan_id=body.plan_id,membership_status='INVITED')
        s.add(e);s.flush()
        amount=body.initial_credits if body.initial_credits is not None else p.credits
        # Funding can be administered only once the invitation is accepted in production.
        # MVP pilot accounts are invited and do not yet have login access.
        if amount: s.add(Ledger(user_id=e.id,kind='ALLOCATION',amount=amount,period=now().strftime('%Y-%m'),actor_id=u.id,reason='Pilot initial allocation'))
        audit(s,u.id,'EMPLOYEE_INVITED',e.email);s.commit();return {'id':e.id,'status':'INVITED','note':'Invitation delivery/activation requires Supabase Auth integration.'}

@app.post('/api/admin/adjust-credits')
def adjust(body:AdjustBody,u=Depends(roles('admin'))):
    with Session() as s:
        try:
            lock_transaction(s)
            target=s.scalar(select(User).where(User.id==body.user_id,User.role=='employee').with_for_update())
            if not target:raise HTTPException(404,'Employee not found')
            if balance(s,target.id)+body.amount<0:raise HTTPException(409,'Balance cannot be negative')
            s.add(Ledger(user_id=target.id,kind='ADJUSTMENT',amount=body.amount,period=now().strftime('%Y-%m'),actor_id=u.id,reason=body.reason))
            audit(s,u.id,'WALLET_ADJUSTED',f'User {target.id}: {body.amount}; {body.reason}')
            s.commit();return {'balance':balance(s,target.id)}
        except HTTPException:s.rollback();raise
        except Exception:s.rollback();raise

@app.get('/api/admin/invoices')
def invoices(u=Depends(roles('admin'))):
    with Session() as s:return [{'id':i.id,'company':s.get(Company,i.company_id).name,'company_id':i.company_id,'period':i.period,'reference':i.reference,'amount_cents':i.amount_cents,'currency':i.currency,'status':i.status,'due_date':i.due_date,'payment_reference':i.payment_reference} for i in s.scalars(select(Invoice).order_by(Invoice.id.desc())).all()]

@app.post('/api/admin/invoices')
def create_invoice(body:InvoiceBody,u=Depends(roles('admin'))):
    with Session() as s:
        if not s.get(Company,body.company_id):raise HTTPException(404,'Company not found')
        if s.scalar(select(Invoice).where(Invoice.reference==body.reference)):raise HTTPException(409,'Invoice reference already exists')
        i=Invoice(**body.model_dump());s.add(i);s.flush();audit(s,u.id,'INVOICE_CREATED',i.reference);s.commit();return {'id':i.id}

@app.post('/api/admin/invoices/{invoice_id}/status')
def update_invoice(invoice_id:int,body:InvoiceStatus,u=Depends(roles('admin'))):
    if body.status not in ('DRAFT','SENT','PAID','OVERDUE','CANCELLED'):raise HTTPException(400,'Invalid status')
    with Session() as s:
        i=s.get(Invoice,invoice_id)
        if not i:raise HTTPException(404,'Invoice not found')
        i.status=body.status;i.payment_reference=body.payment_reference
        if body.status=='PAID':i.paid_at=now()
        audit(s,u.id,'INVOICE_UPDATED',f'{i.reference}:{i.status}');s.commit();return {'status':i.status}

@app.get('/api/settlements')
def settlements(period:Optional[str]=None,u=Depends(roles('admin','partner'))):
    with Session() as s:
        q=select(Settlement)
        if u.role=='partner':q=q.where(Settlement.partner_id==u.partner_id)
        if period:q=q.where(Settlement.period==period)
        out=[]
        for item in s.scalars(q.order_by(Settlement.id.desc())).all():
            lines=s.scalars(select(SettlementLine).where(SettlementLine.settlement_id==item.id)).all()
            out.append({'id':item.id,'partner':s.get(Partner,item.partner_id).name,'partner_id':item.partner_id,'period':item.period,'status':item.status,'bookings':len(lines),'amount_cents':sum(x.amount_cents for x in lines),'invoice_reference':item.invoice_reference,'payment_reference':item.payment_reference})
        return out

@app.post('/api/admin/settlements/generate')
def generate_settlements(period:str,u=Depends(roles('admin'))):
    if len(period)!=7 or period[4]!='-':raise HTTPException(400,'Use YYYY-MM')
    with Session() as s:
        try:
            lock_transaction(s)
            created=0
            for p in s.scalars(select(Partner)).all():
                st=s.scalar(select(Settlement).where(Settlement.partner_id==p.id,Settlement.period==period))
                if not st:st=Settlement(partner_id=p.id,period=period,status='DRAFT');s.add(st);s.flush();created+=1
                q=select(Booking).join(Slot,Booking.slot_id==Slot.id).where(Booking.partner_id==p.id,Booking.status=='CHECKED_IN')
                for b in s.scalars(q).all():
                    if b.checked_in_at and b.checked_in_at.strftime('%Y-%m')==period and not s.scalar(select(SettlementLine).where(SettlementLine.booking_id==b.id)):
                        s.add(SettlementLine(settlement_id=st.id,booking_id=b.id,amount_cents=b.payout_snapshot_cents))
            audit(s,u.id,'SETTLEMENTS_GENERATED',period);s.commit();return {'created':created,'period':period}
        except HTTPException:s.rollback();raise

@app.post('/api/admin/settlements/{settlement_id}/status')
def update_settlement(settlement_id:int,body:SettlementUpdate,u=Depends(roles('admin'))):
    if body.status not in ('DRAFT','REVIEW','DISPUTED','FINAL','INVOICED','PAID'):raise HTTPException(400,'Invalid settlement status')
    with Session() as s:
        st=s.get(Settlement,settlement_id)
        if not st:raise HTTPException(404,'Settlement not found')
        st.status=body.status;st.invoice_reference=body.invoice_reference;st.payment_reference=body.payment_reference
        audit(s,u.id,'SETTLEMENT_UPDATED',f'{st.id}:{st.status}');s.commit();return {'status':st.status}


@app.get('/api/admin/audit')
def audit_log(u=Depends(roles('admin'))):
    with Session() as s:return [{'id':x.id,'action':x.action,'detail':x.detail,'actor_id':x.actor_id,'at':iso(x.created_at)} for x in s.scalars(select(Audit).order_by(Audit.id.desc()).limit(50)).all()]


def seed():
    Base.metadata.create_all(engine)
    with Session() as s:
        if not DEMO_MODE:
            email = os.environ.get('FLEXPASS_ADMIN_EMAIL', '').strip().lower()
            password = os.environ.get('FLEXPASS_ADMIN_PASSWORD', '')
            if email and password and not s.scalar(select(User.id).where(User.email == email)):
                s.add(User(email=email, full_name='FlexPass Administrator', password_hash=hash_pass(password), role='admin'))
                s.commit()
            return
        if s.scalar(select(Company.id).limit(1)):return
        c1=Company(name='Demo Tech Albania',hr_email='hr@demo-tech.example'); c2=Company(name='Pilot Company',hr_email='people@pilot.example');s.add_all([c1,c2]);s.flush()
        p1=Plan(name='Starter',credits=15,monthly_price=0);p2=Plan(name='Active',credits=30,monthly_price=0);p3=Plan(name='Plus',credits=50,monthly_price=0);s.add_all([p1,p2,p3]);s.flush()
        partner_specs=[('FlexPass Fitness Studio','Blloku'),('Urban Movement House','Komuna e Parisit'),('Zen & Balance Studio','Arena'),('Pulse Sports Club','21 Dhjetori'),('Wellness Corner','Myslym Shyri'),('Glow Atelier','Pazari i Ri'),('Family Activity Center','Farka'),('Lake Pilates Studio','Liqeni i Thate')]
        partners=[Partner(name=n,zone=z) for n,z in partner_specs];s.add_all(partners);s.flush()
        # Generic fictional seed names. The remote catalog was unavailable when this MVP was built.
        defs=[(0,'Open Gym Session','fitness','Gyms',3,60),(0,'Strength & Conditioning','fitness','CrossFit',5,50),(1,'Pilates Reformer','fitness','Pilates',5,50),(1,'Zumba Dance','fitness','Zumba',3,55),(2,'Vinyasa Yoga','fitness','Yoga',4,60),(2,'Low-Impact Aerobics','fitness','Aerobics',3,50),(3,'Swimming Session','sport','Swimming',5,60),(3,'Tennis Court','sport','Tennis',5,60),(3,'Social Football','sport','Football',4,60),(4,'Relaxing Massage','wellness','Massage',7,60),(4,'Sauna & Recovery','wellness','Sauna',5,45),(4,'Spa Access','wellness','Spa',8,90),(5,'Skin Care Ritual','glow','Facials',6,50),(5,'Beauty Express','glow','Beauty',5,45),(6,'Kids Movement Class','kids-family','Kids Sports',4,60),(6,'Creative Play Workshop','kids-family','Creative Play',3,60),(7,'Mat Pilates','fitness','Pilates',4,55)]
        for pi,n,g,sub,credits,dur in defs:
            sv=Service(partner_id=partners[pi].id,name=n,group_name=g,subcategory=sub,description=f'Enjoy a {dur}-minute {n.lower()} experience in Tirana.',credits=credits,payout_cents=credits*15000,duration_minutes=dur)
            s.add(sv);s.flush()
            for days in (1,2,3,5,7):
                date=(now()+timedelta(days=days)).replace(hour=9+(sv.id%8),minute=0,second=0,microsecond=0)
                s.add(Slot(service_id=sv.id,start_at=date,capacity=6+(sv.id%4),reserved=0))
        demo_passwords = {role: os.environ.get(f'FLEXPASS_DEMO_{role.upper()}_PASSWORD', 'Demo123!') for role in ('admin', 'employee', 'partner')}
        users=[User(email='admin@flexpass.demo',full_name='FlexPass Admin',password_hash=hash_pass(demo_passwords['admin']),role='admin'),User(email='employee@flexpass.demo',full_name='Alex Demo',password_hash=hash_pass(demo_passwords['employee']),role='employee',company_id=c1.id,plan_id=p2.id),User(email='partner@flexpass.demo',full_name='Studio Manager',password_hash=hash_pass(demo_passwords['partner']),role='partner',partner_id=partners[0].id)]
        s.add_all(users);s.flush()
        s.add(Ledger(user_id=users[1].id,kind='ALLOCATION',amount=30,period=now().strftime('%Y-%m'),actor_id=users[0].id,reason='Pilot monthly allowance'))
        s.add(Invoice(company_id=c1.id,period=now().strftime('%Y-%m'),reference='DEMO-INV-001',amount_cents=0,status='DRAFT'))
        s.commit()

seed()
DIST = ROOT / 'frontend' / 'dist'
if DIST.is_dir():
    app.mount('/assets', StaticFiles(directory=DIST / 'assets'), name='assets')

@app.get('/')
@app.get('/services')
@app.get('/login')
@app.get('/login/client')
@app.get('/login/business')
@app.get('/admin/login')
@app.get('/contact')
@app.get('/privacy')
@app.get('/terms')
@app.get('/employee')
@app.get('/partner')
@app.get('/admin')
def index():
    file = DIST / 'index.html'
    if file.exists():
        return FileResponse(file, headers={'Cache-Control': 'no-cache'})
    return HTMLResponse('<h1>FlexPass API running</h1><p>Start the React frontend: '
                        '<code>cd frontend &amp;&amp; npm install &amp;&amp; npm run dev</code></p>'
                        '<p>Visit <a href="http://127.0.0.1:5173/services?maxCredits=5">React demo</a>.</p>')
