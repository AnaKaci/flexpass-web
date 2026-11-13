"""FlexPass functional pilot API. Development auth and seed data; not production-ready."""
import base64
import binascii
import csv
import hashlib
import hmac
import io
import json
from urllib.request import Request as UrlRequest, urlopen
from urllib.error import HTTPError, URLError
import os
import re
import secrets
import smtplib
from email.message import EmailMessage
from urllib.parse import quote
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import jwt
from PIL import Image, ImageOps, UnidentifiedImageError
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
# Simulated bank transfer can never run in production, even if demo data is enabled there.
SIMULATED_BANK_TRANSFERS = DEMO_MODE and ENVIRONMENT in ('development', 'test', 'staging')
CANCELLATION_CUTOFF_HOURS = max(0, int(os.environ.get('FLEXPASS_CANCELLATION_CUTOFF_HOURS', '0')))
CANCELLATION_FULL_HOURS = max(1, int(os.environ.get('FLEXPASS_CANCELLATION_FULL_REFUND_HOURS', '24')))
CANCELLATION_PARTIAL_HOURS = max(0, int(os.environ.get('FLEXPASS_CANCELLATION_PARTIAL_REFUND_HOURS', '6')))
CANCELLATION_PARTIAL_PERCENT = max(0, min(100, int(os.environ.get('FLEXPASS_CANCELLATION_PARTIAL_REFUND_PERCENT', '50'))))
if CANCELLATION_PARTIAL_HOURS >= CANCELLATION_FULL_HOURS:
    raise RuntimeError('Cancellation partial threshold must be below full refund threshold.')
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

class CreditProduct(Base):
    __tablename__ = 'credit_products'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    credits = Column(Integer, nullable=False)
    price_cents = Column(Integer, nullable=False)
    currency = Column(String(10), default='ALL')
    active = Column(Boolean, default=True)

class ClientOrder(Base):
    __tablename__ = 'client_orders'
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    product_id = Column(Integer, ForeignKey('credit_products.id'), nullable=False)
    request_key = Column(String(100), nullable=False)
    credits_snapshot = Column(Integer, nullable=False)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(10), default='ALL')
    status = Column(String(25), nullable=False, default='PENDING')
    created_at = Column(DateTime, default=now)
    confirmed_at = Column(DateTime)
    confirmed_by = Column(Integer, ForeignKey('users.id'))
    payment_reference = Column(String(120), default='')
    __table_args__ = (UniqueConstraint('client_id','request_key',name='uq_client_order_key'),)

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

class ClientProfileDetails(Base):
    """Client-maintained optional information. Separate table preserves existing users."""
    __tablename__ = 'client_profile_details'
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    birthday = Column(String(10), nullable=True)
    phone = Column(String(35), nullable=False, default='')
    city = Column(String(100), nullable=False, default='')
    country = Column(String(80), nullable=False, default='')
    about = Column(String(300), nullable=False, default='')
    avatar_data = Column(Text, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=now)

class AccountInvitation(Base):
    __tablename__ = 'account_invitations'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime)
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

class Notification(Base):
    __tablename__ = 'notifications'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    kind = Column(String(40), nullable=False)
    title = Column(String(140), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=now, nullable=False)
    read_at = Column(DateTime)

