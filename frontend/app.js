(() => {
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
  });

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
