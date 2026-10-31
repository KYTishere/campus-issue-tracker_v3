// Campus Issue Tracker — application logic
// Edit Supabase settings and demo defaults in the clearly marked configuration section below.
/* ============================================================
   BEGINNER-FRIENDLY GUIDE FOR THIS FILE
   ============================================================
   This file is the main brain of the Campus Issue Tracker app.

   In simple words:
   - It connects the page to Supabase (the online database).
   - It stores issue information such as location, category, status and photo.
   - It handles login for demo roles like admin, staff and principal.
   - It draws different screens like "Report issue", "Public board", "Dashboard" and "Manage".
   - It listens for button clicks and form input so users can submit issues.

   WHO IS THIS FOR?
   This file is written for both new developers and people who are learning JavaScript.
   If you are coming from another language, think of this file as a set of tools:
   - constants hold configuration values,
   - functions do jobs,
   - objects store data,
   - DOM code updates what users see on the page,
   - events react to clicks and typing.

   SECTION 1: APPLICATION SETUP
   The first part sets up the database connection and default lists such as locations and categories.
   These are like the app's starting information before anyone reports an issue.

   SECTION 2: STORAGE AND DATA MODELS
   The app uses localStorage as a browser cache and Supabase as the shared source of truth.
   This makes the demo simple while still allowing remote syncing.

   SECTION 3: USER AUTHENTICATION
   Demo roles are stored in browser storage. This is convenient for testing, but not safe for a real production system.

   SECTION 4: DATA SYNC FROM SUPABASE
   When the app loads, it pulls rows from Supabase and updates local data only when something changed.

   SECTION 5: ISSUE REPORTING FLOW
   When a user fills the form, the app validates the form, compresses the photo, saves the issue and uploads it.

   SECTION 6: UI RENDERING
   The app builds HTML for each view using JavaScript and then injects it into the page.

   SECTION 7: EVENT HANDLERS
   Buttons and form controls trigger functions that respond to user actions.

   NOTE:
   This file is intentionally a full app file, so it contains both the business logic and the page behavior.
   If you are learning, read it section by section instead of trying to understand all 900+ lines at once.

   HOW THIS FILE CONNECTS TO OTHER FILES
   ------------------------------------------------------------
   index.html is the entry point for the app.
   - It loads the CSS file: style.css
   - It loads the JavaScript file: app.js
   - It creates a main container: <main id="app"></main>

   The app.js file then fills that main container dynamically.
   For example, render() does this:
   $('#app').innerHTML = views[S.view]();

   That line means:
   - find the element with id="app"
   - replace its inner HTML with the correct screen
   - the screen comes from functions like viewReport(), viewPublic(), viewDash(), etc.

   The CSS file does not control logic, but it controls appearance.
   It styles classes such as .card, .btn, .stat, .badge, .toast, etc.
   Those class names are used in strings returned by the view functions.

   In short:
   - index.html = page shell + scripts
   - style.css = design and layout
   - app.js = behavior, data, navigation, events, and screen rendering

   If you want to change a screen, edit the matching view function.
   If you want to change the look, edit style.css.
   If you want to change data behavior, edit the storage or Supabase sections in app.js.
   ============================================================ */
/* ============================================================
   SUPABASE CONNECTION
   Paste your Supabase publishable/anon key below.
   NEVER put a service_role/secret key in this file.
   ============================================================ */
const SUPABASE_URL = 'https://chymlukrksqzrxryxpjc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_DdxGvAaMbn03DDh2J5uqQQ_aK4tzpDJ';
const SUPABASE_ENABLED = Boolean(
  window.supabase &&
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_PUBLISHABLE_KEY.includes('PASTE_YOUR_')
);
const sb = SUPABASE_ENABLED
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;


/* ============================================================
   DATA LAYER
   The shared source is Supabase. localStorage is only a temporary
   UI cache/fallback; issue rows are synchronized from Supabase.
   ============================================================ */
