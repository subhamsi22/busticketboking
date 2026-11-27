(() => {
  // The demo is an opt-in, browser-only preview. Existing Supabase accounts and data are unchanged.
  const demoKey = 'touriststar-demo';
  const demoUserKey = `${demoKey}-user`;
  const adminRoute = /admin(?:-login)?\.html$/.test(location.pathname);
  const demoMode = localStorage.getItem(`${demoKey}-enabled`) === 'yes' && !adminRoute;
  const demoUser = () => { try { return JSON.parse(localStorage.getItem(demoUserKey)); } catch { return null; } };
  const demoSeed = () => {
    if (localStorage.getItem(`${demoKey}-trips`)) return;
    const day = (offset, hour) => { const d=new Date(); d.setDate(d.getDate()+offset); d.setHours(hour,0,0,0); return d.toISOString(); };
    const trips=[
      {id:'demo-1',origin:'Mumbai',destination:'Pune',departure_at:day(1,7),arrival_at:day(1,10),fare:650,available_seats:28,total_seats:36,bus_name:'Sunrise Express',operator:'TouristStar',bus_type:'AC Seater'},
      {id:'demo-2',origin:'Mumbai',destination:'Pune',departure_at:day(1,15),arrival_at:day(1,18),fare:820,available_seats:18,total_seats:36,bus_name:'Western Ghats Sleeper',operator:'Deccan Travels',bus_type:'AC Sleeper'},
      {id:'demo-3',origin:'Delhi',destination:'Jaipur',departure_at:day(1,6),arrival_at:day(1,11),fare:540,available_seats:24,total_seats:40,bus_name:'Pink City Rider',operator:'RajWay',bus_type:'AC Seater'},
      {id:'demo-4',origin:'Bengaluru',destination:'Chennai',departure_at:day(2,21),arrival_at:day(3,5),fare:990,available_seats:16,total_seats:32,bus_name:'Night Owl',operator:'Southern Lines',bus_type:'AC Sleeper'},
      {id:'demo-5',origin:'Hyderabad',destination:'Vijayawada',departure_at:day(2,9),arrival_at:day(2,14),fare:480,available_seats:30,total_seats:40,bus_name:'Coastal Connect',operator:'TouristStar',bus_type:'AC Seater'}
    ]; localStorage.setItem(`${demoKey}-trips`,JSON.stringify(trips));
    localStorage.setItem(`${demoKey}-users`,JSON.stringify([{id:'user-demo',name:'Aarav Sharma',email:'aarav@example.test',joined:new Date().toISOString()},{id:'user-demo2',name:'Maya Patel',email:'maya@example.test',joined:new Date().toISOString()}]));
    localStorage.setItem(`${demoKey}-bookings`,JSON.stringify([{id:'BK-DEMO-2041',user:'Maya Patel',email:'maya@example.test',trip:'demo-3',seats:[4,5],status:'Confirmed',created_at:new Date().toISOString()}]));
  };
  const enableDemo = (user) => { demoSeed(); localStorage.setItem(`${demoKey}-enabled`,'yes'); localStorage.setItem(demoUserKey,JSON.stringify(user)); };
  const demoNotice=(text,error=false)=>{const el=document.querySelector('#notice');if(el){el.textContent=text;el.className=`notice ${error?'error':'success'}`;}};
  const demoEscape=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if (demoMode) {
    demoSeed(); const user=demoUser(); const $=s=>document.querySelector(s);
    const trips=()=>JSON.parse(localStorage.getItem(`${demoKey}-trips`)||'[]');
    const bookings=()=>JSON.parse(localStorage.getItem(`${demoKey}-bookings`)||'[]');
    const users=()=>JSON.parse(localStorage.getItem(`${demoKey}-users`)||'[]');
    const save=(key,value)=>localStorage.setItem(`${demoKey}-${key}`,JSON.stringify(value));
    const link=$('#account-link'); if(link&&user){link.textContent='Sign out';link.href='#signout';link.onclick=e=>{e.preventDefault();localStorage.removeItem(demoUserKey);location.href='index.html';};}
    if($('#user-name')) $('#user-name').textContent=user?.name||'Traveler';
    const auth=$('#auth-form'); if(auth) auth.addEventListener('submit',e=>{e.preventDefault();const v=Object.fromEntries(new FormData(auth));if(v.password.length<1){demoNotice('Enter a password to continue.',true);return;}const person={id:'user-'+Date.now(),name:v.full_name||v.email.split('@')[0],email:v.email};enableDemo(person);const list=users();if(!list.some(x=>x.email.toLowerCase()===person.email.toLowerCase())){list.push({...person,joined:new Date().toISOString()});save('users',list);}location.href='index.html';});
    $('#demo-login')?.addEventListener('click',()=>{enableDemo({id:'user-demo',name:'Aarav Sharma',email:'aarav@example.test'});location.href='index.html';});
    if($('#add-bus-form')) $('#add-bus-form').elements.travel_date.min=new Date().toISOString().slice(0,10);
    if($('#search-form')) { const form=$('#search-form'),date=form.elements.travel_date;date.min=new Date().toISOString().slice(0,10);const cityList=$('#cities');[...new Set(trips().flatMap(t=>[t.origin,t.destination]))].sort().forEach(c=>{const o=document.createElement('option');o.value=c;cityList.append(o);});$('#swap-cities')?.addEventListener('click',()=>{[form.elements.origin.value,form.elements.destination.value]=[form.elements.destination.value,form.elements.origin.value];});form.addEventListener('submit',e=>{e.preventDefault();const v=Object.fromEntries(new FormData(form)),found=trips().filter(t=>t.origin.toLowerCase()===v.origin.trim().toLowerCase()&&t.destination.toLowerCase()===v.destination.trim().toLowerCase()&&t.departure_at.slice(0,10)===v.travel_date);$('#results').innerHTML='';demoNotice(found.length?`${found.length} ${found.length===1?'journey':'journeys'} found`:'No demo buses on this route and date. Try Mumbai → Pune tomorrow.',!found.length);found.forEach(t=>{const card=document.createElement('article');card.className='trip-card';card.innerHTML=`<div><strong>${demoEscape(t.operator)}</strong><small>${demoEscape(t.bus_name)} · ${demoEscape(t.bus_type)}</small></div><div><strong>${new Date(t.departure_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} — ${new Date(t.arrival_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</strong><small>${demoEscape(t.origin)} → ${demoEscape(t.destination)}</small></div><div><strong class="trip-price">₹${t.fare.toLocaleString('en-IN')}</strong><small>${t.available_seats} seats available</small></div><button data-book="${t.id}">Book this bus →</button>`;$('#results').append(card);});});$('#results')?.addEventListener('click',e=>{const b=e.target.closest('[data-book]');if(b)location.href=`booking.html?trip=${b.dataset.book}`;}); }
    if($('#booking-form')) {const form=$('#booking-form');if(!user){location.href='login.html';}else{const trip=trips().find(t=>t.id===new URLSearchParams(location.search).get('trip'));if(!trip){demoNotice('Choose a bus from search results first.',true);}else{$('#trip-summary').innerHTML=`<span class="eyebrow">YOUR JOURNEY</span><h2>${demoEscape(trip.origin)} → ${demoEscape(trip.destination)}</h2><p>${demoEscape(trip.operator)} · ${new Date(trip.departure_at).toLocaleString()}</p><p>₹${trip.fare.toLocaleString('en-IN')} per seat</p>`;const taken=bookings().filter(b=>b.trip===trip.id&&b.status==='Confirmed').flatMap(b=>b.seats);for(let n=1;n<=trip.total_seats;n++){const label=document.createElement('label');label.className='seat';label.innerHTML=`<input type="checkbox" name="seats" value="${n}" ${taken.includes(n)?'disabled':''}><span>${n}</span>`;$('#seat-grid').append(label);}form.addEventListener('change',()=>$('#total').textContent=`₹${trip.fare*form.querySelectorAll('[name=seats]:checked').length}`);form.addEventListener('submit',e=>{e.preventDefault();const seats=[...form.querySelectorAll('[name=seats]:checked')].map(x=>Number(x.value));if(!seats.length){demoNotice('Choose at least one seat.',true);return;}const all=bookings(),code=`TS${Date.now().toString().slice(-7)}`;all.unshift({id:code,user:user.name,email:user.email,trip:trip.id,seats,status:'Confirmed',created_at:new Date().toISOString()});save('bookings',all);location.href=`tickets.html?booked=${code}`;});}}}
    if($('#booking-list')) {const host=$('#booking-list');const mine=bookings().filter(b=>b.email===user?.email);host.innerHTML=mine.length?'':'<div class="empty"><h2>No journeys booked yet.</h2><a class="primary-link" href="index.html#search">Find your first bus →</a></div>';mine.forEach(b=>{const t=trips().find(x=>x.id===b.trip);if(!t)return;const row=document.createElement('article');row.className='booking-row';row.innerHTML=`<div><span class="eyebrow">${demoEscape(b.id)}</span><h2>${demoEscape(t.origin)} → ${demoEscape(t.destination)}</h2><p>${new Date(t.departure_at).toLocaleString()} · ${demoEscape(t.bus_name)}</p><p>Seats: ${b.seats.join(', ')}</p></div><div class="booking-actions"><div class="booking-total">₹${(t.fare*b.seats.length).toLocaleString('en-IN')}<small>${demoEscape(b.status)}</small></div></div>`;host.append(row);});}
    if($('#admin-panel')) {if(!user||user.email!=='admin@touriststar.example'){location.href='login.html';return;}const all=bookings(),allUsers=users();$('#admin-users-count').textContent=allUsers.length;$('#admin-bookings-count').textContent=all.length;$('#admin-trips-count').textContent=trips().length;const uh=$('#admin-users'),bh=$('#admin-bookings'),th=$('#admin-trips');allUsers.forEach(u=>{const row=document.createElement('tr');row.innerHTML=`<td>${demoEscape(u.name)}</td><td>${demoEscape(u.email)}</td><td>${new Date(u.joined).toLocaleDateString()}</td>`;uh.append(row);});all.forEach(b=>{const t=trips().find(x=>x.id===b.trip);if(!t)return;const row=document.createElement('tr');row.innerHTML=`<td>${demoEscape(b.id)}</td><td>${demoEscape(b.user)}<small>${demoEscape(b.email)}</small></td><td>${demoEscape(t.origin)} → ${demoEscape(t.destination)}<small>${new Date(t.departure_at).toLocaleString()}</small></td><td>${b.seats.join(', ')}</td><td>${b.status}</td>`;bh.append(row);});trips().forEach(t=>{const row=document.createElement('tr');row.innerHTML=`<td>${demoEscape(t.bus_name)}<small>${demoEscape(t.operator)} · ${demoEscape(t.bus_type)}</small></td><td>${demoEscape(t.origin)} → ${demoEscape(t.destination)}</td><td>${new Date(t.departure_at).toLocaleString()}</td><td>₹${t.fare}</td><td>${t.available_seats}/${t.total_seats}</td>`;th.append(row);});$('#add-bus-form')?.addEventListener('submit',e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget)),depart=new Date(`${v.travel_date}T${v.departure_time}`),arrive=new Date(depart.getTime()+Number(v.duration)*3600000),list=trips();list.push({id:`demo-${Date.now()}`,origin:v.origin,destination:v.destination,departure_at:depart.toISOString(),arrival_at:arrive.toISOString(),fare:Number(v.fare),available_seats:Number(v.seats),total_seats:Number(v.seats),bus_name:v.bus_name,operator:v.operator,bus_type:v.bus_type});save('trips',list);demoNotice('Bus added to demo schedules.');setTimeout(()=>location.reload(),500);}); }
    return;
  }
  const client = window.supabase?.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const $ = (s) => document.querySelector(s);
  const notice = (text, error = true) => { const el = $('#notice'); if (el) { el.textContent = text; el.className = `notice ${error ? 'error' : 'success'}`; } };
  const userPromise = client ? client.auth.getUser().then(({ data }) => data.user) : Promise.resolve(null);
  if (!client) { notice('Add your Supabase URL and publishable key in supabase-config.js to connect the app.'); return; }

  userPromise.then(user => {
    const account = $('#account-link');
    if (account && user) { account.textContent = 'Sign out'; account.href = '#signout'; account.onclick = async e => { e.preventDefault(); await client.auth.signOut(); location.href = 'index.html'; }; }
    const greeting = $('#user-name'); if (greeting) greeting.textContent = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Traveler';
    if (location.pathname.endsWith('tickets.html')) loadBookings(user);
    if (location.pathname.endsWith('profile.html')) loadProfile(user);
    if (location.pathname.endsWith('admin.html')) loadAdmin(user);
  });

  async function loadAdmin(user) {
    if (!user) { location.href='admin-login.html'; return; }
    const {data:role,error:roleError}=await client.from('app_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if (roleError || !role) { location.href='index.html'; return; }
    $('#admin-panel').hidden=false;
    const [people,bookings,trips]=await Promise.all([
      client.from('profiles').select('id,full_name,email,created_at').order('created_at',{ascending:false}),
      client.from('bookings').select('id,booking_code,status,total_amount,created_at,profiles!bookings_user_profile_fkey(full_name,email),trips(origin,destination,departure_at,buses(name)),booking_seats(seat_number)').order('created_at',{ascending:false}),
      client.from('trips').select('id,origin,destination,departure_at,fare,status,buses(name,operator,bus_type)').order('departure_at')
    ]);
    for(const result of [people,bookings,trips]) if(result.error){notice('Could not load admin data. Run admin_and_sample_buses.sql in Supabase first.');return;}
    $('#admin-users-count').textContent=people.data.length;$('#admin-bookings-count').textContent=bookings.data.length;$('#admin-trips-count').textContent=trips.data.length;
    for(const u of people.data){const tr=document.createElement('tr');tr.innerHTML=`<td>${escapeHtml(u.full_name||'Traveler')}</td><td>${escapeHtml(u.email||'')}</td><td>${new Date(u.created_at).toLocaleDateString()}</td>`;$('#admin-users').append(tr);}
    for(const b of bookings.data){const t=b.trips;if(!t)continue;const tr=document.createElement('tr');tr.innerHTML=`<td>${escapeHtml(b.booking_code)}</td><td>${escapeHtml(b.profiles?.full_name||'Traveler')}<small>${escapeHtml(b.profiles?.email||'')}</small></td><td>${escapeHtml(t.origin)} → ${escapeHtml(t.destination)}<small>${new Date(t.departure_at).toLocaleString()}</small></td><td>${(b.booking_seats||[]).map(x=>x.seat_number).join(', ')}</td><td>${escapeHtml(b.status)} · ₹${Number(b.total_amount).toLocaleString('en-IN')}</td>`;$('#admin-bookings').append(tr);}
    for(const t of trips.data){const tr=document.createElement('tr');tr.innerHTML=`<td>${escapeHtml(t.buses?.name||'Bus')}<small>${escapeHtml(t.buses?.operator||'')} · ${escapeHtml(t.buses?.bus_type||'')}</small></td><td>${escapeHtml(t.origin)} → ${escapeHtml(t.destination)}</td><td>${new Date(t.departure_at).toLocaleString()}</td><td>₹${Number(t.fare).toLocaleString('en-IN')}</td><td>${escapeHtml(t.status)}</td>`;$('#admin-trips').append(tr);}
    $('#add-bus-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,v=Object.fromEntries(new FormData(form)),depart=new Date(`${v.travel_date}T${v.departure_time}`),arrive=new Date(depart.getTime()+Number(v.duration)*3600000),button=form.querySelector('button');button.disabled=true;const {data:bus,error:busError}=await client.from('buses').insert({name:v.bus_name,operator:v.operator,bus_type:v.bus_type,total_seats:Number(v.seats)}).select('id').single();if(busError){notice(busError.message);button.disabled=false;return;}const {error}=await client.from('trips').insert({bus_id:bus.id,origin:v.origin,destination:v.destination,departure_at:depart.toISOString(),arrival_at:arrive.toISOString(),fare:Number(v.fare)});if(error){notice(error.message);button.disabled=false;return;}location.reload();});
  }

  const authForm = $('#auth-form');
  if (authForm) authForm.addEventListener('submit', async e => {
    e.preventDefault(); const values = Object.fromEntries(new FormData(authForm)); const button = authForm.querySelector('button'); button.disabled = true;
    try {
      if (authForm.dataset.mode === 'signup') {
        if (values.password !== values.confirm_password) throw new Error('Your passwords do not match.');
        const { data, error } = await client.auth.signUp({ email: values.email, password: values.password, options: { data: { full_name: values.full_name } } }); if (error) throw error;
        if (data.session) location.href = 'index.html';
        else notice('Your account was created, but email confirmation is still enabled in Supabase. Turn off Confirm email in Authentication settings to sign in right away.', true);
      } else { const { error } = await client.auth.signInWithPassword({ email: values.email, password: values.password }); if (error) throw error; location.href = new URLSearchParams(location.search).get('next') || 'index.html'; }
    } catch (err) { notice(err.message); } finally { button.disabled = false; }
  });

  const adminLoginForm=$('#admin-login-form');
  if(adminLoginForm) adminLoginForm.addEventListener('submit',async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(adminLoginForm)),button=adminLoginForm.querySelector('button');button.disabled=true;try{const {error}=await client.auth.signInWithPassword({email:v.admin_id,password:v.password});if(error)throw error;const {data:{user}}=await client.auth.getUser();const {data,error:roleError}=await client.from('app_admins').select('user_id').eq('user_id',user.id).maybeSingle();if(roleError||!data){await client.auth.signOut();throw new Error('This account is not registered as the site administrator.');}location.href='admin.html';}catch(err){notice(err.message||'Could not sign in. Check the admin ID and password.');}finally{button.disabled=false;}});

  const contactForm = $('#contact-form');
  if (contactForm) contactForm.addEventListener('submit', async e => {
    e.preventDefault(); const values = Object.fromEntries(new FormData(contactForm));
    const button = contactForm.querySelector('button'); button.disabled = true;
    const { error } = await client.from('contact_messages').insert({
      first_name: values.first_name.trim(), last_name: values.last_name.trim(), email: values.email.trim(),
      phone: values.phone.trim() || null, country: values.country.trim(), city: values.city.trim() || null,
      subject: values.subject.trim(), message: values.message.trim()
    });
    const message = $('#contact-notice');
    if (error) { message.textContent = 'We could not send your message. Make sure you ran the latest supabase_setup.sql, then try again.'; message.className = 'notice error'; }
    else { message.textContent = 'Thank you! Your message has been sent to the TouristStar team.'; message.className = 'notice success'; contactForm.reset(); }
    button.disabled = false;
  });

  async function loadProfile(user) {
    if (!user) { location.href = 'login.html?next=profile.html'; return; }
    const form = $('#profile-form');
    const { data, error } = await client.from('profiles').select('full_name,phone').eq('id', user.id).single();
    if (error) { const msg=$('#profile-notice'); msg.textContent='Could not load your profile. Please refresh and try again.'; msg.className='notice error'; return; }
    form.elements.full_name.value = data.full_name || user.user_metadata?.full_name || '';
    form.elements.email.value = user.email || '';
    form.elements.phone.value = data.phone || '';
    form.addEventListener('submit', async e => {
      e.preventDefault(); const button=form.querySelector('button'); button.disabled=true;
      const {error:saveError}=await client.from('profiles').update({full_name:form.elements.full_name.value.trim(),phone:form.elements.phone.value.trim()||null,updated_at:new Date().toISOString()}).eq('id',user.id);
      const msg=$('#profile-notice'); msg.textContent=saveError?'Could not save your changes. Please try again.':'Your profile has been updated.'; msg.className=`notice ${saveError?'error':'success'}`; button.disabled=false;
    });
  }

  const search = $('#search-form');
  if (search) {
    const date = search.elements.travel_date; date.min = new Date().toISOString().slice(0,10);
    client.from('trips').select('origin,destination').eq('status','scheduled').then(({data}) => { const list = $('#cities'); (data || []).flatMap(x => [x.origin,x.destination]).filter((x,i,a)=>a.indexOf(x)===i).sort().forEach(city => { const option=document.createElement('option'); option.value=city; list.append(option); }); });
    $('#swap-cities')?.addEventListener('click', () => { const a=search.elements.origin,b=search.elements.destination; [a.value,b.value]=[b.value,a.value]; });
    search.addEventListener('submit', async e => { e.preventDefault(); $('#results').replaceChildren(); notice('Looking for available buses…', false); const v=Object.fromEntries(new FormData(search));
      const {data,error}=await client.from('trip_availability').select('id,origin,destination,departure_at,arrival_at,fare,available_seats,bus_name,operator,bus_type').ilike('origin',v.origin.trim()).ilike('destination',v.destination.trim()).gte('departure_at',`${v.travel_date}T00:00:00`).lt('departure_at',`${v.travel_date}T23:59:59`).eq('status','scheduled').order('departure_at');
      if(error){notice('Could not load buses. Make sure you have run supabase_setup.sql in your Supabase SQL editor.');return;} notice(data.length ? `${data.length} ${data.length===1?'journey':'journeys'} found` : 'No scheduled buses on this route and date. Try another date.', !data.length);
      for(const trip of data){ const card=document.createElement('article');card.className='trip-card';const dep=new Date(trip.departure_at),arr=new Date(trip.arrival_at); card.innerHTML=`<div><strong>${escapeHtml(trip.operator || trip.bus_name || 'Wayfare bus')}</strong><small>${escapeHtml(trip.bus_name || 'Bus service')} · ${escapeHtml(trip.bus_type || '')}</small></div><div><strong>${dep.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} — ${arr.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</strong><small>${escapeHtml(trip.origin)} → ${escapeHtml(trip.destination)}</small></div><div><strong class="trip-price">₹${Number(trip.fare).toLocaleString('en-IN')}</strong><small>${trip.available_seats} seats available</small></div><button data-book="${trip.id}">Book this bus →</button>`;$('#results').append(card); }
    });
    $('#results')?.addEventListener('click', e => { const btn=e.target.closest('[data-book]'); if(btn) location.href=`booking.html?trip=${encodeURIComponent(btn.dataset.book)}`; });
  }

  async function loadBookings(user) { const host=$('#booking-list'); if(!host)return; if(!user){host.innerHTML='<div class="empty"><h2>Sign in to see your bookings</h2><a class="primary-link" href="login.html">Sign in →</a></div>';return;} const {data,error}=await client.from('bookings').select('id,booking_code,status,total_amount,created_at,trips(origin,destination,departure_at,buses(name,operator)),booking_seats(seat_number)').order('created_at',{ascending:false}); if(error){notice(error.message);return;} if(!data?.length){host.innerHTML='<div class="empty"><h2>No journeys booked yet.</h2><a class="primary-link" href="index.html">Find your first bus →</a></div>';return;} for(const b of data){const row=document.createElement('article');row.className='booking-row';const t=b.trips;row.innerHTML=`<div><span class="eyebrow">${escapeHtml(b.booking_code)}</span><h2>${escapeHtml(t.origin)} → ${escapeHtml(t.destination)}</h2><p>${new Date(t.departure_at).toLocaleString()} · ${escapeHtml(t.buses?.name || 'Bus')}</p><p>Seats: ${b.booking_seats.map(x=>x.seat_number).join(', ')}</p></div><div class="booking-actions"><div class="booking-total">₹${Number(b.total_amount).toLocaleString('en-IN')}<small>${escapeHtml(b.status)}</small></div>${b.status==='confirmed'&&new Date(t.departure_at)>new Date()?`<button class="cancel-btn" data-cancel="${b.id}">Cancel ticket</button>`:''}</div>`;host.append(row);}host.addEventListener('click',async e=>{const btn=e.target.closest('[data-cancel]');if(!btn)return;btn.disabled=true;const {error}=await client.rpc('cancel_booking',{p_booking_id:btn.dataset.cancel});if(error){notice(error.message);btn.disabled=false;return;}location.reload();}); }
  const bookingForm=$('#booking-form'); if(bookingForm) initBooking(bookingForm);
  async function initBooking(form){const user=await userPromise;if(!user){location.href='login.html?next=booking.html'+location.search;return;} const id=new URLSearchParams(location.search).get('trip');if(!id){notice('Choose a bus from the search results first.');return;}const {data:trip,error}=await client.from('trips').select('*,buses(name,operator,total_seats)').eq('id',id).single();if(error){notice(error.message);return;}$('#trip-summary').innerHTML=`<span class="eyebrow">YOUR JOURNEY</span><h2>${escapeHtml(trip.origin)} → ${escapeHtml(trip.destination)}</h2><p>${escapeHtml(trip.buses?.operator || trip.buses?.name)} · ${new Date(trip.departure_at).toLocaleString()}</p><p>₹${Number(trip.fare).toLocaleString('en-IN')} per seat</p>`;const seats=$('#seat-grid');for(let n=1;n<=trip.buses.total_seats;n++){const label=document.createElement('label');label.className='seat';label.innerHTML=`<input type="checkbox" name="seats" value="${n}"><span>${n}</span>`;seats.append(label);}form.addEventListener('change',()=>{$('#total').textContent=`₹${Number(trip.fare)*form.querySelectorAll('[name=seats]:checked').length}`;});form.addEventListener('submit',async e=>{e.preventDefault();const selected=[...form.querySelectorAll('[name=seats]:checked')].map(x=>Number(x.value));if(!selected.length){notice('Choose at least one seat.');return;}const button=form.querySelector('button');button.disabled=true;const {data,error}=await client.rpc('create_booking',{p_trip_id:id,p_seat_numbers:selected});button.disabled=false;if(error){notice(error.message);return;}location.href=`tickets.html?booked=${encodeURIComponent(data)}`;});}
  function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
})();