class CheckinCode(Base):
    __tablename__ = 'checkin_codes'
    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey('bookings.id'), nullable=False, unique=True)
    code_hash = Column(String(64), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    used_at = Column(DateTime)

class ServiceReview(Base):
    __tablename__ = 'service_reviews'
    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey('bookings.id'), nullable=False, unique=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    service_id = Column(Integer, ForeignKey('services.id'), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=now, nullable=False)

from .booking_features import (SlotHold, WaitlistEntry, BookingCancellation,
                               active_holds, reconcile_waitlist, cancellation_quote)

class ClientProfileUpdateBody(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    birthday: Optional[date] = None
    phone: str = Field(default='', max_length=35)
    city: str = Field(default='', max_length=100)
    country: str = Field(default='', max_length=80)
    about: str = Field(default='', max_length=300)

class ClientAvatarBody(BaseModel):
    image_data: str = Field(min_length=30, max_length=450000)

class ClientRegistrationBody(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: str = Field(min_length=5, max_length=200)

class CreditProductBody(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    credits: int = Field(gt=0, le=10000)
    price_cents: int = Field(gt=0, le=100000000)

class ClientOrderBody(BaseModel):
    product_id: int
    request_key: str = Field(min_length=8, max_length=100)

class DemoAccountsSetupBody(BaseModel):
    client_password: str = Field(min_length=20, max_length=256)
    business_password: str = Field(min_length=20, max_length=256)

class ConfirmOrderBody(BaseModel):
    payment_reference: str = Field(min_length=3, max_length=120)

class LoginBody(BaseModel):
    email: str
    password: str
    portal: Optional[str] = None
class ActivateBody(BaseModel):
    token: str = Field(min_length=32, max_length=256)
    password: str = Field(min_length=12, max_length=256)

class PartnerInviteBody(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    zone: str = Field(min_length=2, max_length=100)
    contact_name: str = Field(min_length=2, max_length=160)
    contact_email: str = Field(min_length=3, max_length=200)

class BookBody(BaseModel):
    slot_id: int
    hold_id: Optional[int] = None
class CompanyBody(BaseModel):
    name: str = Field(min_length=2)
    hr_email: str = ''
class PlanBody(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    credits: int = Field(ge=1, le=10000)
    monthly_price_cents: int = Field(ge=0)

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
class BulkSlotsBody(BaseModel):
    service_id: int
    start_at: datetime
    capacity: int = Field(ge=1, le=100)
    count: int = Field(ge=1, le=12)
    frequency: str = Field(pattern='^(daily|weekly)$')

class CheckinVerificationBody(BaseModel):
    code: str = Field(pattern=r'^\d{8}$')

class ReviewBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default='', max_length=500)

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

def invitation_link(token):
    origin=os.environ.get('FLEXPASS_APP_URL','http://127.0.0.1:5173').rstrip('/')
    if ENVIRONMENT=='production' and not origin.startswith('https://'):
        raise HTTPException(503,'FLEXPASS_APP_URL must be an HTTPS address')
    return origin + '/register?token=' + quote(token)

def send_invite(email, name, token, role):
    link=invitation_link(token)
    api_key=os.environ.get('FLEXPASS_RESEND_API_KEY','')
    sender=os.environ.get('FLEXPASS_EMAIL_FROM','') or os.environ.get('FLEXPASS_SMTP_FROM','')
    host=os.environ.get('FLEXPASS_SMTP_HOST','')
    if api_key and sender:
        body=json.dumps({'from':sender,'to':[email],'subject':'Activate your FlexPass account',
                         'text':f'Hello {name},\\n\\nActivate your {role} account using this one-time link within 24 hours:\\n{link}\\n\\nIf you did not request this invitation, ignore this message.'}).encode()
        request=UrlRequest('https://api.resend.com/emails',data=body,
                           headers={'Authorization':'Bearer '+api_key,'Content-Type':'application/json','User-Agent':'FlexPass/1.0'},
                           method='POST')
        try:
            with urlopen(request,timeout=15) as response:
                if response.status not in (200,201,202):raise HTTPException(503,'Invitation email could not be delivered')
        except (OSError,HTTPError,URLError) as exc:
            raise HTTPException(503,'Invitation email could not be delivered') from exc
        return None
    if not host or not sender:
        if ENVIRONMENT=='production':raise HTTPException(503,'Configure FLEXPASS_RESEND_API_KEY and FLEXPASS_EMAIL_FROM (or SMTP on paid hosting)')
        return link
    msg=EmailMessage()
    msg['Subject']='Activate your FlexPass account'
    msg['From']=sender
    msg['To']=email
    msg.set_content(f'Hello {name},\\n\\nYour {role} account has been invited to FlexPass.\\nUse this single-use activation link within 24 hours:\\n{link}\\n\\nIf you did not expect this invitation, ignore this email.')
    port=int(os.environ.get('FLEXPASS_SMTP_PORT','465'))
    user=os.environ.get('FLEXPASS_SMTP_USER','')
    password=os.environ.get('FLEXPASS_SMTP_PASSWORD','')
    try:
        if port==465:
            with smtplib.SMTP_SSL(host,port,timeout=15) as conn:
                if user:conn.login(user,password)
                conn.send_message(msg)
        else:
            with smtplib.SMTP(host,port,timeout=15) as conn:
                conn.starttls()
                if user:conn.login(user,password)
                conn.send_message(msg)
    except (OSError,smtplib.SMTPException) as exc:
        raise HTTPException(503,'Invitation email could not be delivered') from exc
    return None

def create_invitation(s, user):
    token=secrets.token_urlsafe(36)
    # Make a newly issued link invalidate all prior pending invitations.
    for pending in s.scalars(select(AccountInvitation).where(AccountInvitation.user_id==user.id,AccountInvitation.used_at.is_(None))).all():
        pending.used_at=now()
    invite=AccountInvitation(user_id=user.id,token_hash=hashlib.sha256(token.encode()).hexdigest(),expires_at=now()+timedelta(hours=24))
    s.add(invite)
    return token

def invite_response(user_id, link):
    response={'id':user_id,'status':'INVITED','email_sent':link is None}
    # Only local development may expose an activation link for demo testing.
    if link and ENVIRONMENT!='production':response['dev_activation_url']=link
    return response

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
        if not u or u.membership_status != 'ACTIVE' or u.role not in ('admin','partner','employee','client'): raise HTTPException(403,'Account inactive')
        s.expunge(u);return u

def roles(*allowed):
    def dep(u=Depends(get_user)):
        if u.role not in allowed: raise HTTPException(403,'Insufficient permissions')
        return u
    return dep

def balance(s,uid):
    return int(s.scalar(select(func.coalesce(func.sum(Ledger.amount),0)).where(Ledger.user_id==uid)) or 0)

def audit(s,actor,action,detail): s.add(Audit(actor_id=actor, action=action, detail=detail))

def notify_user(s, user_id, kind, title, message):
    s.add(Notification(user_id=user_id, kind=kind, title=title, message=message))

def notify_partner(s, partner_id, kind, title, message):
    users=s.scalars(select(User).where(User.partner_id==partner_id, User.role=='partner', User.membership_status=='ACTIVE')).all()
    for user in users:
        notify_user(s,user.id,kind,title,message)

def notify_admins(s, kind, title, message):
    admins=s.scalars(select(User).where(User.role=='admin',User.membership_status=='ACTIVE')).all()
    for admin in admins:
        notify_user(s,admin.id,kind,title,message)

def checkin_digest(booking_id,code):
    return hmac.new(SECRET.encode(), f'check-in:{booking_id}:{code}'.encode(), hashlib.sha256).hexdigest()

def lock_transaction(s):
    # SQLite serialize writers before reading capacity/balance; PostgreSQL: row locks below.
    if DB_URL.startswith('sqlite'):
        s.connection().exec_driver_sql('BEGIN IMMEDIATE')

def user_view(u):
    # Older employer-funded employee records remain untouched for historical ledger integrity.
    public_role='client' if u.role=='employee' else u.role
    return {'id':u.id,'full_name':u.full_name,'email':u.email,'role':public_role,'company_id':u.company_id,'partner_id':u.partner_id,'plan_id':u.plan_id,'status':u.membership_status}

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
    # Bank instructions are public operational details, never credentials.
    # No real beneficiary details are implied by demo placeholders.
    configured=all(os.environ.get(key,'').strip() for key in
                   ('FLEXPASS_BANK_NAME','FLEXPASS_BANK_BENEFICIARY','FLEXPASS_BANK_IBAN'))
    bank={'demo_enabled':SIMULATED_BANK_TRANSFERS,
          'configured':SIMULATED_BANK_TRANSFERS or configured,
          'bank_name':'DEMO BANK — NO REAL TRANSFERS' if SIMULATED_BANK_TRANSFERS else os.environ.get('FLEXPASS_BANK_NAME',''),
          'beneficiary':'FLEXPASS DEMO ONLY' if SIMULATED_BANK_TRANSFERS else os.environ.get('FLEXPASS_BANK_BENEFICIARY',''),
          'iban':'DEMO-ONLY-NOT-A-REAL-IBAN' if SIMULATED_BANK_TRANSFERS else os.environ.get('FLEXPASS_BANK_IBAN','')}
    return {'app':'FlexPass','preview':True,'seeded':DEMO_MODE,'demo_mode':DEMO_MODE,
            'bank_transfer':bank,'groups':GROUPS,'zones':ZONES,'subcategories':SUBCATS,
            'tagline':'Private-launch access pass for premium daily services, real booking, and hard-to-reach routines.'}

def authenticate_portal(body:LoginBody, allowed_roles):
    # The selected portal is verified on the server. The admin portal is isolated
    # from employee/partner login even when credentials are otherwise valid.
    with Session() as s:
        u=s.scalar(select(User).where(User.email==body.email.strip().lower()))
        if (not u or not match_pass(body.password,u.password_hash)
            or u.membership_status!='ACTIVE' or u.role not in allowed_roles
            or (body.portal and body.portal != ('client' if u.role=='employee' else u.role) and not (u.role=='employee' and body.portal=='employee'))):
            raise HTTPException(401,'Invalid credentials for this portal')
        return {'token':token_for(u),'user':user_view(u)}

@app.post('/api/auth/login')
def login(body:LoginBody):
    return authenticate_portal(body, ('employee','client','partner'))

@app.post('/api/auth/admin/login')
def admin_login(body:LoginBody):
    return authenticate_portal(body, ('admin',))

@app.post('/api/auth/activate')
def activate_account(body:ActivateBody):
    digest=hashlib.sha256(body.token.encode()).hexdigest()
    with Session() as s:
        try:
            lock_transaction(s)
            invitation=s.scalar(select(AccountInvitation).where(AccountInvitation.token_hash==digest).with_for_update())
            if not invitation or invitation.used_at or invitation.expires_at<=now():
                raise HTTPException(400,'Activation link is invalid or expired')
            user=s.scalar(select(User).where(User.id==invitation.user_id).with_for_update())
            if not user or user.membership_status!='INVITED' or user.role not in ('employee','client','partner'):
                raise HTTPException(400,'Invitation is no longer valid')
            user.password_hash=hash_pass(body.password)
            user.membership_status='ACTIVE'
            invitation.used_at=now()
            audit(s,user.id,'ACCOUNT_ACTIVATED',user.role)
            s.commit()
            return {'status':'ACTIVE','role':'client' if user.role=='employee' else user.role}
        except HTTPException:
            s.rollback()
            raise

@app.post('/api/auth/register')
def register_client(body:ClientRegistrationBody):
    email=body.email.strip().lower()
    if len(email)>200 or email.count('@')!=1 or '.' not in email.rsplit('@',1)[1]:
        raise HTTPException(422,'Enter a valid email address')
    with Session() as s:
        if s.scalar(select(User.id).where(User.email==email)):
            raise HTTPException(409,'An account already exists with this email')
        user=User(email=email,full_name=body.full_name.strip(),role='client',
                  password_hash=hash_pass(secrets.token_urlsafe(48)),
                  membership_status='INVITED',company_id=None,plan_id=None)
        s.add(user);s.flush()
        token=create_invitation(s,user)
        link=send_invite(email,user.full_name,token,'personal client')
        audit(s,user.id,'CLIENT_REGISTERED',email)
        s.commit()
        return invite_response(user.id,link)

@app.get('/api/auth/me')
def me(u=Depends(get_user)):return user_view(u)

def client_profile_view(user, details):
    """Never include passwords, banking details, other clients or internal auth state."""
    return {'full_name':user.full_name, 'email':user.email, 'status':user.membership_status,
            'birthday':details.birthday if details else None,
            'phone':details.phone if details else '',
            'city':details.city if details else '',
            'country':details.country if details else '',
            'about':details.about if details else '',
            'avatar_data':details.avatar_data if details else None}

@app.get('/api/client/profile')
def client_profile(u=Depends(roles('client','employee'))):
    with Session() as s:
        details=s.get(ClientProfileDetails,u.id)
        return client_profile_view(u,details)

@app.patch('/api/client/profile')
def edit_client_profile(body:ClientProfileUpdateBody,u=Depends(roles('client','employee'))):
    cleaned_name=body.full_name.strip()
    if len(cleaned_name)<2:raise HTTPException(422,'Full name must contain at least two characters')
    if body.birthday and (body.birthday>date.today() or body.birthday.year<1900):
        raise HTTPException(422,'Enter a valid past birthday')
    phone=body.phone.strip()
    if phone and not re.fullmatch(r'[+0-9() .-]{3,35}',phone):
        raise HTTPException(422,'Enter a valid phone number')
    with Session() as s:
        user=s.get(User,u.id)
        if not user:raise HTTPException(403,'Account inactive')
        details=s.get(ClientProfileDetails,u.id)
        if not details:
            details=ClientProfileDetails(user_id=u.id)
            s.add(details)
        user.full_name=cleaned_name
        details.birthday=body.birthday.isoformat() if body.birthday else None
        details.phone=phone
        details.city=body.city.strip()
        details.country=body.country.strip()
        details.about=body.about.strip()
        details.updated_at=now()
        audit(s,u.id,'CLIENT_PROFILE_UPDATED','Client edited own profile information')
        s.commit()
        return client_profile_view(user,details)

def sanitize_profile_avatar(value:str):
    """Decode a photo, check actual image format/dimensions, strip metadata and re-encode."""
    parts=value.split(',',1)
    if len(parts)!=2 or parts[0] not in ('data:image/jpeg;base64','data:image/png;base64','data:image/webp;base64'):
        raise HTTPException(422,'Please upload a JPEG, PNG or WebP image')
    try:
        raw=base64.b64decode(parts[1],validate=True)
        if not raw or len(raw)>260000:
            raise HTTPException(422,'Photo must be smaller than 260 KB after resizing')
        with Image.open(io.BytesIO(raw)) as picture:
            if picture.format not in ('JPEG','PNG','WEBP'):
                raise HTTPException(422,'Unsupported photo format')
            if picture.width>2048 or picture.height>2048 or picture.width<16 or picture.height<16:
                raise HTTPException(422,'Photo dimensions must be between 16 and 2048 pixels')
            picture=ImageOps.exif_transpose(picture)
            picture.thumbnail((320,320))
            buffer=io.BytesIO()
            picture.convert('RGB').save(buffer,format='JPEG',quality=78,optimize=True)
        encoded=base64.b64encode(buffer.getvalue()).decode('ascii')
        return 'data:image/jpeg;base64,'+encoded
    except HTTPException:
        raise
    except (binascii.Error,ValueError,UnidentifiedImageError,OSError,Image.DecompressionBombError):
        raise HTTPException(422,'Invalid image data')

@app.put('/api/client/profile/avatar')
def upload_client_avatar(body:ClientAvatarBody,u=Depends(roles('client','employee'))):
    data=sanitize_profile_avatar(body.image_data)
    with Session() as s:
        details=s.get(ClientProfileDetails,u.id)
        if not details:
            details=ClientProfileDetails(user_id=u.id)
            s.add(details)
        details.avatar_data=data
        details.updated_at=now()
        audit(s,u.id,'CLIENT_AVATAR_UPDATED','Client updated own profile photo')
        s.commit()
        return {'avatar_data':data}

@app.delete('/api/client/profile/avatar')
def delete_client_avatar(u=Depends(roles('client','employee'))):
    with Session() as s:
        details=s.get(ClientProfileDetails,u.id)
        if details:
            details.avatar_data=None
            details.updated_at=now()
            audit(s,u.id,'CLIENT_AVATAR_REMOVED','Client removed own profile photo')
            s.commit()
        return {'avatar_data':None}

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
            out.append({'id':service.id,'name':service.name,'group':service.group_name,'subcategory':service.subcategory,'description':service.description,'credits':service.credits,'duration_minutes':service.duration_minutes,'partner':partner.name,'partner_id':partner.id,'zone':partner.zone,'slots':[{'id':x.id,'start_at':iso(x.start_at),'capacity':x.capacity,'available':max(0,x.capacity-x.reserved-active_holds(s,x.id))} for x in slots]})
        return out

@app.get('/api/client/summary')
@app.get('/api/employee/summary')
def employee_summary(u=Depends(roles('employee','client'))):
    with Session() as s:
        c=s.get(Company,u.company_id);p=s.get(Plan,u.plan_id)
        rows=s.scalars(select(Booking).where(Booking.user_id==u.id)).all()
        return {'user':user_view(u),'company':c.name if c else '', 'plan':p.name if p else '',
                'monthly_credits':p.credits if p else 0,'balance':balance(s,u.id),
                'active_bookings':sum(x.status=='BOOKED' for x in rows),
                'visits':sum(x.status=='CHECKED_IN' for x in rows),
                'personal_account':u.role=='client'}

def booking_view(s,b):
    sv=s.get(Service,b.service_id);p=s.get(Partner,b.partner_id);sl=s.get(Slot,b.slot_id);u=s.get(User,b.user_id)
    return {'id':b.id,'reference':b.reference,'service':sv.name,'partner':p.name,'partner_id':b.partner_id,'user':u.full_name,'email':u.email,'start_at':iso(sl.start_at),'credits':b.credits_snapshot,'payout_cents':b.payout_snapshot_cents,'status':b.status,'created_at':iso(b.created_at),'checked_in_at':iso(b.checked_in_at),'zone':p.zone, 'reviewed':bool(s.scalar(select(ServiceReview.id).where(ServiceReview.booking_id==b.id)))}

@app.get('/api/client/bookings')
@app.get('/api/employee/bookings')
def employee_bookings(u=Depends(roles('employee','client'))):
    with Session() as s:return [booking_view(s,b) for b in s.scalars(select(Booking).where(Booking.user_id==u.id).order_by(Booking.id.desc())).all()]

@app.get('/api/client/ledger')
@app.get('/api/employee/ledger')
def employee_ledger(u=Depends(roles('employee','client'))):
    with Session() as s:
        return [{'id':x.id,'kind':x.kind,'amount':x.amount,'period':x.period,'created_at':iso(x.created_at),'reason':x.reason,'booking_id':x.booking_id} for x in s.scalars(select(Ledger).where(Ledger.user_id==u.id).order_by(Ledger.id.desc())).all()]

@app.post('/api/bookings')
def make_booking(body:BookBody,req:Request,u=Depends(roles('employee','client'))):
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
            reconcile_waitlist(s,sl)
            hold=None
            if body.hold_id is not None:
                hold=s.scalar(select(SlotHold).where(SlotHold.id==body.hold_id,
                         SlotHold.user_id==u.id,SlotHold.slot_id==sl.id).with_for_update())
                if not hold or hold.expires_at<=now():
                    raise HTTPException(409,'Hold expired; select the session again')
            if sl.reserved+active_holds(s,sl.id)-(1 if hold else 0)>=sl.capacity:
                raise HTTPException(409,'No remaining places')
            if balance(s,u.id)<service.credits: raise HTTPException(409,'Insufficient credits')
            if s.scalar(select(Booking).where(Booking.user_id==u.id,Booking.slot_id==sl.id)):
                raise HTTPException(409,'Already booked this slot')
            sl.reserved+=1
            b=Booking(reference='FP-'+secrets.token_hex(4).upper(),user_id=u.id,slot_id=sl.id,service_id=service.id,partner_id=service.partner_id,credits_snapshot=service.credits,payout_snapshot_cents=service.payout_cents,status='BOOKED')
            s.add(b);s.flush()
            if hold:
                if hold.waitlist_id:
                    entry=s.get(WaitlistEntry,hold.waitlist_id)
                    if entry and entry.status=='OFFERED':entry.status='BOOKED'
                s.delete(hold);s.flush()
            if key:s.add(BookingRequest(user_id=u.id,idempotency_key=key,slot_id=sl.id,booking_id=b.id))
            s.add(Ledger(user_id=u.id,booking_id=b.id,kind='DEBIT',
                         source='PERSONAL' if u.role=='client' else 'COMPANY',
                         amount=-service.credits,period=now().strftime('%Y-%m'),
                         actor_id=u.id,reason=f'Booking {b.reference}'))
            audit(s,u.id,'BOOKING_CREATED',b.reference)
            notify_user(s,u.id,'BOOKING_CREATED','Booking confirmed',
                        f'Your reservation {b.reference} is confirmed.')
            notify_partner(s,b.partner_id,'NEW_BOOKING','New reservation',
                           f'New reservation {b.reference} requires attendance check-in.')
            s.commit(); return booking_view(s,b)
        except HTTPException:
            s.rollback();raise
        except Exception:
            s.rollback();raise

@app.post('/api/bookings/{booking_id}/cancel')
def cancel_booking(booking_id:int,u=Depends(roles('employee','client'))):
    with Session() as s:
        try:
            lock_transaction(s)
            b=s.scalar(select(Booking).where(Booking.id==booking_id).with_for_update())
            if not b:raise HTTPException(404,'Booking not found')
            if b.user_id!=u.id:raise HTTPException(403,'Not your booking')
            if b.status!='BOOKED':raise HTTPException(409,'Only active bookings may be cancelled')
            sl=s.scalar(select(Slot).where(Slot.id==b.slot_id).with_for_update())
            quote=cancellation_quote(b,sl)
            if not quote['allowed']:raise HTTPException(409,'Cancellation window closed')
            if sl.reserved<1:raise HTTPException(409,'Slot inventory inconsistent')
            b.status='CANCELLED';b.cancelled_at=now();sl.reserved-=1
            amount=quote['refund_credits']
            if amount:
                s.add(Ledger(user_id=b.user_id,booking_id=b.id,kind='REFUND',
                             source='PERSONAL' if u.role=='client' else 'COMPANY',
                             amount=amount,period=now().strftime('%Y-%m'),actor_id=u.id,
                             reason=f'Cancellation {b.reference}: {quote["policy_tier"]}'))
            s.add(BookingCancellation(booking_id=b.id,refunded_credits=amount,
                  retained_credits=quote['retained_credits'],policy_tier=quote['policy_tier'],
                  actor_id=u.id))
            reconcile_waitlist(s,sl)
            audit(s,u.id,'BOOKING_CANCELLED',
                  f'{b.reference},refund={amount},tier={quote["policy_tier"]}')
            notify_user(s,u.id,'BOOKING_CANCELLED','Booking cancelled',
                        f'Reservation {b.reference} was cancelled. {amount} credits returned.')
            notify_partner(s,b.partner_id,'BOOKING_CANCELLED','Reservation cancelled',
                           f'Reservation {b.reference} was cancelled.')
            s.commit();return {'status':'CANCELLED','refunded':amount,
                               'retained':quote['retained_credits'],
                               'policy_tier':quote['policy_tier']}
        except HTTPException:s.rollback();raise
        except Exception:s.rollback();raise

def product_view(item):
    return {'id':item.id,'name':item.name,'credits':item.credits,'price_cents':item.price_cents,'currency':item.currency,'active':item.active}

def client_order_view(s,order):
    item=s.get(CreditProduct,order.product_id)
    return {'id':order.id,'product':item.name if item else 'Credit package','product_id':order.product_id,
            'client_id':order.client_id,'credits':order.credits_snapshot,'amount_cents':order.amount_cents,
            'currency':order.currency,'status':order.status,'created_at':iso(order.created_at),
            'payment_reference':order.payment_reference or '',
            'bank_reference':f'FP-ORDER-{order.id:06d}',
            'payment_method':'BANK_TRANSFER',
            'simulated':order.status=='DEMO_PAID'}

@app.get('/api/client/products')
def client_products(u=Depends(roles('employee','client'))):
    with Session() as s:
        return [product_view(p) for p in s.scalars(select(CreditProduct).where(CreditProduct.active==True).order_by(CreditProduct.id)).all()]

@app.get('/api/client/orders')
def client_orders(u=Depends(roles('employee','client'))):
    with Session() as s:
        orders=s.scalars(select(ClientOrder).where(ClientOrder.client_id==u.id).order_by(ClientOrder.id.desc())).all()
        return [client_order_view(s,o) for o in orders]

@app.post('/api/client/orders')
def request_client_order(body:ClientOrderBody,u=Depends(roles('employee','client'))):
    with Session() as s:
        try:
            lock_transaction(s)
            account=s.scalar(select(User).where(User.id==u.id).with_for_update())
            if not account or account.membership_status!='ACTIVE':
                raise HTTPException(403,'Account inactive')
            previous=s.scalar(select(ClientOrder).where(ClientOrder.client_id==u.id,ClientOrder.request_key==body.request_key))
            if previous:
                if previous.product_id!=body.product_id:
                    raise HTTPException(409,'Order key already used for another product')
                return client_order_view(s,previous)
            item=s.get(CreditProduct,body.product_id)
            if not item or not item.active or item.price_cents<=0:
                raise HTTPException(404,'Product not available for ordering')
            order=ClientOrder(client_id=u.id,product_id=item.id,request_key=body.request_key,
                              credits_snapshot=item.credits,amount_cents=item.price_cents,
                              currency=item.currency,status='PENDING')
            s.add(order);s.flush()
            audit(s,u.id,'CLIENT_ORDER_REQUESTED',f'Order {order.id}: {item.name}')
            notify_admins(s,'ORDER_REQUESTED','Client order needs review',
                          f'Order #{order.id} is pending independent payment verification.')
            s.commit()
            return client_order_view(s,order)
        except HTTPException:s.rollback();raise
        except Exception:s.rollback();raise

@app.post('/api/client/orders/{order_id}/demo-bank-transfer')
def simulate_bank_transfer(order_id:int,u=Depends(roles('client','employee'))):
    # Strict sandbox endpoint. Real production cannot simulate a paid bank transaction.
    if not SIMULATED_BANK_TRANSFERS:
        raise HTTPException(403,'Simulated bank transfer is disabled outside test environments')
    with Session() as s:
        try:
            lock_transaction(s)
            order=s.scalar(select(ClientOrder).where(ClientOrder.id==order_id).with_for_update())
            if not order:
                raise HTTPException(404,'Order not found')
            if order.client_id != u.id:
                raise HTTPException(403,'Not your order')
            if order.status=='DEMO_PAID':
                return client_order_view(s,order)  # replay without a second allocation
            if order.status!='PENDING':
                raise HTTPException(409,'Order was already processed')
            account=s.scalar(select(User).where(User.id==u.id).with_for_update())
            if not account or account.membership_status!='ACTIVE':
                raise HTTPException(403,'Account inactive')
            order.status='DEMO_PAID'
            order.confirmed_at=now()
            order.payment_reference=f'DEMO-BANK-{order.id:06d}'
            s.add(Ledger(user_id=u.id,kind='ALLOCATION',amount=order.credits_snapshot,
                         source='DEMO_BANK',period=now().strftime('%Y-%m'),
                         actor_id=u.id,reason=f'SIMULATED bank transfer for order {order.id} (no funds transferred)'))
            audit(s,u.id,'DEMO_BANK_TRANSFER_SIMULATED',f'Order {order.id}; no real funds')
            s.commit()
            return client_order_view(s,order)
        except HTTPException:
            s.rollback()
            raise
        except Exception:
            s.rollback()
            raise

@app.get('/api/admin/client-products')
def admin_client_products(u=Depends(roles('admin'))):
    with Session() as s:return [product_view(p) for p in s.scalars(select(CreditProduct).order_by(CreditProduct.id)).all()]

@app.post('/api/admin/client-products')
def admin_create_client_product(body:CreditProductBody,u=Depends(roles('admin'))):
    with Session() as s:
        if s.scalar(select(CreditProduct.id).where(func.lower(CreditProduct.name)==body.name.strip().lower())):
            raise HTTPException(409,'Product name already exists')
        item=CreditProduct(name=body.name.strip(),credits=body.credits,price_cents=body.price_cents,
                           currency='ALL',active=True)
        s.add(item);s.flush()
        audit(s,u.id,'CREDIT_PRODUCT_CREATED',f'{item.id}:{item.name}')
        s.commit()
        return product_view(item)

@app.get('/api/admin/client-orders')
def admin_client_orders(u=Depends(roles('admin'))):
    with Session() as s:
        rows=s.scalars(select(ClientOrder).order_by(ClientOrder.id.desc())).all()
        return [{**client_order_view(s,o),'email':s.get(User,o.client_id).email} for o in rows]

@app.post('/api/admin/client-orders/{order_id}/confirm')
def admin_confirm_client_order(order_id:int,body:ConfirmOrderBody,u=Depends(roles('admin'))):
    ref=body.payment_reference.strip()
    if not ref:raise HTTPException(422,'A payment confirmation reference is required')
    with Session() as s:
        try:
            lock_transaction(s)
            order=s.scalar(select(ClientOrder).where(ClientOrder.id==order_id).with_for_update())
            if not order:raise HTTPException(404,'Order not found')
            if order.status!='PENDING':raise HTTPException(409,'Order already processed')
            account=s.scalar(select(User).where(User.id==order.client_id).with_for_update())
            if not account or account.membership_status!='ACTIVE':raise HTTPException(409,'Client account inactive')
            order.status='CONFIRMED';order.confirmed_at=now();order.confirmed_by=u.id
            order.payment_reference=ref
            s.add(Ledger(user_id=account.id,kind='ALLOCATION',amount=order.credits_snapshot,
                         source='PERSONAL',period=now().strftime('%Y-%m'),actor_id=u.id,
                         reason=f'Credit product order {order.id}: {ref}'))
            audit(s,u.id,'CLIENT_ORDER_CONFIRMED',f'Order {order.id}; ref={ref}')
            notify_user(s,account.id,'ORDER_CONFIRMED','Credits added',
                        f'Order #{order.id} is confirmed. {order.credits_snapshot} credits were added to your wallet.')
            s.commit()
            return client_order_view(s,order)
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
            audit(s,u.id,'CHECK_IN',b.reference)
            notify_user(s,b.user_id,'CHECK_IN','Visit confirmed',
                        f'Attendance confirmed for reservation {b.reference}.')
            s.commit()
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
        return {'companies':count(Company),'employees':s.scalar(select(func.count(User.id)).where(User.role=='employee')),'partners':count(Partner),'services':count(Service),'bookings':len(bookings),'visits':sum(x.status=='CHECKED_IN' for x in bookings),'clients':s.scalar(select(func.count(User.id)).where(User.role.in_(['client','employee']))),'orders_pending':s.scalar(select(func.count(ClientOrder.id)).where(ClientOrder.status=='PENDING')),'credits_issued':s.scalar(select(func.coalesce(func.sum(Ledger.amount),0)).where(Ledger.kind=='ALLOCATION')),'partner_payables_cents':sum(x.payout_snapshot_cents for x in bookings if x.status=='CHECKED_IN')}

@app.get('/api/admin/clients')
def admin_clients(u=Depends(roles('admin'))):
    with Session() as s:
        rows=s.scalars(select(User).where(User.role.in_(['client','employee'])).order_by(User.id.desc())).all()
        return [{'id':client.id,'name':client.full_name,'email':client.email,
                 'status':client.membership_status,'balance':balance(s,client.id),
                 'orders':s.scalar(select(func.count(ClientOrder.id)).where(ClientOrder.client_id==client.id)),
                 'legacy':client.role=='employee'} for client in rows]

@app.get('/api/admin/companies')
def companies(u=Depends(roles('admin'))):
    with Session() as s:return [{'id':c.id,'name':c.name,'hr_email':c.hr_email,'status':c.status,'employees':s.scalar(select(func.count(User.id)).where(User.company_id==c.id,User.role=='employee'))} for c in s.scalars(select(Company).order_by(Company.name)).all()]

@app.post('/api/admin/companies')
def create_company(body:CompanyBody,u=Depends(roles('admin'))):
    with Session() as s:
        if s.scalar(select(Company).where(Company.name==body.name)):raise HTTPException(409,'Company already exists')
        c=Company(**body.model_dump());s.add(c);s.flush();audit(s,u.id,'COMPANY_CREATED',str(c.id));s.commit();return {'id':c.id}

@app.get('/api/admin/partners')
def admin_partners(u=Depends(roles('admin'))):
    with Session() as s:
        return [{'id':p.id,'name':p.name,'zone':p.zone,'status':p.status,
                 'accounts':[{'id':x.id,'email':x.email,'status':x.membership_status}
                             for x in s.scalars(select(User).where(User.partner_id==p.id,User.role=='partner')).all()]}
                for p in s.scalars(select(Partner).order_by(Partner.id)).all()]

@app.post('/api/admin/partners')
def admin_invite_partner(body:PartnerInviteBody,u=Depends(roles('admin'))):
    address=body.contact_email.strip().lower()
    with Session() as s:
        if s.scalar(select(User.id).where(User.email==address)):
            raise HTTPException(409,'Email already registered')
        partner=Partner(name=body.name.strip(),zone=body.zone.strip(),status='ACTIVE')
        s.add(partner);s.flush()
        account=User(full_name=body.contact_name.strip(),email=address,role='partner',
                     partner_id=partner.id,password_hash=hash_pass(secrets.token_urlsafe(40)),
                     membership_status='INVITED')
        s.add(account);s.flush()
        token=create_invitation(s,account)
        link=send_invite(account.email,account.full_name,token,'business partner')
        audit(s,u.id,'PARTNER_INVITED',f'{partner.id}:{address}')
        s.commit()
        return {**invite_response(account.id,link),'partner_id':partner.id}

@app.post('/api/admin/invitations/{user_id}/resend')
def resend_invitation(user_id:int,u=Depends(roles('admin'))):
    with Session() as s:
        account=s.get(User,user_id)
        if not account or account.membership_status!='INVITED' or account.role not in ('employee','client','partner'):
            raise HTTPException(404,'Pending invitation not found')
        token=create_invitation(s,account)
        link=send_invite(account.email,account.full_name,token,account.role)
        audit(s,u.id,'INVITATION_RESENT',account.email)
        s.commit()
        return invite_response(account.id,link)

@app.get('/api/admin/plans')
def plans(u=Depends(roles('admin'))):
    with Session() as s:return [{'id':p.id,'name':p.name,'credits':p.credits,'monthly_price':p.monthly_price,'currency':p.currency} for p in s.scalars(select(Plan).order_by(Plan.id)).all()]

@app.post('/api/admin/plans')
def create_plan(body:PlanBody,u=Depends(roles('admin'))):
    with Session() as s:
        if s.scalar(select(Plan.id).where(func.lower(Plan.name)==body.name.strip().lower())):
            raise HTTPException(409,'Plan already exists')
        if s.scalar(select(func.count(Plan.id)))>=3:
            raise HTTPException(409,'MVP supports a maximum of three credit plans')
        plan=Plan(name=body.name.strip(),credits=body.credits,monthly_price=body.monthly_price_cents)
        s.add(plan);s.flush()
        audit(s,u.id,'PLAN_CREATED',f'{plan.id}:{plan.name}')
        s.commit()
        return {'id':plan.id}

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
        e=User(email=body.email.strip().lower(),full_name=body.full_name.strip(),role='employee',password_hash=hash_pass(secrets.token_urlsafe(40)),company_id=body.company_id,plan_id=body.plan_id,membership_status='INVITED')
        s.add(e);s.flush()
        token=create_invitation(s,e)
        link=send_invite(e.email,e.full_name,token,'client')
        amount=body.initial_credits if body.initial_credits is not None else p.credits
        if amount: s.add(Ledger(user_id=e.id,kind='ALLOCATION',amount=amount,period=now().strftime('%Y-%m'),actor_id=u.id,reason='Pilot initial allocation'))
        audit(s,u.id,'EMPLOYEE_INVITED',e.email);s.commit();return invite_response(e.id,link)

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


# Authenticated in-app notification inbox; entries are written in existing business transactions.
@app.get('/api/notifications')
def my_notifications(u=Depends(get_user)):
    with Session() as s:
        rows=s.scalars(select(Notification).where(Notification.user_id==u.id).order_by(Notification.id.desc()).limit(50)).all()
        return [{'id':x.id,'kind':x.kind,'title':x.title,'message':x.message,
                 'created_at':iso(x.created_at),'read_at':iso(x.read_at)} for x in rows]

@app.post('/api/notifications/{notification_id}/read')
def read_notification(notification_id:int,u=Depends(get_user)):
    with Session() as s:
        item=s.get(Notification,notification_id)
        if not item or item.user_id!=u.id:raise HTTPException(404,'Notification not found')
        if item.read_at is None:item.read_at=now()
        s.commit()
        return {'id':item.id,'read_at':iso(item.read_at)}

# Eight-digit one-time attendance proof. The raw code never enters the DB or logs.
CHECKIN_CODE_DURATION = timedelta(minutes=10)

@app.post('/api/client/bookings/{booking_id}/checkin-code')
def issue_checkin_code(booking_id:int,u=Depends(roles('employee','client'))):
    with Session() as s:
        try:
            lock_transaction(s)
            b=s.scalar(select(Booking).where(Booking.id==booking_id).with_for_update())
            if not b or b.user_id!=u.id:raise HTTPException(404,'Booking not found')
            if b.status!='BOOKED':raise HTTPException(409,'Only active bookings can issue a code')
            slot=s.get(Slot,b.slot_id)
            if not slot or not (slot.start_at-timedelta(hours=2)<=now()<=slot.start_at+timedelta(hours=2)):
                raise HTTPException(409,'Check-in code available only two hours before or after the session starts')
            code=f'{secrets.randbelow(100000000):08d}'
            item=s.scalar(select(CheckinCode).where(CheckinCode.booking_id==b.id).with_for_update())
            if item is None:
                item=CheckinCode(booking_id=b.id,code_hash=checkin_digest(b.id,code),
                                 expires_at=now()+CHECKIN_CODE_DURATION,attempts=0)
                s.add(item)
            else:
                if item.used_at:raise HTTPException(409,'Booking check-in already completed')
                item.code_hash=checkin_digest(b.id,code)
                item.expires_at=now()+CHECKIN_CODE_DURATION
                item.attempts=0
            s.commit()
            return {'booking_id':b.id,'code':code,'expires_at':iso(item.expires_at)}
        except HTTPException:s.rollback();raise
        except Exception:s.rollback();raise

@app.post('/api/partner/bookings/{booking_id}/verify-checkin')
def verify_checkin_code(booking_id:int,body:CheckinVerificationBody,u=Depends(roles('partner','admin'))):
    with Session() as s:
        try:
            lock_transaction(s)
            booking=s.scalar(select(Booking).where(Booking.id==booking_id).with_for_update())
            if not booking:raise HTTPException(404,'Booking not found')
            if u.role=='partner' and booking.partner_id!=u.partner_id:raise HTTPException(403,'Not your business booking')
            if booking.status!='BOOKED':raise HTTPException(409,'Booking already processed')
            proof=s.scalar(select(CheckinCode).where(CheckinCode.booking_id==booking.id).with_for_update())
            if not proof or proof.used_at or proof.expires_at<=now() or proof.attempts>=5:
                raise HTTPException(409,'Code expired, unavailable, or locked. Client must request a fresh code.')
            if not hmac.compare_digest(proof.code_hash,checkin_digest(booking.id,body.code)):
                proof.attempts+=1
                s.commit() # wrong attempts must survive the rejected request
                raise HTTPException(403,'Invalid check-in code')
            proof.used_at=now()
            booking.status='CHECKED_IN';booking.checked_in_at=now();booking.checked_in_by=u.id
            notify_user(s,booking.user_id,'CHECK_IN','Visit confirmed',
                        f'Attendance confirmed for booking {booking.reference}.')
            audit(s,u.id,'CHECK_IN_CODE_VERIFIED',booking.reference)
            s.commit()
            return {'status':'CHECKED_IN','reference':booking.reference}
        except HTTPException:s.rollback();raise
        except Exception:s.rollback();raise

@app.post('/api/client/bookings/{booking_id}/review')
def review_booking(booking_id:int,body:ReviewBody,u=Depends(roles('employee','client'))):
    comment=body.comment.strip()  # Rating is required; written feedback is optional.
    with Session() as s:
        b=s.get(Booking,booking_id)
        if not b or b.user_id!=u.id:raise HTTPException(404,'Booking not found')
        if b.status!='CHECKED_IN':raise HTTPException(409,'Review is available only after confirmed attendance')
        if s.scalar(select(ServiceReview.id).where(ServiceReview.booking_id==booking_id)):
            raise HTTPException(409,'This booking has already been reviewed')
        review=ServiceReview(booking_id=b.id,user_id=u.id,service_id=b.service_id,
                             rating=body.rating,comment=comment)
        s.add(review);s.flush()
        audit(s,u.id,'SERVICE_REVIEW_CREATED',f'Booking {b.reference}')
        s.commit()
        return {'id':review.id,'rating':review.rating,'comment':review.comment}

@app.get('/api/services/{service_id}/reviews')
def service_reviews(service_id:int,u=Depends(get_user)):
    with Session() as s:
        if not s.get(Service,service_id):raise HTTPException(404,'Service not found')
        rows=s.scalars(select(ServiceReview).where(ServiceReview.service_id==service_id)
                       .order_by(ServiceReview.id.desc()).limit(50)).all()
        return {'count':s.scalar(select(func.count(ServiceReview.id)).where(ServiceReview.service_id==service_id)),
                'reviews':[{'id':x.id,'rating':x.rating,'comment':x.comment,'created_at':iso(x.created_at)} for x in rows]}

# Partner-only review reporting. Never accept a partner_id from the request:
# identity and ownership are derived from the authenticated account.
@app.get('/api/partner/reviews')
def partner_reviews(u=Depends(roles('partner'))):
    with Session() as s:
        summaries=s.execute(
            select(Service.id,Service.name,func.count(ServiceReview.id),func.avg(ServiceReview.rating))
            .outerjoin(ServiceReview,ServiceReview.service_id==Service.id)
            .where(Service.partner_id==u.partner_id)
            .group_by(Service.id,Service.name).order_by(Service.name)
        ).all()
        recent=s.execute(
            select(ServiceReview,Service.name)
            .join(Service,Service.id==ServiceReview.service_id)
            .where(Service.partner_id==u.partner_id)
            .order_by(ServiceReview.created_at.desc(),ServiceReview.id.desc()).limit(100)
        ).all()
        count=sum(total for _sid,_name,total,_avg in summaries)
        total_ratings=sum(total*(avg or 0) for _sid,_name,total,avg in summaries)
        return {'count':count, 'average_rating':round(total_ratings/count,2) if count else None,
                'has_more':count>len(recent),
                'services':[{'id':sid,'name':name,'count':total,
                             'average_rating':round(avg,2) if avg is not None else None}
                            for sid,name,total,avg in summaries],
                'reviews':[{'id':review.id,'service_id':review.service_id,'service':name,
                            'rating':review.rating,'comment':review.comment,
                            'created_at':iso(review.created_at)}
                           for review,name in recent]}

@app.get('/api/partner/reviews/export')
def export_partner_reviews(u=Depends(roles('partner'))):
    with Session() as s:
        rows=s.execute(
            select(ServiceReview,Service.name)
            .join(Service,Service.id==ServiceReview.service_id)
            .where(Service.partner_id==u.partner_id)
            .order_by(ServiceReview.id.desc())
        ).all()
        out=io.StringIO()
        writer=csv.writer(out)
        writer.writerow(['Service','Rating (1-5)','Optional feedback','Submitted at (UTC)'])
        for review,service_name in rows:
            # Prevent formula execution when opening a CSV in spreadsheet software.
            def safe_cell(value):
                value=str(value)
                return "'"+value if value.lstrip().startswith(('=','+','-','@')) else value
            writer.writerow([safe_cell(service_name),review.rating,safe_cell(review.comment),iso(review.created_at)])
        return Response(content=out.getvalue(),media_type='text/csv; charset=utf-8',
                        headers={'Content-Disposition':'attachment; filename="flexpass-business-feedback.csv"',
                                 'Cache-Control':'no-store'})

@app.post('/api/partner/slots/bulk')
def create_bulk_slots(body:BulkSlotsBody,u=Depends(roles('partner'))):
    first=body.start_at.replace(tzinfo=None)
    delta=timedelta(days=1 if body.frequency=='daily' else 7)
    starts=[first+i*delta for i in range(body.count)]
    if starts[0]<=now():raise HTTPException(422,'First class must be in the future')
    with Session() as s:
        try:
            lock_transaction(s)
            sv=s.scalar(select(Service).where(Service.id==body.service_id).with_for_update())
            if not sv or sv.partner_id!=u.partner_id:raise HTTPException(403,'Not your service')
            existing=set(s.scalars(select(Slot.start_at).where(Slot.service_id==sv.id,Slot.start_at.in_(starts))).all())
            created=0
            for start in starts:
                if start in existing:continue
                s.add(Slot(service_id=sv.id,start_at=start,capacity=body.capacity,reserved=0))
                created+=1
            audit(s,u.id,'BULK_SLOTS_CREATED',f'Service {sv.id}; created {created}; duplicates {body.count-created}')
            s.commit()
            return {'created':created,'skipped':body.count-created}
        except HTTPException:s.rollback();raise
        except Exception:s.rollback();raise

@app.get('/api/admin/analytics')
def admin_analytics(u=Depends(roles('admin'))):
    with Session() as s:
        bookings=s.scalars(select(Booking)).all()
        orders=s.scalars(select(ClientOrder)).all()
        services={x.id:x for x in s.scalars(select(Service)).all()}
        partners={x.id:x for x in s.scalars(select(Partner)).all()}
        labels=[]
        today=now()
        for offset in range(5,-1,-1):
            yr=today.year
            mo=today.month-offset
            while mo<=0:mo+=12;yr-=1
            labels.append(f'{yr}-{mo:02d}')
        monthly=[{'period':month,'bookings':sum(bool(b.created_at and b.created_at.strftime('%Y-%m')==month) for b in bookings),
                  'visits':sum(bool(b.checked_in_at and b.checked_in_at.strftime('%Y-%m')==month) for b in bookings),
                  'orders':sum(bool(o.created_at and o.created_at.strftime('%Y-%m')==month) for o in orders)}
                 for month in labels]
        by_group={}
        for b in bookings:
            sv=services.get(b.service_id)
            if sv:by_group[sv.group_name]=by_group.get(sv.group_name,0)+1
        by_partner={}
        for b in bookings:
            if b.status!='CHECKED_IN':continue
            partner=partners.get(b.partner_id)
            if partner:by_partner[partner.id]=by_partner.get(partner.id,0)+1
        top_partners=sorted([{'name':partners[pid].name,'visits':visits} for pid,visits in by_partner.items()],
                             key=lambda row:(-row['visits'],row['name']))[:5]
        return {'monthly':monthly,'categories':[{'name':name,'bookings':count} for name,count in sorted(by_group.items())],
                'partners':top_partners}

# Fictional pilot catalog. Disabled by default; enable only with explicit operator opt-in.
# Idempotent by deterministic DEMO business/product/service names and future slot dates.
SHOWCASE_BUSINESSES = (
    ('FlexPass Demo Studio [DEMO]', 'Blloku', (
        ('Reformer Pilates [DEMO]', 'fitness', 'Pilates', 5, 60),
        ('Morning Yoga Flow [DEMO]', 'fitness', 'Yoga', 4, 60),
        ('Stretch & Recover [DEMO]', 'wellness', 'Recovery', 3, 45),
    )),
    ('CityMotion Fitness [DEMO]', 'Komuna e Parisit', (
        ('Gym Day Pass [DEMO]', 'fitness', 'Gyms', 4, 90),
        ('Zumba Class [DEMO]', 'fitness', 'Zumba', 3, 50),
    )),
    ('BlueWave Sports [DEMO]', 'Liqeni i Thate', (
        ('Swimming Session [DEMO]', 'sport', 'Swimming', 5, 60),
        ('Tennis Coaching [DEMO]', 'sport', 'Tennis', 6, 60),
    )),
    ('Serenity Wellness [DEMO]', 'Pazari i Ri', (
        ('Relaxing Massage [DEMO]', 'wellness', 'Massage', 8, 60),
        ('Spa & Sauna [DEMO]', 'wellness', 'Spa', 7, 75),
    )),
    ('Glow Corner [DEMO]', 'Myslym Shyri', (
        ('Facial Treatment [DEMO]', 'glow', 'Facials', 6, 50),
        ('Express Beauty Session [DEMO]', 'glow', 'Beauty', 4, 40),
    )),
)

SHOWCASE_PRODUCTS = (
    ('Starter Credit Pack [DEMO]', 10, 150000),
    ('Everyday Credit Pack [DEMO]', 25, 320000),
    ('Flex Credit Pack [DEMO]', 50, 550000),
)

def seed_showcase_catalog(s):
    """Insert deterministic, explicitly fictional examples, without modifying existing records.
    The demo business login is invitation-only. No password or login token is exposed.
    """
    created = {'partners':0, 'services':0, 'slots':0, 'credit_products':0, 'invited_accounts':0}
    for name, zone, experiences in SHOWCASE_BUSINESSES:
        partner=s.scalar(select(Partner).where(Partner.name==name))
        if not partner:
            partner=Partner(name=name,zone=zone,status='ACTIVE')
            s.add(partner);s.flush()
            created['partners']+=1
        for title,group,subcategory,credits,duration in experiences:
            service=s.scalar(select(Service).where(Service.partner_id==partner.id,Service.name==title))
            if not service:
                service=Service(partner_id=partner.id,name=title,group_name=group,subcategory=subcategory,
                                description=f'Fictional {duration}-minute experience for testing FlexPass. Not a real offer.',
                                credits=credits,payout_cents=credits*10000,duration_minutes=duration,active=True)
                s.add(service);s.flush()
                created['services']+=1
            # Only add slots if none exist yet for that service. Never modify existing bookings.
            has_slot=s.scalar(select(Slot.id).where(Slot.service_id==service.id).limit(1))
            if not has_slot:
                for day in (2,3,5,7,10):
                    slot=Slot(service_id=service.id,start_at=(now()+timedelta(days=day)).replace(
                        hour=9+(service.id % 8),minute=0,second=0,microsecond=0),
                        capacity=8,reserved=0)
                    s.add(slot)
                    created['slots']+=1
        if name=='FlexPass Demo Studio [DEMO]':
            address='akaci@ccs.al'
            existing=s.scalar(select(User).where(User.email==address))
            if not existing:
                # Account is pending activation; never set a known/usable password.
                user=User(email=address,full_name='Demo Business Manager',
                          password_hash=hash_pass(secrets.token_urlsafe(48)),role='partner',
                          partner_id=partner.id,membership_status='INVITED')
                s.add(user);s.flush()
                created['invited_accounts']+=1
            # Existing email accounts are deliberately never re-assigned or modified.
    for name,credits,cents in SHOWCASE_PRODUCTS:
        if not s.scalar(select(CreditProduct.id).where(CreditProduct.name==name)):
            s.add(CreditProduct(name=name,credits=credits,price_cents=cents,
                                currency='ALL',active=True))
            created['credit_products']+=1
    audit(s,None,'SHOWCASE_CATALOG_SEEDED',str(created))
    return created

def bootstrap_temporary_test_logins(s, client_password=None, business_password=None):
    """One-time, operator-approved test account setup. No credentials in repository/logs."""
    # Requires the independently enabled, explicitly fictional showcase catalog.
    if os.environ.get('FLEXPASS_SEED_SHOWCASE_CATALOG','').lower() not in ('true','1','yes'):
        raise RuntimeError('Test account bootstrap requires the showcase catalog enabled')
    client_password=client_password if client_password is not None else os.environ.get('FLEXPASS_TEMP_CLIENT_PASSWORD','')
    business_password=business_password if business_password is not None else os.environ.get('FLEXPASS_TEMP_BUSINESS_PASSWORD','')
    if len(client_password)<20 or len(business_password)<20 or client_password==business_password:
        raise RuntimeError('Provide two different temporary account passwords of at least 20 characters')
    if client_password in ('Demo123!', business_password):
        raise RuntimeError('Do not reuse demonstration passwords')
    result={'created_client':0,'activated_business':0,'client_existing':0,'business_existing':0}
    email='demo.client@flexpass.test'
    client=s.scalar(select(User).where(User.email==email))
    if client is None:
        client=User(email=email,full_name='FlexPass Test Client [DEMO]',role='client',
                    membership_status='ACTIVE',company_id=None,plan_id=None,
                    password_hash=hash_pass(client_password))
        s.add(client);s.flush()
        result['created_client']=1
    elif client.role!='client' or client.membership_status!='ACTIVE' or client.company_id is not None:
        # No password reset or activation of accounts this operation did not create.
        raise RuntimeError('Demo client identifier already belongs to an unexpected account')
    else:
        result['client_existing']=1
    # Seed enough fictional credits for booking the [DEMO] inventory without a bank payment.
    allocation=s.scalar(select(Ledger.id).where(
        Ledger.user_id==client.id, Ledger.source=='DEMO_BOOTSTRAP').limit(1))
    if allocation is None:
        s.add(Ledger(user_id=client.id,kind='ALLOCATION',amount=25,source='DEMO_BOOTSTRAP',
                     period=now().strftime('%Y-%m'),reason='Fictional test credits — no payment made'))
    account=s.scalar(select(User).where(User.email=='akaci@ccs.al'))
    partner=s.scalar(select(Partner).where(Partner.name=='FlexPass Demo Studio [DEMO]'))
    if not partner or not account or account.role!='partner' or account.partner_id!=partner.id:
        raise RuntimeError('Demo business account is missing or does not match demo studio')
    if account.membership_status=='INVITED':
        account.password_hash=hash_pass(business_password)
        account.membership_status='ACTIVE'
        for pending in s.scalars(select(AccountInvitation).where(
            AccountInvitation.user_id==account.id,AccountInvitation.used_at.is_(None))).all():
            pending.used_at=now()
        result['activated_business']=1
    elif account.membership_status=='ACTIVE':
        # Prevent later deployments from silently resetting a password.
        result['business_existing']=1
    else:
        raise RuntimeError('Demo business is in an unexpected state')
    audit(s,None,'TEMP_TEST_ACCOUNTS_BOOTSTRAPPED',
          f"client={result['created_client']},business={result['activated_business']}")
    return result

@app.post('/api/admin/demo/accounts/setup')
def admin_setup_demo_accounts(body:DemoAccountsSetupBody,u=Depends(roles('admin'))):
    """Admin-only setup for two explicitly named test accounts, no email dependency."""
    if os.environ.get('FLEXPASS_SEED_SHOWCASE_CATALOG','').lower() not in ('true','1','yes'):
        raise HTTPException(403,'Demo catalog is not enabled')
    if body.client_password == body.business_password or 'Demo123!' in (body.client_password,body.business_password):
        raise HTTPException(422,'Choose two different strong passwords')
    with Session() as s:
        try:
            lock_transaction(s)
            changes=bootstrap_temporary_test_logins(s,body.client_password,body.business_password)
            audit(s,u.id,'ADMIN_DEMO_ACCOUNTS_SETUP',
                  f"client={changes['created_client']},business={changes['activated_business']}")
            s.commit()
            return {'client_email':'demo.client@flexpass.test',
                    'business_email':'akaci@ccs.al',**changes}
        except RuntimeError as exc:
            s.rollback()
            # Avoid exposing account details or secrets in errors.
            raise HTTPException(409,'Demo accounts could not be created; check existing account assignments') from exc
        except Exception:
            s.rollback()
            raise

def seed():
    Base.metadata.create_all(engine)
    with Session() as s:
        # Explicitly requested pilot fixtures. Run once per startup, safe to rerun.
        # Production does not enable the demo payment simulation.
        if os.environ.get('FLEXPASS_SEED_SHOWCASE_CATALOG', 'false').lower() in ('true','1','yes'):
            changes=seed_showcase_catalog(s)
            s.commit()
            print('FLEXPASS_SHOWCASE_SEED '+str(changes),flush=True)
        if os.environ.get('FLEXPASS_BOOTSTRAP_TEMP_TEST_LOGINS','false').lower() in ('true','1','yes'):
            changes=bootstrap_temporary_test_logins(s)
            s.commit()
            print('FLEXPASS_TEST_LOGINS_SETUP '+str(changes),flush=True)
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
        products=[CreditProduct(name='Trial Pack',credits=10,price_cents=150000),
                  CreditProduct(name='Everyday Pack',credits=25,price_cents=320000),
                  CreditProduct(name='Flex Pack',credits=50,price_cents=550000)]
        s.add_all(products)
        users=[User(email='admin@flexpass.demo',full_name='FlexPass Admin',password_hash=hash_pass(demo_passwords['admin']),role='admin'),User(email='employee@flexpass.demo',full_name='Alex Demo',password_hash=hash_pass(demo_passwords['employee']),role='employee',company_id=c1.id,plan_id=p2.id),User(email='partner@flexpass.demo',full_name='Studio Manager',password_hash=hash_pass(demo_passwords['partner']),role='partner',partner_id=partners[0].id)]
        s.add_all(users);s.flush()
        s.add(Ledger(user_id=users[1].id,kind='ALLOCATION',amount=30,period=now().strftime('%Y-%m'),actor_id=users[0].id,reason='Pilot monthly allowance'))
        s.add(Invoice(company_id=c1.id,period=now().strftime('%Y-%m'),reference='DEMO-INV-001',amount_cents=0,status='DRAFT'))
        s.commit()

from .booking_features import install_routes
install_routes()
seed()
DIST = ROOT / 'frontend' / 'dist'

class CachedStaticFiles(StaticFiles):
    """Cache public files only. Versioned Vite assets are immutable; API responses aren't."""
    def __init__(self, *args, cache_control: str, **kwargs):
        self.cache_control = cache_control
        super().__init__(*args, **kwargs)

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code in (200, 304):
            response.headers['Cache-Control'] = self.cache_control
        return response

if DIST.is_dir():
    # Vite emits content-hashed asset URLs, so caching them for a year is safe.
    app.mount('/assets', CachedStaticFiles(
        directory=DIST / 'assets',
        cache_control='public, max-age=31536000, immutable',
    ), name='assets')
    # Non-versioned brand URLs get a short cache to keep asset updates visible.
    if (DIST / 'brand').is_dir():
        app.mount('/brand', CachedStaticFiles(
            directory=DIST / 'brand',
            cache_control='public, max-age=3600',
        ), name='brand')

@app.get('/')
@app.get('/services')
@app.get('/login')
@app.get('/login/client')
@app.get('/login/business')
@app.get('/register')
@app.get('/register/client')
@app.get('/admin/login')
@app.get('/contact')
@app.get('/privacy')
@app.get('/terms')
@app.get('/client')
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

# Serve dashboard deep links on a full-page refresh, not only after client-side navigation.
# Keep the supported sections explicit so unrelated paths still correctly return 404.
DASHBOARD_SECTIONS = {
    'client': {'overview', 'shop', 'discover', 'orders', 'bookings', 'wallet', 'notifications', 'profile'},
    'employee': {'overview', 'shop', 'discover', 'orders', 'bookings', 'wallet', 'notifications'},  # legacy alias
    'partner': {'overview', 'calendar', 'reservations', 'services', 'settlements', 'feedback', 'notifications'},
    'admin': {'overview', 'clients', 'partners', 'products', 'orders', 'bookings', 'settlements', 'audit', 'analytics', 'notifications'},
}

@app.get('/client/{section}')
@app.get('/employee/{section}')
@app.get('/partner/{section}')
@app.get('/admin/{section}')
def dashboard_deep_link(section: str, request: Request):
    role = request.url.path.split('/')[1]
    if section not in DASHBOARD_SECTIONS[role]:
        raise HTTPException(status_code=404, detail='Unknown dashboard section')
    return index()