const STATUSES = ['Reported','In Progress','Resolved','Rejected'];
const K = {issues:'cit_issues_v2', locs:'cit_locs_v2', cats:'cit_cats_v2', base:'cit_base_v2'};
const DEF = {
  cats: [
    {id:'electrical',name:'Electrical'},{id:'furniture',name:'Furniture'},{id:'water',name:'Water'},
    {id:'cleanliness',name:'Cleanliness'},{id:'equipment',name:'Equipment'},{id:'safety',name:'Safety'},{id:'other',name:'Other'}
  ],
  locs: [
    {id:'blockA-room204',name:'Block A, Room 204'},{id:'blockA-room205',name:'Block A, Room 205'},
    {id:'blockA-corridor',name:'Block A, Ground floor corridor'},{id:'blockB-lab1',name:'Block B, Computer Lab 1'},
    {id:'blockB-washroom',name:'Block B, 1st floor washroom'},{id:'library',name:'Library, Reading hall'},
    {id:'canteen',name:'Canteen'},{id:'parking',name:'Main parking'}
  ]
};
/* Supabase Auth is the identity provider. Roles and permissions are loaded from the database. */
const DEFAULT_ROLES = {};
let ROLES = {};
let LOGIN_ROLES_ERROR = '';
const ROLE_PERMISSIONS = [
  ['dashboard','View dashboard'], ['status','Update issue status and add notes'],
  ['manage','Manage locations, categories and roles'], ['review','Review flagged content'],
  ['qrs','Create and print QR codes'], ['account','Open account settings']
];
function roleCan(role, permission){ return Boolean(ROLES[role]?.permissions?.includes(permission)); }
const S_AUTH = { email: '', loading: false };
async function loadLoginRoles(){
  if(!sb) return;
  const {data,error}=await sb.from('cit_roles').select('role_key,display_name').order('display_name');
  if(error){
    console.error('Could not load staff roles from Supabase:',error);
    LOGIN_ROLES_ERROR = error.code === 'PGRST205'
      ? "Supabase can't find public.cit_roles through its API. Confirm the app is connected to the same project as your dashboard. If it is, run NOTIFY pgrst, 'reload schema'; in the Supabase SQL Editor, then refresh this page."
      : `Could not load staff roles: ${error.message}`;
    ROLES={};
    return;
  }
  ROLES={};
  (data||[]).forEach(r=>{ROLES[r.role_key]={label:r.display_name,permissions:[]};});
  LOGIN_ROLES_ERROR = Object.keys(ROLES).length ? '' : 'No staff roles were found. Run docs/AUTH_SETUP.sql in the connected Supabase project, then refresh this page.';
}
async function loadSignedInRole(){
  if (!sb) { S.role=null; S_AUTH.email=''; ROLES={}; return false; }
  const {data:{user}, error:userError} = await sb.auth.getUser();
  if (userError || !user) { S.role=null; S_AUTH.email=''; return false; }
  S_AUTH.email=user.email || '';
  const {data, error} = await sb.from('cit_user_roles')
    .select('cit_roles(role_key,display_name,cit_role_permissions(permission_key))')
    .eq('user_id', user.id).maybeSingle();
  if (error || !data?.cit_roles) { S.role=null; return false; }
  const role=data.cit_roles;
  ROLES[role.role_key]={label:role.display_name, permissions:(role.cit_role_permissions||[]).map(x=>x.permission_key)};
  S.role=role.role_key;
  return true;
}
async function signOut(){
  if (sb) await sb.auth.signOut();
  S.role=null; S_AUTH.email=''; go('report'); toast('Logged out');
}
const FIELD = {locs:'loc', cats:'cat'};
const here = location.href.split(/[?#]/)[0];

const store = {
  read(k, def){
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v == null ? JSON.parse(JSON.stringify(def)) : v;
    } catch(e) {
      return JSON.parse(JSON.stringify(def));
    }
  },
  write(k, v){
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch(e) { return false; }
  }
};

/*
  LOCAL CACHE:
  The UI stays simple and synchronous. Supabase is the shared source,
  while localStorage is only a temporary cache/fallback for this demo.
*/
/* ============================================================
   SECTION: LOCAL DATA STORAGE
   ============================================================
   This object acts like a small database layer for the browser.
   It reads and writes entries into localStorage, which is similar to a
   temporary file saved inside the user's browser.

   Why do this?
   - It keeps the app fast.
   - It lets the app work even before a network sync happens.
   - It gives demo users a simple offline-friendly experience.

   Notice the keyword "this" inside each method. That means the methods are
   attached to the db object and can use its other functions.
   ============================================================ */
const db = {
  issues(){ return store.read(K.issues, []); },
  saveIssues(l){ return store.write(K.issues, l); },
  list(kind){ return store.read(K[kind], DEF[kind]); },
  saveList(kind,l){ return store.write(K[kind],l); },
  base(){ return store.read(K.base, here); },
  saveBase(b){ return store.write(K.base,b); },
  add(issue){ const l=this.issues(); l.unshift(issue); return this.saveIssues(l); },
  get(id){ return this.issues().find(i=>i.id===id); },
  update(id,fn){ const l=this.issues(); const i=l.find(x=>x.id===id); if(!i)return false; fn(i); return this.saveIssues(l); },
  remove(id){ return this.saveIssues(this.issues().filter(i=>i.id!==id)); },
  nextId(){
    // UUID-backed IDs avoid collisions between different browsers/users.
    // The database must still enforce UNIQUE(issue_id) as the final safeguard.
    const token = (window.crypto && typeof window.crypto.randomUUID === 'function')
      ? window.crypto.randomUUID().split('-')[0].toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();
    return 'CAMP-' + new Date().getFullYear() + '-' + token;
  }
};

/* Convert the browser issue object to the Supabase row. */
function issueToRow(i){
  return {
    issue_id: i.id,
    location: locName(i.loc),
    category: catName(i.cat),
    description: i.desc || null,
    photo_url: i.photo_url || i.photo || null,
    latitude: i.coords ? i.coords.latitude : null,
    longitude: i.coords ? i.coords.longitude : null,
    status: i.status,
    public: i.public !== false,
    history: i.history || [],
    created_at: i.created,
    updated_at: new Date().toISOString()
  };
}

/* Convert a Supabase row back into the shape used by the existing UI. */
function rowToIssue(r){
  const locs=db.list('locs');
  const cats=db.list('cats');
  let loc=locs.find(x=>x.name===r.location);
  if(!loc){
    loc={id:slug(r.location,locs),name:r.location};
    locs.push(loc); db.saveList('locs',locs);
  }
  let cat=cats.find(x=>x.name===r.category);
  if(!cat){
    cat={id:slug(r.category,cats),name:r.category};
    cats.push(cat); db.saveList('cats',cats);
  }
  return {
    id:r.issue_id,
    loc:loc.id,
    cat:cat.id,
    desc:r.description || '',
    photo:null,
    photo_url:r.photo_url || null,
    coords:(r.latitude!=null && r.longitude!=null)
      ? {latitude:Number(r.latitude),longitude:Number(r.longitude)} : null,
    status:r.status || 'Reported',
    created:r.created_at,
    public:r.public !== false,
    history:Array.isArray(r.history) && r.history.length
      ? r.history : [{status:r.status||'Reported',note:'Report submitted',at:r.created_at}]
  };
}

/* ============================================================
   SECTION: SUPABASE SYNC LOGIC
   ============================================================
   This part keeps the browser data in sync with the shared online database.
   Instead of reloading everything every second, it compares a "signature"
   of the remote data. If nothing changed, the app avoids a full rerender.

   The app also delays rendering while the user is typing, so a live update
   does not accidentally erase text they are currently editing.
   ============================================================ */
let lastRemoteSignature = null;
let pendingRemoteRender = false;
let hasCompletedFirstSync = false;

function isUserEditing(){
  const active = document.activeElement;
  return !!active && (active.matches('input, textarea, select') || active.isContentEditable);
}

function preserveIssuePhotos(current, next){
  if(!current) return;
  const currentPhotos = new Map(
    [...current.querySelectorAll('img[data-photo-issue]')]
      .map(image => [image.dataset.photoIssue, image])
  );
  next.querySelectorAll('img[data-photo-issue]').forEach(image=>{
    const existing = currentPhotos.get(image.dataset.photoIssue);
    if(existing && existing.getAttribute('src') === image.getAttribute('src')){
      image.replaceWith(existing);
    }
  });
}

function refreshIssueView(){
  if(S.view === 'public'){
    refreshPublic();
  }else if(['dash','detail','manage'].includes(S.view)){
    render();
  }
}

function updateIssuePhotoElements(issues){
  const photos = new Map(issues.map(issue=>[issue.id, issue.photo]));
  document.querySelectorAll('img[data-photo-issue]').forEach(image=>{
    const photo = photos.get(image.dataset.photoIssue);
    if(photo && image.getAttribute('src') !== photo) image.src = photo;
  });
}

/*
  Pull shared rows without rebuilding the page on every poll.
  A full render only happens when remote data actually changes, and is
  postponed while a user is typing so unsaved text is not destroyed.
*/
async function refreshSignedPhotoUrls(){
  if(!SUPABASE_ENABLED) return;
  const issues = db.issues();
  let changed = false;
  for(const issue of issues){
    if(!issue.photo_url) continue;
    const freshUrl = await signedPhotoUrl(issue.photo_url);
    if(freshUrl && freshUrl !== issue.photo){ issue.photo = freshUrl; changed = true; }
  }
  if(changed){
    db.saveIssues(issues);
    updateIssuePhotoElements(issues);
  }
}

async function syncFromSupabase(){
  if(!SUPABASE_ENABLED) return;
  try{
    const {data,error}=await sb.from('issues').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    const rows=data||[];
    updatePublicStamp();
    const signature=JSON.stringify(rows);
    const changed=signature !== lastRemoteSignature;
    if(!changed){
      if(pendingRemoteRender && !isUserEditing()){
        pendingRemoteRender=false;
        refreshIssueView();
      }
      return;
    }
    lastRemoteSignature=signature;
    const cachedIssues = new Map(db.issues().map(issue=>[issue.id, issue]));
    const issues=rows.map(row=>{
      const issue=rowToIssue(row);
      const cached=cachedIssues.get(issue.id);
      if(cached && cached.photo_url === issue.photo_url) issue.photo=cached.photo;
      return issue;
    });
    await Promise.all(issues.filter(issue=>issue.photo_url && !issue.photo).map(async issue=>{
      issue.photo=await signedPhotoUrl(issue.photo_url);
    }));
    db.saveIssues(issues);
    hasCompletedFirstSync=true;
    await refreshFeedback();
    if(isUserEditing()){
      pendingRemoteRender=true;
      return;
    }
    pendingRemoteRender=false;
    refreshIssueView();
  }catch(e){
    console.error('Supabase sync failed:',e);
    toast('Supabase sync failed. Check table/policies/key.');
  }
}

/* ============================================================
   PRIVATE STORAGE HELPERS
   issue-photos is PRIVATE, so we store the storage PATH and
   generate a temporary signed URL whenever an image is displayed.
   ============================================================ */
function storagePathFromPhotoUrl(value){
  if(!value) return null;
  try{
    const raw=String(value).trim();

    // Already a storage path, e.g. CAMP-2026-1001-123.jpg
    if(!/^https?:\/\//i.test(raw)){
      return raw.replace(/^\/+/, '').replace(/^issue-photos\//,'');
    }

    const u=new URL(raw);
    const marker='/storage/v1/object/';
    const idx=u.pathname.indexOf(marker);
    if(idx===-1) return null;

    let p=u.pathname.slice(idx + marker.length);
    // Handles public/authenticated/signed object URL forms.
    p=p.replace(/^public\/issue-photos\//,'');
    p=p.replace(/^authenticated\/issue-photos\//,'');
    p=p.replace(/^sign\/issue-photos\//,'');
    p=p.replace(/^issue-photos\//,'');
    return decodeURIComponent(p);
  }catch(e){
    console.warn('Could not determine Storage path:',value,e);
    return null;
  }
}

async function signedPhotoUrl(photoValue){
  if(!SUPABASE_ENABLED || !photoValue) return null;
  const path=storagePathFromPhotoUrl(photoValue);
  if(!path) return null;

  const {data,error}=await sb.storage
    .from('issue-photos')
    .createSignedUrl(path,3600);

  if(error){
    console.error('Signed photo URL failed:',error);
    return null;
  }
  return data?.signedUrl || null;
}

/* Upload a compressed image to the PRIVATE issue-photos bucket.
   Return the Storage path, not a public URL. */
async function uploadPhotoToSupabase(dataUrl, issueId){
  if(!SUPABASE_ENABLED || !dataUrl) return null;
  try{
    const res=await fetch(dataUrl);
    const blob=await res.blob();
    const path=`${issueId}-${Date.now()}.jpg`;

    const {error}=await sb.storage.from('issue-photos').upload(path,blob,{
      contentType:'image/jpeg',
      upsert:false
    });
    if(error) throw error;

    return path;
  }catch(e){
    console.error('Photo upload failed:',e);
    toast('Photo upload failed. Check Storage upload policy.');
    return null;
  }
}

/* Push one issue to Supabase. */
async function pushIssue(issue){
  if(!SUPABASE_ENABLED) return {ok:true,localOnly:true};
  try{
    const row=issueToRow(issue);
    const {error}=await sb.from('issues').insert(row);
    if(error) throw error;
    return {ok:true};
  }catch(e){
    console.error('Issue upload failed:',e);
    return {ok:false,error:e};
  }
}

/* Update only the requested issue fields and confirm that Supabase accepted them. */
async function pushIssueUpdate(issueId, updates){
  if(!SUPABASE_ENABLED) {
    return {ok:false,error:new Error('Supabase is not configured; this change cannot be shared.')};
  }
  try{
    if (Object.prototype.hasOwnProperty.call(updates,'status') ||
        Object.prototype.hasOwnProperty.call(updates,'history')) {
      const current=db.get(issueId);
      if(!current) throw new Error('Issue was not found in the local issue list.');
      const {data,error}=await sb.rpc('cit_update_issue_status',{
        p_issue_id:issueId,
        p_status:Object.prototype.hasOwnProperty.call(updates,'status') ? updates.status : current.status,
        p_history:Object.prototype.hasOwnProperty.call(updates,'history') ? updates.history : current.history
      });
      if(error) throw error;
      if(data !== true) throw new Error('Supabase did not confirm the status update. Check the issue ID and staff role.');
    }
    if (Object.prototype.hasOwnProperty.call(updates,'public')) {
      const {data,error}=await sb.rpc('cit_set_issue_public',{
        p_issue_id:issueId,
        p_public:updates.public
      });
      if(error) throw error;
      if(data !== true) throw new Error('Supabase did not confirm the visibility update. Check the issue ID and admin role.');
    }
    return {ok:true};
  }catch(e){
    console.error('Issue update failed:',e);
    return {ok:false,error:e};
  }
}

function restoreIssue(issue){
  db.update(issue.id, current=>Object.assign(current,issue));
}

function issueUpdateError(error){
  return 'Supabase did not save this change: ' + (error?.message || 'Check the issues table permissions.');
}

/* ============================================================
   HELPERS + STATE
   ============================================================ */
const $ = s => document.querySelector(s);
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const locName = id => (db.list('locs').find(l => l.id === id) || {name: id}).name;
const catName = id => (db.list('cats').find(c => c.id === id) || {name: id}).name;
const stClass = s => 'st-' + s.replace(' ', '-');
const when = iso => new Date(iso).toLocaleString([], {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
function ago(iso){
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60); if (h < 48) return h + ' h ago';
  return Math.round(h / 24) + ' days ago';
}
function dur(ms){
  if (ms == null) return 'No data';
  const h = ms / 3600e3; if (h < 1) return 'Under 1 hour'; if (h < 48) return Math.round(h) + ' hours';
  return (h / 24).toFixed(1) + ' days';
}
function slug(name, list){
  const b = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'item';
  let id = b, n = 2; while (list.some(x => x.id === id)) id = b + '-' + n++; return id;
}
function toast(msg){
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role','status');
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
}
function stats(list){
  const res = list.filter(i => i.status === 'Resolved');
  const times = res.map(i => { const h = i.history.find(x => x.status === 'Resolved'); return h ? new Date(h.at) - new Date(i.created) : null; })
                   .filter(x => x != null && x >= 0);
  return {
    total: list.length,
    reported: list.filter(i => i.status === 'Reported').length,
    progress: list.filter(i => i.status === 'In Progress').length,
    open: list.filter(i => i.status === 'Reported' || i.status === 'In Progress').length,
    resolved: res.length,
    avg: times.length ? times.reduce((a,b) => a + b, 0) / times.length : null
  };
}
function countBy(list, field, nameFn){
  const m = {}; list.forEach(i => m[i[field]] = (m[i[field]] || 0) + 1);
  return Object.entries(m).map(([k,v]) => [nameFn(k), v]).sort((a,b) => b[1] - a[1]).slice(0,5);
}
function bars(arr){
  if (!arr.length) return '<div class="hint">No data yet.</div>';
  const max = arr[0][1];
  return arr.map(([l,v]) => `<div class="brow"><span>${esc(l)}</span><div class="track"><div class="fill" style="width:${Math.round(v/max*100)}%"></div></div><b>${v}</b></div>`).join('');
}

const params = new URLSearchParams(location.search);
const qrLoc = db.list('locs').some(l => l.id === params.get('loc')) ? params.get('loc') : null;
const S = { view: params.get('view') === 'public' ? 'public' : 'report', role: null, selected: null,
            loc: qrLoc, photo: null, photoName: '', lastId: null, fStatus: 'All', fCat: 'All', pf: 'All', pq: '' };
const can = {
  status: () => roleCan(S.role, 'status'),
  manage: () => roleCan(S.role, 'manage'),
  review: () => roleCan(S.role, 'review'),
  qrs: () => roleCan(S.role, 'qrs'),
  dashboard: () => roleCan(S.role, 'dashboard'),
  account: () => roleCan(S.role, 'account')
};
function go(view){ S.view = view; render(); window.scrollTo(0,0); }

/* ============================================================
   SECTION: NAVIGATION AND VIEW SWITCHING
   ============================================================
   The app does not load separate HTML pages for each screen.
   Instead, it keeps one page and changes the content dynamically.

   This is a common pattern in JavaScript apps: create a view function,
   return HTML strings, and then insert them into the page using innerHTML.
   That makes the app feel like a multi-page website while staying simple.
   ============================================================ */
const THEME_KEY = 'cit_theme_v1';
const FEEDBACK = {
  voteCounts: {},
  myVotes: new Set(),
  pendingPhotoIssues: new Set(),
  pendingReportIssues: new Set(),
  flags: [],
  userId: null,
  loading: true,
  error: ''
};
let feedbackRequest = null;
let anonymousSessionRequest = null;
function feedbackErrorText(error){
  const parts = [error?.message || String(error || 'Unknown Supabase error')];
  if (error?.code) parts.push(`code ${error.code}`);
  if (error?.details) parts.push(error.details);
  if (error?.hint) parts.push(`Hint: ${error.hint}`);
  return parts.join(' — ');
}
function voteCount(issueId){ return FEEDBACK.voteCounts[issueId] || 0; }
function hasVoted(issueId){ return FEEDBACK.myVotes.has(issueId); }
function isPhotoHidden(issueId){ return FEEDBACK.pendingPhotoIssues.has(issueId); }
function isReportFlagged(issueId){ return FEEDBACK.pendingReportIssues.has(issueId); }
function issueFlags(issueId){ return FEEDBACK.flags.filter(f => f.issueId === issueId && f.status === 'pending'); }
function flagCount(){ return FEEDBACK.flags.filter(f => f.status === 'pending').length; }
function feedbackReady(){ return Boolean(SUPABASE_ENABLED && FEEDBACK.userId && !FEEDBACK.loading && !FEEDBACK.error); }

async function ensureFeedbackSession(){
  if (!SUPABASE_ENABLED) {
    FEEDBACK.error = 'Shared feedback requires a configured Supabase connection.';
    return false;
  }
  if (anonymousSessionRequest) return anonymousSessionRequest;
  anonymousSessionRequest = (async()=>{
    const {data:{session}, error:sessionError} = await sb.auth.getSession();
    if (sessionError) throw sessionError;
    if (session?.user) {
      FEEDBACK.userId = session.user.id;
      return true;
    }
    const {data,error} = await sb.auth.signInAnonymously();
    if (error) throw error;
    if (!data?.user) throw new Error('Supabase did not return an anonymous user.');
    FEEDBACK.userId = data.user.id;
    FEEDBACK.error = '';
    return true;
  })().catch(error=>{
    console.error('Could not establish a shared feedback identity:', error);
    FEEDBACK.userId = null;
    FEEDBACK.error = `Could not establish Supabase feedback identity: ${feedbackErrorText(error)}`;
    return false;
  }).finally(()=>{ anonymousSessionRequest = null; });
  return anonymousSessionRequest;
}

async function refreshFeedback(){
  if (feedbackRequest) return feedbackRequest;
  if (!SUPABASE_ENABLED) {
    FEEDBACK.loading = false;
    FEEDBACK.error = 'Shared feedback requires a configured Supabase connection.';
    refreshPublic();
    return;
  }
  FEEDBACK.loading = true;
  feedbackRequest = (async()=>{
    if (!await ensureFeedbackSession()) return;
    const issueIds = db.issues().filter(i => i.public !== false && i.status !== 'Rejected').map(i => i.id);
    const nextCounts = {};
    const nextVotes = new Set();
    const nextPhotoIssues = new Set();
    const nextReportIssues = new Set();
    for (let offset = 0; offset < issueIds.length; offset += 200) {
      const batch = issueIds.slice(offset, offset + 200);
      const [countsResult, votesResult, photoFlagsResult, reportFlagsResult] = await Promise.all([
        sb.rpc('cit_vote_counts', {issue_ids: batch}),
        sb.from('cit_report_votes').select('issue_id').eq('user_id', FEEDBACK.userId).in('issue_id', batch),
        sb.rpc('cit_pending_photo_flags', {issue_ids: batch}),
        sb.rpc('cit_pending_report_flags', {issue_ids: batch})
      ]);
      if (countsResult.error) throw new Error(`cit_vote_counts failed: ${feedbackErrorText(countsResult.error)}`);
      if (votesResult.error) throw new Error(`Reading your votes failed: ${feedbackErrorText(votesResult.error)}`);
      if (photoFlagsResult.error) throw new Error(`Loading pending photo flags failed: ${feedbackErrorText(photoFlagsResult.error)}`);
      if (reportFlagsResult.error) throw new Error(`Loading pending report flags failed: ${feedbackErrorText(reportFlagsResult.error)}`);
      (countsResult.data || []).forEach(row=>{ nextCounts[row.issue_id] = Number(row.vote_count) || 0; });
      (votesResult.data || []).forEach(row=>nextVotes.add(row.issue_id));
      (photoFlagsResult.data || []).forEach(row=>nextPhotoIssues.add(row.issue_id));
      (reportFlagsResult.data || []).forEach(row=>nextReportIssues.add(row.issue_id));
    }
    let nextFlags = can.review() ? FEEDBACK.flags : [];
    if (can.review()) {
      const {data,error} = await sb.from('cit_content_flags')
        .select('id,issue_id,target_type,reason,status,created_at')
        .eq('status','pending').order('created_at',{ascending:false});
      if (error) throw new Error(`Loading the review queue failed: ${feedbackErrorText(error)}`);
      nextFlags = (data || []).map(flag=>({
        id: flag.id, issueId: flag.issue_id, target: flag.target_type,
        reason: flag.reason, status: flag.status, createdAt: flag.created_at
      }));
    }
    FEEDBACK.voteCounts = nextCounts;
    FEEDBACK.myVotes = nextVotes;
    FEEDBACK.pendingPhotoIssues = nextPhotoIssues;
    FEEDBACK.pendingReportIssues = nextReportIssues;
    FEEDBACK.flags = nextFlags;
    FEEDBACK.error = '';
  })().catch(error=>{
    console.error('Could not load shared feedback:', error);
    FEEDBACK.error = `Could not load shared feedback: ${feedbackErrorText(error)}`;
  }).finally(()=>{
    FEEDBACK.loading = false;
    feedbackRequest = null;
    refreshPublic();
    if ((S.view === 'review' && can.review()) ||
        (S.view === 'manage' && can.manage() && !isUserEditing())) render();
  });
  return feedbackRequest;
}

async function addContentFlag(issueId, target, reason){
  if (!feedbackReady()) { toast('Shared feedback is not ready. Please try again.'); return; }
  const {error} = await sb.from('cit_content_flags').insert({
    issue_id: issueId,
    target_type: target,
    reason: reason.trim().length >= 3 ? reason.trim().slice(0, 500) : 'No reason provided',
    reporter_id: FEEDBACK.userId
  });
  if (error) {
    if (error.code === '23505') {
      toast('You already flagged this content while its review is pending.');
      return;
    }
    console.error('Could not submit content flag:', error);
    toast('Could not submit flag: ' + error.message);
    return;
  }
  await refreshFeedback();
  refreshPublic();
  toast(target === 'photo' ? 'Photo hidden while awaiting admin review.' : 'Report flagged for admin review.');
}
function applyTheme(theme){
  const chosen = theme === 'light' || theme === 'dark' ? theme : 'auto';
  if(chosen === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', chosen);
  try { localStorage.setItem(THEME_KEY, chosen); } catch(e) { /* private browsing may block storage */ }
  const button = $('#themeToggle');
  if(button){
    button.textContent = chosen === 'dark' ? '☀ Light mode' : chosen === 'light' ? '☾ Dark mode' : '◐ Theme';
    button.setAttribute('aria-label', chosen === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    button.title = 'Change colour theme';
  }
}
function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') || 'auto';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}
function restoreTheme(){
  let theme = 'auto';
  try { theme = localStorage.getItem(THEME_KEY) || 'auto'; } catch(e) { /* use system theme */ }
  applyTheme(theme);
}

function renderNav(){
  const items = [['report','Report an issue'], ['public','Public board']];
  if (S.role) {
    if (can.dashboard()) items.push(['dash','Dashboard']);
    if (can.manage()) items.push(['manage','Manage']);
    if (can.review()) items.push(['review','Content review']);
    if (can.qrs()) items.push(['qrs','QR codes']);
    if (can.account()) items.push(['account','Account']);
    items.push(['logout','Log out']);
  } else items.push(['login','Staff login']);
  const active = {done:'report', detail:'dash'}[S.view] || S.view;
  $('#nav').innerHTML = `<button type="button" class="nav-toggle" aria-expanded="false" aria-controls="navLinks">☰ Menu</button><div id="navLinks" class="nav-links">${items.map(([v,l]) => `<button data-v="${v}" ${active === v ? 'aria-current="true"' : ''}>${l}</button>`).join('')}</div>`;
  $('#nav').insertAdjacentHTML('beforeend', '<button type="button" class="theme-toggle" id="themeToggle">◐ Theme</button>');
  $('#themeToggle').onclick = toggleTheme;
  applyTheme((() => { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch(e) { return 'auto'; } })());
  const navToggle = $('#nav .nav-toggle');
  const navLinks = $('#navLinks');
  navToggle.onclick = () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navToggle.setAttribute('aria-expanded', String(open));
    navLinks.classList.toggle('is-open', open);
  };
  navLinks.querySelectorAll('button').forEach(b => b.onclick = () => {
    if (b.dataset.v === 'logout'){ signOut(); } else go(b.dataset.v);
  });
  const who = $('#who'); who.hidden = !S.role; who.textContent = S.role ? ROLES[S.role].label : '';
}

/* ============================================================
   VIEWS
   ============================================================ */
function viewReport(){
  const locs = db.list('locs'), cats = db.list('cats');
  const locked = qrLoc && locs.some(l => l.id === qrLoc);
  return `
  <h1>Report a problem</h1>
  <p class="lead">Takes under a minute. No name or phone number needed.</p> 
  <div class="live"><span class="dot" aria-hidden="true"></span><span id="currentTime"></span></div>
  <div class="card stack">
    <div>
      <label for="loc">Where is the problem?</label>
      ${locked
        ? `<div class="loc-pin">${esc(locName(qrLoc))}</div><div class="hint">Location filled in from the QR code you scanned.</div>`
        : `<select id="loc"><option value="">Choose a location</option>${locs.map(l => `<option value="${esc(l.id)}" ${S.loc===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select>
           <div class="hint">When you scan a QR code on campus, this is filled in for you.</div>`}
    </div>
    <div>
      <label for="cat">What kind of problem is it?</label>
      <select id="cat"><option value="">Choose a category</option>${cats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>
    </div>
    <div>
      <label>Photo (optional but recommended)</label>
      <input id="cameraPhoto" type="file" accept="image/*" capture="environment" hidden>
      <input id="galleryPhoto" type="file" accept="image/*" hidden>
      <div class="row">
        <button type="button" class="btn ghost" id="cameraBtn">📷 Take photo</button>
        <button type="button" class="btn ghost" id="galleryBtn">🖼️ Choose photo</button>
      </div>
      <div id="photoName" class="hint" style="margin-top:8px">${S.photo ? esc(S.photoName || 'Photo selected') : 'No photo selected.'}</div>
      <div id="prev">${S.photo ? `<img class="photo-prev" src="${esc(S.photo)}" alt="Preview of your photo">` : ''}</div>
      <div class="hint">Photos are stored securely in Supabase Storage. Staff/admin/principal can view them when authorized.</div>
    </div>
    <div>
      <label for="desc">Description (optional)</label>
      <textarea id="desc" maxlength="300" placeholder="Example: Ceiling fan makes a loud noise when switched on"></textarea>
      <div class="hint">The description can appear on the public board. Please don't write names.</div>
    </div>
    <div class="row"><button class="btn" id="submit">Submit report</button><span class="hint" id="err" role="alert"></span></div>
  </div>`;
}

function viewDone(){
  return `
  <div class="card stack">
    <h1>Report submitted</h1>
    <p class="lead" style="margin:0">Your issue ID is <b>${esc(S.lastId)}</b>. Search for it on the public board to follow progress.</p>
    <div class="row"><button class="btn" id="again">Report another issue</button><button class="btn ghost" id="toPub">Open public board</button></div>
  </div>`;
}

function viewLogin(){
  const options=Object.entries(ROLES).map(([k,r])=>`<option value="${esc(k)}">${esc(r.label)}</option>`).join('');
  return `
  <section class="login-layout" aria-labelledby="login-title">
    <div class="login-welcome">
      <div class="login-mark" aria-hidden="true">C</div>
      <p class="login-eyebrow">Campus Issue Tracker</p>
      <h1 id="login-title">Welcome back</h1>
      <p class="login-welcome-copy">Sign in to review reports and help make your campus better for everyone.</p>
      <div class="login-note"><span class="login-note-dot" aria-hidden="true"></span> A secure space for campus staff</div>
    </div>
    <div class="login-form-panel">
      <h2>Staff sign in</h2>
      <p class="login-form-copy">Use the account details assigned to you by your administrator.</p>
      <div class="login-fields">
        <div><label for="email">Email address</label><input id="email" type="email" autocomplete="username" placeholder="name@campus.edu" required></div>
        <div><label for="pw">Password</label><div class="password-field"><input id="pw" type="password" autocomplete="current-password" placeholder="Enter your password" required><button id="togglePassword" class="password-toggle" type="button" aria-label="Show password" aria-pressed="false" title="Show password"><svg class="password-eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle><path class="password-eye-slash" d="m3 3 18 18"></path></svg></button></div></div>
        <div><label for="role">Sign in as</label><select id="role">${options || '<option value="">Roles unavailable</option>'}</select></div>
        ${LOGIN_ROLES_ERROR ? `<div class="warn" role="alert">${esc(LOGIN_ROLES_ERROR)}</div>` : ''}
        <div class="login-actions"><button class="btn" id="loginBtn" type="button" ${!SUPABASE_ENABLED?'disabled':''}>Log in</button><span class="hint" id="err" role="alert"></span></div>
      </div>
      <div class="login-account-note">Accounts are created by the administrator. The selected role must match your assigned role.</div>
      <div class="warn">${SUPABASE_ENABLED ? 'Secure sign-in uses Supabase Auth.' : 'Supabase is not connected. Configure the project URL and publishable key first.'}</div>
    </div>
  </section>`;
}

function viewDash(){
  const all = db.issues(), s = stats(all), cats = db.list('cats');
  const list = all.filter(i => (S.fStatus === 'All' || i.status === S.fStatus) && (S.fCat === 'All' || i.cat === S.fCat));
  const note = can.manage() ? 'You have management access based on your assigned permissions.' : can.status() ? 'You can update issue status based on your assigned permissions.' : 'Your access is limited to the permissions assigned to your role.';
  return `
  <h1>Dashboard</h1>
  <p class="lead">${note}</p>
  <div class="warn" style="margin-bottom:16px">${SUPABASE_ENABLED ? '🟢 Supabase connected: this browser syncs reports with the shared database.' : '🟡 Supabase not configured: this browser stores reports/photos locally. Paste your publishable key in the configuration at the top of index.html.'}</div>
  <div class="stats">
    <div class="stat"><b>${s.total}</b><span>Total issues</span></div>
    <div class="stat"><b>${s.open}</b><span>Open</span></div>
    <div class="stat"><b>${s.resolved}</b><span>Resolved</span></div>
    <div class="stat"><b style="font-size:1.2rem;padding:6px 0">${dur(s.avg)}</b><span>Average time to fix</span></div>
  </div>
  <div class="cols">
    <div class="card"><h2>Issues by category</h2>${bars(countBy(all,'cat',catName))}</div>
    <div class="card"><h2>Issues by location</h2>${bars(countBy(all,'loc',locName))}</div>
  </div>
  <div class="row" style="margin-bottom:14px">
    <select id="fs" aria-label="Filter by status" style="width:auto"><option>All</option>${STATUSES.map(x => `<option ${S.fStatus===x?'selected':''}>${x}</option>`).join('')}</select>
    <select id="fc" aria-label="Filter by category" style="width:auto"><option value="All">All</option>${cats.map(c => `<option value="${esc(c.id)}" ${S.fCat===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
  </div>
  ${list.length ? list.map(i => `
    <button class="issue" data-id="${esc(i.id)}">
      ${i.photo ? `<img class="thumb" data-photo-issue="${esc(i.id)}" src="${esc(i.photo)}" alt="Reported issue photo" loading="lazy">` : `<div class="thumb">No photo</div>`}
      <div class="meta">
        <div class="t">${esc(catName(i.cat))} problem <span class="badge ${stClass(i.status)}">${i.status}</span></div>
        <div class="s">${esc(locName(i.loc))}</div>
        <div class="s">${esc(i.id)}, ${when(i.created)}${i.public === false ? ', hidden from public' : ''}</div>
      </div>
    </button>`).join('') : `<div class="card">No issues match. ${can.manage() ? 'Add sample issues from the Manage page.' : ''}</div>`}`;
}

function viewDetail(){
  const i = db.get(S.selected);
  if (!i) return `<div class="card">Issue not found.</div>`;
  return `
  <p><button class="btn ghost small" id="back">Back to dashboard</button></p>
  <div class="card stack">
    <div><h1>${esc(catName(i.cat))} problem</h1>
      <div class="row"><b>${esc(i.id)}</b><span class="badge ${stClass(i.status)}">${i.status}</span></div></div>
    <div><b>Location:</b> ${esc(locName(i.loc))}</div>
    <div><b>Reported:</b> ${when(i.created)}</div>
    <div><b>Description:</b> ${i.desc ? esc(i.desc) : '<span class="hint">None given</span>'}</div>
    ${i.photo ? `<img class="photo-prev" data-photo-issue="${esc(i.id)}" src="${esc(i.photo)}" alt="Photo of the reported problem" loading="lazy">` : ''}
    ${can.status() ? `
    <div>
      <label for="note">Update status</label>
      <input id="note" type="text" maxlength="120" autocomplete="off" placeholder="Note, for example: Electrician will visit tomorrow">
      <div class="hint">Press Enter or Save note to add a note without changing status. Choosing a status button saves the note with that status change.</div>
      <div class="row" style="margin-top:8px"><button class="btn ghost small" id="saveNote" type="button">Save note</button></div>
      <div class="row" style="margin-top:10px">
        ${STATUSES.map(x => `<button class="btn small ${x===i.status?'':'ghost'}" data-st="${x}">${x}</button>`).join('')}
      </div>
    </div>` : `<div class="warn">View-only access. Staff or admin can change the status.</div>`}
    ${can.manage() ? `
    <div class="row" style="justify-content:space-between">
      <label class="inline"><input type="checkbox" id="pubToggle" ${i.public !== false ? 'checked' : ''}> Show on public board</label>
      <button class="btn danger small" id="del">Delete issue</button>
    </div>` : ''}
    <div><h2>History</h2>
      <ul class="history">${i.history.slice().reverse().map(h => `<li><b>${h.status}</b> <span class="hint">${when(h.at)}</span>${h.note ? `<div>${esc(h.note)}</div>` : ''}</li>`).join('')}</ul>
    </div>
  </div>`;
}

function viewPublic(){
  return `
  <h1>Campus issues, live</h1>
  <p class="lead">Problems reported on campus and what is being done about them.</p>
  <div class="live"><span class="dot" aria-hidden="true"></span><span id="stamp"></span></div>
  <div class="row" style="margin-bottom:14px">
    <input type="text" id="pq" placeholder="Search by issue ID, place or category" aria-label="Search issues" value="${esc(S.pq)}" style="flex:1 1 240px;width:auto">
    <select id="pf" aria-label="Filter by status" style="width:auto"><option>All</option>${['Reported','In Progress','Resolved'].map(x => `<option ${S.pf===x?'selected':''}>${x}</option>`).join('')}</select>
  </div>
  <div id="pubBody"></div>`;
}
function pubBody(){
  const base = db.issues().filter(i => i.public !== false && i.status !== 'Rejected');
  const s = stats(base), q = S.pq.trim().toLowerCase();
  const list = base.filter(i => (S.pf === 'All' || i.status === S.pf) &&
    (!q || (i.id + ' ' + locName(i.loc) + ' ' + catName(i.cat) + ' ' + (isReportFlagged(i.id) ? 'This report is flagged.' : (i.desc || ''))).toLowerCase().includes(q)));
  return `
  <div class="stats">
    <div class="stat"><b>${s.reported}</b><span>Reported</span></div>
    <div class="stat"><b>${s.progress}</b><span>Being fixed</span></div>
    <div class="stat"><b>${s.resolved}</b><span>Resolved</span></div>
    <div class="stat"><b style="font-size:1.2rem;padding:6px 0">${dur(s.avg)}</b><span>Average time to fix</span></div>
  </div>
  ${list.length ? list.map(i => {
    const last = i.history[i.history.length - 1];
    return `<article class="pub-item">
      <div class="pub-layout">
        <div class="pub-media">
          ${i.photo && !isPhotoHidden(i.id) ? `<img class="pub-photo" data-photo-issue="${esc(i.id)}" src="${esc(i.photo)}" alt="Photo attached to report ${esc(i.id)}" loading="lazy">` : `<div class="pub-photo-placeholder">${isPhotoHidden(i.id) ? 'Photo hidden pending admin review' : 'No photo attached'}</div>`}
        </div>
        <div class="pub-details">
          <div class="row"><span class="badge ${stClass(i.status)}">${i.status}</span><b>${esc(catName(i.cat))}</b></div>
          <h2 class="pub-location">${esc(locName(i.loc))}</h2>
          ${isReportFlagged(i.id) ? '<p class="pub-description">This report is flagged.</p>' : i.desc ? `<p class="pub-description">${esc(i.desc)}</p>` : ''}
          ${last && last.note && last.status !== 'Reported' ? `<p class="hint pub-update">Update: ${esc(last.note)}</p>` : ''}
          <div class="hint pub-id">${esc(i.id)}, reported ${ago(i.created)}</div>
        </div>
      </div>
      <div class="feedback-actions" aria-label="Community feedback">
        <button class="btn ghost small" type="button" data-vote="${esc(i.id)}" ${feedbackReady() ? '' : 'disabled'}>${hasVoted(i.id) ? '↩ Withdraw support' : '▲ Support'} ${voteCount(i.id)}</button>
        <button class="btn ghost small" type="button" data-flag="report" data-id="${esc(i.id)}" ${feedbackReady() ? '' : 'disabled'}>Flag report</button>
        ${i.photo && !isPhotoHidden(i.id) ? `<button class="btn ghost small" type="button" data-flag="photo" data-id="${esc(i.id)}" ${feedbackReady() ? '' : 'disabled'}>Flag photo</button>` : ''}
      </div>
    </article>`; }).join('') : `<div class="card">No issues to show.</div>`}
  ${FEEDBACK.error ? `<p class="hint" role="status">${esc(FEEDBACK.error)}</p>` : FEEDBACK.loading ? '<p class="hint" role="status">Loading shared feedback…</p>' : ''}`;
}
function refreshPublic(){
  if (S.view !== 'public' || !$('#pubBody')) return;
  const body=$('#pubBody');
  const template=document.createElement('template');
  template.innerHTML=pubBody();
  preserveIssuePhotos(body,template.content);
  body.replaceChildren(template.content);
  updatePublicStamp();
}
function updatePublicStamp(){
  const stamp=$('#stamp');
  if(stamp) stamp.textContent = 'Live. Checked ' + new Date().toLocaleString([], {dateStyle:'medium', timeStyle:'medium'});
}

function viewManage(){
  const issues = db.issues();
  const sec = (kind, title, items, ph) => `
  <div class="card stack">
    <h2>${title}</h2>
    <div>${items.map(x => `
      <div class="edit-row" data-kind="${kind}" data-id="${esc(x.id)}">
        <input type="text" value="${esc(x.name)}" maxlength="60" aria-label="${title} name">
        <button class="btn small" data-act="save">Save</button>
        <button class="btn ghost small" data-act="del">Delete</button>
        <span class="hint">${issues.filter(i => i[FIELD[kind]] === x.id).length} issues</span>
      </div>`).join('')}</div>
    <div class="edit-row"><input type="text" id="new-${kind}" placeholder="${ph}" maxlength="60" aria-label="New name"><button class="btn small" data-add="${kind}">Add</button></div>
  </div>`;
  return `
  <h1>Manage</h1>
  <p class="lead">Admin only. Changes apply everywhere straight away.</p>
  <div class="stack">
    ${sec('locs','Locations', db.list('locs'), 'Example: Block C, Room 101')}
    <div class="warn">Renaming a location keeps its QR code working, because the code stores a fixed ID, not the name.</div>
    ${sec('cats','Categories', db.list('cats'), 'Example: Internet')}
    <div class="card stack">
      <h2>Content moderation</h2>
      <p class="hint">Review shared user flags from the dedicated Content review page.</p>
      <button class="btn" type="button" data-go-review>Open content review${flagCount() ? ` (${flagCount()} pending)` : ''}</button>
    </div>
    <div class="card stack">
      <h2>Roles and permissions</h2>
      <p class="hint">Role definitions and permissions are read from Supabase. To create a role, change permissions, or assign a user, use the administrator SQL workflow documented in <b>docs/AUTH_SETUP.md</b>. This browser screen does not grant roles or create accounts.</p>
      <div class="stack">${Object.entries(ROLES).map(([id,role])=>`<div class="role-row"><b>${esc(role.label)}</b><span class="hint">${esc(id)} · ${role.permissions.map(esc).join(', ')}</span></div>`).join('')}</div>
    </div>
    <div class="card stack">
      <h2>Demo data</h2>
      <div class="row"><button class="btn ghost small" id="sample">Add sample issues</button><button class="btn danger small" id="reset">Delete all issues</button></div>
    </div>
  </div>`;
}

function viewContentReview(){
  const flags = FEEDBACK.flags.filter(f => f.status === 'pending');
  return `
    <h1>Content review</h1>
    <p class="lead">Admin review queue for reports and photos flagged by users.</p>
    <div class="card stack">
      <p class="hint">While a report flag is pending, its public description is replaced with “This report is flagged.” A reviewer can hide it from the public board; hiding does not delete it, and staff can still find it in the dashboard. Pending photo flags hide the photo for everyone.</p>
      ${flags.length ? flags.map(f => {
        const issue = db.get(f.issueId);
        return `<div class="moderation-row"><div><b>${esc(f.target === 'photo' ? 'Photo' : 'Report')} · ${esc(f.issueId)}</b><div>${esc(f.reason || 'No reason provided')}</div><div class="hint">${when(f.createdAt)}${issue ? ' · ' + esc(locName(issue.loc)) : ' · Issue no longer exists'}</div></div><div class="row"><button class="btn small" type="button" data-review="dismiss" data-flag-id="${esc(f.id)}">Dismiss flag</button>${f.target === 'report' && issue ? `<button class="btn ghost small" type="button" data-review="hide" data-flag-id="${esc(f.id)}">Hide from public board</button>` : ''}<button class="btn ghost small" type="button" data-review="resolve" data-flag-id="${esc(f.id)}">Resolve</button></div></div>`;
      }).join('') : '<div class="hint">No content waiting for review.</div>'}
    </div>`;
}

function viewQrs(){
  const base = db.base();
  const item = (title, path) => `<div class="qr-item"><div class="qr" data-path="${esc(path)}"></div><b>${esc(title)}</b><div class="u"></div><button class="btn ghost small noprint" data-save>Save image</button></div>`;
  return `
  <h1>QR codes</h1>
  <p class="lead">Optional until the site is hosted. Print one for each place and stick it there.</p>
  <div class="card stack noprint" style="margin-bottom:16px">
    <div><label for="base">Website address</label>
      <input id="base" type="text" value="${esc(base)}" placeholder="https://your-project.vercel.app">
      <div class="hint">After you host the site, paste its real address here. Every code below updates.</div></div>
    ${/^https?:\/\//.test(base) ? '' : '<div class="warn">This address does not start with http or https, so phones cannot open it yet.</div>'}
    <div class="row"><button class="btn small" id="applyBase">Update QR codes</button><button class="btn ghost small" id="print">Print all</button></div>
    <div class="hint">If "Save image" does nothing, press and hold the code and choose Save image.</div>
  </div>
  <h2>Public board</h2>
  <div class="qr-grid" style="margin-bottom:20px">${item('Live public board', '?view=public')}</div>
  <h2>Locations</h2>
  <div class="qr-grid">${db.list('locs').map(l => item(l.name, '?loc=' + encodeURIComponent(l.id))).join('')}</div>`;
}

/* ============================================================
   SECTION: FORM HANDLERS AND USER ACTIONS
   ============================================================
   This is the part that listens to real user actions such as:
   - choosing a photo,
   - submitting a report,
   - pressing a button,
   - filtering list items,
   - logging in or logging out.

   In web apps, these are usually attached to DOM elements with .onclick,
   .onchange or addEventListener. The browser fires these events whenever
   a user interacts with the page.
   ============================================================ */
function compressImage(file, cb){
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, 800 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => cb(null);
    img.src = reader.result;
  };
  reader.onerror = () => cb(null);
  reader.readAsDataURL(file);
}

let reportClockTimer = null;
function bindReport(){
  if(reportClockTimer) clearInterval(reportClockTimer);
  const sel = $('#loc');
  if (sel) sel.onchange = () => S.loc = sel.value;

  const processPhoto = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      $('#err').textContent = 'Please choose an image file.';
      return;
    }
    compressImage(f, data => {
      if (!data) {
        $('#err').textContent = 'That file could not be read as an image.';
        return;
      }
      S.photo = data;
      S.photoName = f.name || 'Photo selected';
      const photoName = $('#photoName'), preview = $('#prev'), error = $('#err');
      if (photoName) photoName.textContent = S.photoName;
      if (preview) preview.innerHTML = `<img class="photo-prev" src="${data}" alt="Preview of your photo">`;
      if (error) error.textContent = '';
    });
  };

  $('#cameraBtn').onclick = () => $('#cameraPhoto').click();
  $('#galleryBtn').onclick = () => $('#galleryPhoto').click();
  $('#cameraPhoto').onchange = e => processPhoto(e.target.files[0]);
  $('#galleryPhoto').onchange = e => processPhoto(e.target.files[0]);

  const clock = () => {
    const el = $('#currentTime');
    if (el) el.textContent = 'Current device time: ' + new Date().toLocaleString();
  };
  clock();
  reportClockTimer = setInterval(clock, 1000);

  $('#submit').onclick = async () => {
    const cat = $('#cat').value, desc = $('#desc').value.trim();
    const loc = qrLoc && db.list('locs').some(l => l.id === qrLoc) ? qrLoc : S.loc;
    if (!loc) { $('#err').textContent = 'Choose where the problem is.'; return; }
    if (!cat) { $('#err').textContent = 'Choose a category.'; return; }

    // Best-effort duplicate suggestion using the reports currently loaded in this browser.
    // This is a usability aid only; shared duplicate prevention requires a database-backed query.
    const normalizedDesc = value => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const newWords = new Set(normalizedDesc(desc).split(' ').filter(w => w.length > 3));
    const possibleMatches = db.issues().filter(existing => {
      if(existing.loc !== loc || existing.cat !== cat || ['Resolved','Rejected'].includes(existing.status) || existing.public === false) return false;
      const oldWords = new Set(normalizedDesc(existing.desc).split(' ').filter(w => w.length > 3));
      const overlap = [...newWords].filter(w => oldWords.has(w)).length;
      const similarity = newWords.size ? overlap / newWords.size : 0;
      return !desc || !existing.desc || similarity >= 0.45;
    }).slice(0, 3);
    if(possibleMatches.length){
      const first = possibleMatches[0];
      const summary = possibleMatches.map(i => `${i.id} — ${locName(i.loc)} / ${catName(i.cat)}\n${(i.desc || 'No description').slice(0,110)}`).join('\n\n');
      const reviewExisting = window.confirm(`A similar active report may already exist:\n\n${summary}\n\nPress OK to review existing reports instead of submitting. Press Cancel only if this is a different issue and you want to continue.`);
      if(reviewExisting){
        S.pq = first.id;
        go('public');
        setTimeout(() => { const search = $('#pq'); if(search){ search.value = first.id; search.dispatchEvent(new Event('input')); } }, 0);
        return;
      }
    }

    // ISO timestamp currently comes from the device clock; database-authoritative timestamps remain an external migration.
    const now = new Date().toISOString();
    const issue = {
      id: db.nextId(),
      loc,
      cat,
      desc,
      photo: S.photo,
      coords: null,
      status: 'Reported',
      created: now,
      public: true,
      history: [{status:'Reported', note:'Report submitted', at: now}]
    };

    /* Save locally first so the UI is responsive. */
    if (!db.add(issue)) {
      $('#err').textContent = 'Browser storage is full. Remove old demo issues or use a smaller photo.';
      return;
    }

    $('#submit').disabled = true;
    $('#submit').textContent = SUPABASE_ENABLED ? 'Uploading…' : 'Saving…';

    /* In Supabase mode, upload the image to private Storage and save its path. */
    if (SUPABASE_ENABLED && issue.photo) {
      const path = await uploadPhotoToSupabase(issue.photo, issue.id);
      if(!path){
        db.remove(issue.id);
        $('#submit').disabled = false;
        $('#submit').textContent = 'Submit report';
        $('#err').textContent = 'Photo upload failed. The report was not submitted.';
        return;
      }
      issue.photo_url = path;
      issue.photo = null;
    }

    const pushed = await pushIssue(issue);
    if (!pushed.ok) {
      // In shared-database mode, never present an unsynced local-only copy as submitted.
      db.remove(issue.id);
      if (SUPABASE_ENABLED && issue.photo_url) {
        try { await sb.storage.from('issue-photos').remove([issue.photo_url]); }
        catch (cleanupError) { console.warn('Orphan photo cleanup failed:', cleanupError); }
      }
      $('#submit').disabled = false;
      $('#submit').textContent = 'Submit report';
      $('#err').textContent = `Submission failed: ${pushed.error?.message || 'Supabase rejected the issue insert.'} Nothing was submitted to the shared board.`;
      return;
    }

    /* Keep the local copy aligned with the remote row. */
    db.update(issue.id, i => {
      i.photo_url = issue.photo_url || null;
      i.photo = issue.photo || null;
    });

    if(reportClockTimer) { clearInterval(reportClockTimer); reportClockTimer=null; }
    S.lastId = issue.id;
    S.photo = null;
    S.photoName = '';
    go('done');
  };
}
function bindLogin(){
  const doLogin = async () => {
    const email=$('#email').value.trim(); const password=$('#pw').value; const selectedRole=$('#role').value;
    const error=$('#err'); error.textContent='';
    if(!email || !password || !selectedRole){ error.textContent='Enter email, password, and select your assigned role.'; return; }
    if(!sb){ error.textContent='Supabase is not configured.'; return; }
    $('#loginBtn').disabled=true;
    try {
      const {error:loginError}=await sb.auth.signInWithPassword({email,password});
      if(loginError) throw loginError;
      const ok=await loadSignedInRole();
      if(!ok){ await sb.auth.signOut(); S.role=null; throw new Error('This account has no role assignment. Ask the administrator to assign one.'); }
      if(S.role!==selectedRole){ await sb.auth.signOut(); S.role=null; S_AUTH.email=''; throw new Error('The selected role does not match the role assigned to this account.'); }
      go('dash'); toast('Signed in as '+ROLES[S.role].label);
    } catch(e){ error.textContent=e.message || 'Sign-in failed.'; }
    finally { const b=$('#loginBtn'); if(b) b.disabled=false; }
  };
  $('#togglePassword').onclick=()=>{
    const password=$('#pw'), button=$('#togglePassword');
    const show=password.type === 'password';
    password.type=show ? 'text' : 'password';
    button.setAttribute('aria-label',show ? 'Hide password' : 'Show password');
    button.setAttribute('aria-pressed',String(show));
    button.title=show ? 'Hide password' : 'Show password';
  };
  $('#loginBtn').onclick=doLogin;
  $('#pw').onkeydown=e=>{if(e.key==='Enter') doLogin();};
  $('#email').onkeydown=e=>{if(e.key==='Enter') doLogin();};
}

function viewAccount(){
  return `
    <h1>Account settings</h1>
    <p class="lead">Your account is managed securely by Supabase.</p>
    <div class="card stack" style="max-width:520px">
      <p><b>Signed in as:</b> ${esc(ROLES[S.role]?.label || S.role || '')}</p>
      <p><b>Email:</b> ${esc(S_AUTH.email)}</p>
      <div><label for="currentPassword">Current password</label><input id="currentPassword" type="password" autocomplete="current-password"></div>
      <div><label for="newPassword">New password</label><input id="newPassword" type="password" minlength="8" autocomplete="new-password"></div>
      <div><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" type="password" minlength="8" autocomplete="new-password"></div>
      <div class="row"><button class="btn" id="changePassword" type="button">Change password</button><span id="accountMessage" class="hint" role="status"></span></div>
    </div>`;
}
function bindAccount(){
  $('#changePassword').onclick=async()=>{
    const current=$('#currentPassword').value, next=$('#newPassword').value, confirmNew=$('#confirmPassword').value;
    const message=$('#accountMessage'); message.textContent='';
    if(next.length<8){message.textContent='Use at least 8 characters.';return;}
    if(next!==confirmNew){message.textContent='The new passwords do not match.';return;}
    try {
      const {error:verifyError}=await sb.auth.signInWithPassword({email:S_AUTH.email,password:current});
      if(verifyError) throw new Error('Current password is incorrect.');
      const {error}=await sb.auth.updateUser({password:next});
      if(error) throw error;
      $('#currentPassword').value=''; $('#newPassword').value=''; $('#confirmPassword').value='';
      message.textContent='Password updated in Supabase. Use the new password on other devices too.';
    } catch(e){message.textContent=e.message || 'Could not update password.';}
  };
}

function bindDash(){
  $('#fs').onchange = e => { S.fStatus = e.target.value; render(); };
  $('#fc').onchange = e => { S.fCat = e.target.value; render(); };
  document.querySelectorAll('.issue').forEach(b => b.onclick = () => { S.selected = b.dataset.id; go('detail'); });
}

function bindDetail(){
  $('#back').onclick = () => go('dash');
  const saveNoteOnly = async () => {
    if (!can.status()) return;
    const field=$('#note');
    const note=field.value.trim();
    if(!note){ toast('Type a note first.'); field.focus(); return; }
    const selectedId=S.selected;
    const previous={...db.get(selectedId),history:db.get(selectedId).history.slice()};
    db.update(selectedId, i => { i.history.push({status:i.status, note, at:new Date().toISOString()}); });
    const result=await pushIssueUpdate(selectedId,{history:db.get(selectedId).history});
    if(!result.ok){
      restoreIssue(previous);
      render();
      toast(issueUpdateError(result.error));
      return;
    }
    render();
    toast('Note saved to Supabase.');
  };
  const noteField=$('#note');
  if(noteField){
    noteField.addEventListener('keydown',e=>{
      if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); saveNoteOnly(); }
    });
    $('#saveNote').onclick=saveNoteOnly;
  }
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => {
    if (!can.status()) return;
    const note = $('#note').value.trim(), st = b.dataset.st;
    const selectedId=S.selected;
    const previous={...db.get(selectedId),history:db.get(selectedId).history.slice()};
    db.update(selectedId, i => { i.status = st; i.history.push({status: st, note, at: new Date().toISOString()}); });
    const updated=db.get(selectedId);
    const result=await pushIssueUpdate(selectedId,{status:updated.status,history:updated.history});
    if(!result.ok){
      restoreIssue(previous);
      render();
      toast(issueUpdateError(result.error));
      return;
    }
    render(); toast('Status saved to Supabase: ' + st);
  });
  const pt = $('#pubToggle');
  if (pt) pt.onchange = async () => {
    const previous={...db.get(S.selected),history:db.get(S.selected).history.slice()};
    db.update(S.selected, i => i.public = pt.checked);
    const result=await pushIssueUpdate(S.selected,{public:pt.checked});
    if(!result.ok){
      restoreIssue(previous);
      render();
      toast(issueUpdateError(result.error));
      return;
    }
    toast(pt.checked ? 'Shown on public board' : 'Hidden from public board');
  };
  const del = $('#del');
  if (del) del.onclick = async () => {
    if (!can.manage()) return;
    if (!confirm('Delete this issue for good?')) return;

    const issue = db.get(S.selected);
    if(!issue){
      toast('Issue not found.');
      return;
    }

    del.disabled = true;
    del.textContent = 'Deleting…';

    try{
      // Delete the database row first. Never remove the only photo if the row deletion fails.
      if(SUPABASE_ENABLED){
        const {data:deletedRows,error:dbError}=await sb
          .from('issues')
          .delete()
          .eq('issue_id',issue.id)
          .select('issue_id');
        if(dbError) throw dbError;
        if(!deletedRows || deletedRows.length === 0) {
          throw new Error('The database did not confirm deletion. Check permissions and try again.');
        }
      }

      // Photo cleanup happens only after the row is confirmed deleted. If it fails,
      // the report is still correctly deleted; the orphaned file can be cleaned up later.
      let photoCleanupFailed = false;
      if(SUPABASE_ENABLED && issue.photo_url){
        const path=storagePathFromPhotoUrl(issue.photo_url);
        if(path){
          const {error:storageError}=await sb.storage.from('issue-photos').remove([path]);
          if(storageError) { photoCleanupFailed = true; console.warn('Report deleted but photo cleanup failed:', storageError); }
        }
      }

      db.remove(issue.id);
      S.selected=null;
      go('dash');
      toast(photoCleanupFailed ? 'Issue deleted; photo cleanup needs admin attention.' : 'Issue deleted');
    }catch(e){
      console.error('Delete failed:',e);
      del.disabled = false;
      del.textContent = 'Delete issue';
      toast('Delete failed: ' + (e?.message || 'Check Supabase policies.'));
    }
  };
}

function bindPublic(){
  $('#pq').oninput = e => { S.pq = e.target.value; refreshPublic(); };
  $('#pf').onchange = e => { S.pf = e.target.value; refreshPublic(); };
  $('#pubBody').addEventListener('click', async e => {
    const voteButton = e.target.closest('[data-vote]');
    if (voteButton) {
      const id = voteButton.dataset.vote;
      if (!feedbackReady()) { toast('Shared feedback is not ready. Please try again.'); return; }
      const withdrawing = hasVoted(id);
      voteButton.disabled = true;
      try {
        const result = withdrawing
          ? await sb.from('cit_report_votes').delete().eq('issue_id',id).eq('user_id',FEEDBACK.userId)
          : await sb.from('cit_report_votes').insert({issue_id:id,user_id:FEEDBACK.userId});
        if (result.error) throw result.error;
        await refreshFeedback();
        toast(withdrawing ? 'Your support has been withdrawn.' : 'Thanks for supporting this report.');
      } catch(error) {
        console.error('Could not update report support:', error);
        toast('Could not update support: ' + error.message);
        await refreshFeedback();
      }
      return;
    }
    const flagButton = e.target.closest('[data-flag]');
    if (flagButton) {
      const target = flagButton.dataset.flag, id = flagButton.dataset.id;
      const reason = prompt(target === 'photo' ? 'Why should this photo be reviewed? (optional)' : 'Why should this report be reviewed? (optional)', '');
      if (reason === null) return;
      try {
        await addContentFlag(id, target, reason.trim());
      } catch(error) {
        console.error('Could not submit content flag:', error);
        toast('Could not submit flag: ' + error.message);
      }
    }
  });
  refreshPublic();
  refreshFeedback();
}

function addSamples(){
  const locs = db.list('locs'), cats = db.list('cats');
  const cid = id => (cats.find(c => c.id === id) || cats[0]).id;
  const lid = k => locs[k % locs.length].id;
  [[0,'electrical','Ceiling fan makes a loud noise when switched on','Reported'],
   [4,'water','Tap is leaking and water is collecting on the floor','In Progress'],
   [5,'furniture','Two chairs in the reading hall have broken legs','Reported'],
   [3,'equipment','Projector does not turn on','Resolved'],
   [6,'cleanliness','Dustbins are overflowing near the seating area','Reported']
  ].forEach(([l,c,desc,status], k) => {
    const created = new Date(Date.now() - (k+1) * 7 * 3600e3).toISOString();
    const history = [{status:'Reported', note:'Report submitted', at: created}];
    if (status !== 'Reported') history.push({status, note: status === 'Resolved' ? 'Fixed by IT team' : 'Plumber has been informed', at: new Date().toISOString()});
    db.add({ id: db.nextId(), loc: lid(l), cat: cid(c), desc, photo: null, status, created, public: true, history });
  });
}

function bindManage(){
  document.querySelectorAll('[data-go-review]').forEach(button => button.onclick = () => go('review'));
  document.querySelectorAll('[data-review]').forEach(button => button.onclick = async () => {
    if (!can.review()) return;
    const flag = FEEDBACK.flags.find(f => f.id === button.dataset.flagId);
    if (!flag) { toast('Flag was not found.'); render(); return; }
    try {
      const {data:{user}, error:userError} = await sb.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('A signed-in reviewer is required.');
      const action = button.dataset.review;
      let status = action === 'dismiss' ? 'dismissed' : 'resolved';
      if (action === 'hide' && flag.target === 'report') {
        const {data:hidden,error:hideError} = await sb.rpc('cit_set_issue_public',{
          p_issue_id:flag.issueId,
          p_public:false
        });
        if (hideError) throw hideError;
        if (hidden !== true) throw new Error('The report could not be hidden. Confirm ISSUE_STATUS_SETUP.sql is installed and this account has the manage permission.');
        db.update(flag.issueId, item=>{ item.public = false; });
        status = 'hidden';
      }
      const {data,error} = await sb.from('cit_content_flags').update({
        status, reviewed_by:user.id, reviewed_at:new Date().toISOString()
      }).eq('id',flag.id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('The moderation flag could not be updated. Check reviewer permissions.');
      await Promise.all([syncFromSupabase(), refreshFeedback()]);
      render();
      toast('Moderation decision saved to Supabase.');
    } catch(error) {
      console.error('Could not save moderation decision:', error);
      toast('Could not save moderation decision: ' + error.message);
    }
  });
  document.querySelectorAll('.edit-row[data-kind]').forEach(row => {
    const kind = row.dataset.kind, id = row.dataset.id;
    row.querySelector('[data-act=save]').onclick = () => {
      const name = row.querySelector('input').value.trim();
      if (!name) { toast('Name cannot be empty'); return; }
      const list = db.list(kind); list.find(x => x.id === id).name = name;
      db.saveList(kind, list); render(); toast('Saved');
    };
    row.querySelector('[data-act=del]').onclick = () => {
      const n = db.issues().filter(i => i[FIELD[kind]] === id).length;
      if (n) { toast('Used by ' + n + ' issue(s). Rename it instead.'); return; }
      const list = db.list(kind);
      if (list.length <= 1) { toast('Keep at least one.'); return; }
      if (!confirm('Delete this item?')) return;
      db.saveList(kind, list.filter(x => x.id !== id)); render(); toast('Deleted');
    };
  });
  document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
    const kind = b.dataset.add, name = $('#new-' + kind).value.trim();
    if (!name) { toast('Type a name first'); return; }
    const list = db.list(kind); list.push({id: slug(name, list), name});
    db.saveList(kind, list); render(); toast('Added');
  });
  const sampleButton = $('#sample');
  const resetButton = $('#reset');
  if (SUPABASE_ENABLED) {
    if (sampleButton) sampleButton.hidden = true;
    if (resetButton) resetButton.hidden = true;
  } else {
    if (sampleButton) sampleButton.onclick = () => { addSamples(); render(); toast('Sample issues added'); };
    if (resetButton) resetButton.onclick = () => { if (confirm('Delete all issues on this device?')) { db.saveIssues([]); render(); toast('All issues deleted'); } };
  }
}

function bindQrs(){
  const draw = () => {
    const base = ($('#base').value.trim() || here).replace(/[?#].*$/, '');
    document.querySelectorAll('.qr').forEach(el => {
      const url = base + el.dataset.path;
      el.innerHTML = '';
      try { new QRCode(el, { text: url, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M }); }
      catch(e){ el.textContent = 'QR library did not load'; }
      el.parentElement.querySelector('.u').textContent = url;
    });
  };
  draw();
  $('#applyBase').onclick = () => { db.saveBase($('#base').value.trim() || here); render(); toast('QR codes updated'); };
  $('#print').onclick = () => window.print();
  document.querySelectorAll('[data-save]').forEach(b => b.onclick = () => {
    const box = b.parentElement, img = box.querySelector('img'), cv = box.querySelector('canvas');
    const data = (img && img.src.startsWith('data:')) ? img.src : (cv ? cv.toDataURL('image/png') : null);
    if (!data) { toast('Press and hold the code to save it'); return; }
    const a = document.createElement('a'); a.href = data;
    a.download = box.querySelector('b').textContent.replace(/[^a-z0-9]+/gi,'-').toLowerCase() + '-qr.png';
    document.body.appendChild(a); a.click(); a.remove();
  });
}

/* ============================================================
   RENDER
   ============================================================ */
function render(){
  if (S.view === 'manage' && !can.manage()) S.view = S.role ? (can.dashboard() ? 'dash' : 'report') : 'login';
  if (S.view === 'review' && !can.review()) S.view = S.role ? (can.dashboard() ? 'dash' : 'report') : 'login';
  if (S.view === 'qrs' && !can.qrs()) S.view = S.role ? (can.dashboard() ? 'dash' : 'report') : 'login';
  if (S.view === 'dash' && (!S.role || !can.dashboard())) S.view = 'login';
  if (S.view === 'account' && (!S.role || !can.account())) S.view = 'login';
  if (S.view === 'detail' && (!S.role || !can.dashboard())) S.view = 'login';
  const views = { report: viewReport, done: viewDone, login: viewLogin, dash: viewDash, detail: viewDetail,
                public: viewPublic, manage: viewManage, review: viewContentReview, qrs: viewQrs, account: viewAccount };
  const app=$('#app');
  const template=document.createElement('template');
  template.innerHTML=views[S.view]();
  preserveIssuePhotos(app,template.content);
  app.replaceChildren(template.content);
  renderNav();
  if (S.view === 'report') bindReport();
  if (S.view === 'done') { $('#again').onclick = () => go('report'); $('#toPub').onclick = () => go('public'); }
  if (S.view === 'login') bindLogin();
  if (S.view === 'dash') bindDash();
  if (S.view === 'detail') bindDetail();
  if (S.view === 'public') bindPublic();
  if (S.view === 'manage') bindManage();
  if (S.view === 'review') bindManage();
  if (S.view === 'qrs') bindQrs();
  if (S.view === 'account') bindAccount();
}
// Restore the authenticated Supabase user and load their database-assigned role.
S.role = null;
restoreTheme();
if (sb) {
  sb.auth.onAuthStateChange((_event, _session) => {
    setTimeout(async()=>{
      await loadSignedInRole();
      await ensureFeedbackSession();
      await refreshFeedback();
      render();
    },0);
  });
  (async()=>{
    await loadLoginRoles();
    await ensureFeedbackSession();
    await loadSignedInRole();
    await refreshFeedback();
    if(S.role && S.view==='login') S.view='dash';
    render();
  })();
}
// Keep the requested page (for example a QR-linked report form) even if a role is remembered.
if (SUPABASE_ENABLED) setInterval(refreshFeedback, 30000);
window.addEventListener('storage', () => { if(S.view==='public') refreshPublic(); });
render();
if (SUPABASE_ENABLED) {
  setTimeout(syncFromSupabase, 100);
  setInterval(syncFromSupabase, 10000); // polls shared data; render only when data changes
  // Signed photo URLs expire; refresh them before the one-hour expiry window.
  setInterval(refreshSignedPhotoUrls, 45 * 60 * 1000);
}
