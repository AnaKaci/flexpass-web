import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const profile=readFileSync(new URL('../src/ClientProfile.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/client-profile.css',import.meta.url),'utf8');
const backend=readFileSync(new URL('../../backend/app.py',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

test('Client can load and edit personal details after initial registration',()=>{
  assert.ok(profile.includes("request<ClientProfileDetails>('/client/profile',token)"));
  assert.ok(profile.includes("request<ClientProfileDetails>('/client/profile',token,{"));
  assert.ok(profile.includes("method:'PATCH'"));
  assert.ok(profile.includes("await refreshUser()"));
  for(const name of ['full_name','birthday','phone','city','country','about']){
    assert.ok(profile.includes("editField('"+name+"'"),name);
  }
  assert.ok(profile.includes("setEditing(true)"));
  assert.ok(profile.includes("setEditing(false)"));
  assert.ok(profile.includes("type=\"email\" value={currentEmail} disabled"));
  assert.ok(app.includes("setUser(await request<User>('/auth/me',token))"));
  assert.ok(backend.includes("class ClientProfileDetails(Base):"));
  assert.ok(backend.includes("details=s.get(ClientProfileDetails,u.id)"));
  assert.ok(backend.includes("@app.patch('/api/client/profile')"));
});

test('Client can upload, replace and remove a validated profile picture',()=>{
  assert.ok(profile.includes('accept="image/jpeg,image/png,image/webp"'));
  assert.ok(profile.includes('createImageBitmap(file)'));
  assert.ok(profile.includes("canvas.toDataURL('image/jpeg',.78)"));
  assert.ok(profile.includes("request<{avatar_data:string}>('/client/profile/avatar',token,{"));
  assert.ok(profile.includes("method:'PUT'"));
  assert.ok(profile.includes("method:'DELETE'"));
  assert.ok(profile.includes('profile?.avatar_data?<img src={profile.avatar_data}'));
  assert.ok(profile.includes("setProfile(old=>old?{...old,avatar_data:null}:old)"));
  assert.ok(backend.includes("ImageOps.exif_transpose(picture)"));
  assert.ok(backend.includes("picture.thumbnail((320,320))"));
  assert.ok(backend.includes("picture.convert('RGB').save("));
  assert.ok(backend.includes("base64.b64decode(parts[1],validate=True)"));
});

test('Payment Methods does not accept or persist credit card PAN or CVV',()=>{
  assert.ok(profile.includes('No credit or debit card linked'));
  assert.ok(profile.includes('Card payments and securely saved cards require a payment-provider integration'));
  assert.ok(profile.includes('card numbers and CVVs are never collected or stored'));
  assert.ok(!profile.includes('card_number'));
  assert.ok(!profile.includes('expiry_month'));
  assert.ok(!profile.includes('cvv'));
  assert.ok(!backend.includes('class StoredCard(Base):'));
  assert.ok(profile.includes("onSection('orders')"));
});

test('New UI fits existing profile and uses on-brand responsive layout',()=>{
  assert.ok(styles.includes('.client-profile-photo{'));
  assert.ok(styles.includes('.client-profile-edit-form{'));
  assert.ok(styles.includes('.client-profile-payment-content{'));
  assert.ok(styles.includes('@media(max-width:500px)'));
  for(const variable of ['--teal','--ivory','--burgundy','--blush']){
    assert.ok(styles.includes('var('+variable+')'),variable);
  }
  assert.ok(!styles.includes('.home-page'));
});
