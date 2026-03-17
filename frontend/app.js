document.addEventListener('DOMContentLoaded', () => {

  const API = 'http://127.0.0.1:8000';

  // ── DOM refs ──────────────────────────────────────────────
  const form             = document.getElementById('reportForm');
  const submitBtn        = document.getElementById('submitBtn');
  const imageInput       = document.getElementById('imageInput');
  const uploadZone       = document.getElementById('uploadZone');
  const uploadDefault    = document.getElementById('uploadDefault');
  const uploadPreview    = document.getElementById('uploadPreview');
  const previewImg       = document.getElementById('previewImg');
  const previewName      = document.getElementById('previewName');
  const getLocationBtn   = document.getElementById('getLocationBtn');
  const locationBtnText  = document.getElementById('locationBtnText');
  const locationSuccess  = document.getElementById('locationSuccess');
  const locationText     = document.getElementById('locationText');
  const locationError    = document.getElementById('locationError');
  const locationErrorText= document.getElementById('locationErrorText');
  const latInput         = document.getElementById('latInput');
  const lngInput         = document.getElementById('lngInput');
  const reportSection    = document.getElementById('reportSection');
  const loadingSection   = document.getElementById('loadingSection');
  const resultsSection   = document.getElementById('resultsSection');

  // Geo state
  let capturedLat = null;
  let capturedLng = null;
  let geoContext  = '';
  let nominatimData = null;
  let resultMapInstance = null;

  // ── Scroll helpers ────────────────────────────────────────
  window.scrollToReport      = () => document.getElementById('reportSection').scrollIntoView({ behavior: 'smooth' });
  window.scrollToHowItWorks  = () => document.getElementById('howItWorksSection').scrollIntoView({ behavior: 'smooth' });

  // ── Image upload ──────────────────────────────────────────
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      previewImg.src = evt.target.result;
      previewName.textContent = file.name;
      uploadDefault.classList.add('hidden');
      uploadPreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  window.clearImage = (e) => {
    e.stopPropagation();
    imageInput.value = '';
    uploadDefault.classList.remove('hidden');
    uploadPreview.classList.add('hidden');
  };

  uploadZone.addEventListener('dragover',  (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', ()  => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const dt = new DataTransfer();
      dt.items.add(file);
      imageInput.files = dt.files;
      imageInput.dispatchEvent(new Event('change'));
    }
  });

  // ── Geo-risk analysis from Nominatim reverse geocode ──────
  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      nominatimData = await res.json();
      return nominatimData;
    } catch {
      return null;
    }
  }

  function buildGeoContext(data, lat, lng) {
    if (!data || !data.address) return `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const a = data.address;
    const risks = [];

    // Road / highway risk
    const roadTag = (data.type || data.category || '');
    if (a.road || roadTag.includes('road') || roadTag.includes('highway') ||
        (a.road && /highway|motorway|trunk|primary|secondary/i.test(a.road))) {
      risks.push({ label: '🚗 Road proximity', detail: 'traffic danger — risk of repeated collision' });
    }

    // Water risk
    if (a.water || a.river || a.lake || a.stream || a.bay ||
        (data.display_name || '').toLowerCase().match(/river|lake|canal|reservoir|pond|creek/)) {
      risks.push({ label: '💧 Near water', detail: 'drowning risk — do not enter water' });
    }

    // Trail / park / forest → wildlife
    if (a.nature_reserve || a.forest || a.park || a.leisure === 'park' ||
        (data.display_name || '').toLowerCase().match(/forest|nature|reserve|trail|woods/)) {
      risks.push({ label: '🌿 Natural/trail area', detail: 'higher wildlife probability — possible wild animal' });
    }

    // Urban / domestic
    const isUrban = a.city || a.town || a.suburb || a.neighbourhood;
    if (isUrban && risks.length === 0) {
      risks.push({ label: '🏙️ Urban area', detail: 'likely domestic pet — check for collar/microchip' });
    }

    const address = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const riskText = risks.map(r => `${r.label}: ${r.detail}`).join('. ');
    return `Location: ${address}. ${riskText ? 'Environmental risks — ' + riskText + '.' : ''}`;
  }

  function buildGeoPills(data) {
    if (!data || !data.address) return [];
    const a = data.address;
    const pills = [];

    if (a.road || (a.road && /highway|motorway|trunk|primary|secondary/i.test(a.road))) {
      pills.push({ icon: '🚗', label: 'Road nearby', color: 'bg-red-100 text-red-700 border border-red-200' });
    }
    if (a.water || a.river || a.lake ||
        (data.display_name || '').toLowerCase().match(/river|lake|canal|reservoir|pond/)) {
      pills.push({ icon: '💧', label: 'Near water', color: 'bg-blue-100 text-blue-700 border border-blue-200' });
    }
    if (a.nature_reserve || a.forest || a.park ||
        (data.display_name || '').toLowerCase().match(/forest|nature|reserve|trail/)) {
      pills.push({ icon: '🌿', label: 'Natural area', color: 'bg-green-100 text-green-700 border border-green-200' });
    }
    if ((a.city || a.town || a.suburb) && pills.length === 0) {
      pills.push({ icon: '🏙️', label: 'Urban zone', color: 'bg-teal-100 text-teal-700 border border-teal-200' });
    }
    return pills;
  }

  // ── Geolocation ───────────────────────────────────────────
  getLocationBtn.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      showLocError('Geolocation is not supported by your browser.');
      return;
    }
    locationBtnText.textContent = 'Locating…';
    getLocationBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        capturedLat = pos.coords.latitude;
        capturedLng = pos.coords.longitude;
        latInput.value = capturedLat;
        lngInput.value = capturedLng;

        // Reverse geocode for geo-risk
        locationBtnText.textContent = 'Analysing area…';
        const geo = await reverseGeocode(capturedLat, capturedLng);
        geoContext = buildGeoContext(geo, capturedLat, capturedLng);

        locationBtnText.textContent = 'Location Captured ✓';
        getLocationBtn.style.background = 'linear-gradient(135deg, #276749, #166534)';
        getLocationBtn.disabled = false;

        const shortAddr = geo?.address
          ? [geo.address.road, geo.address.suburb || geo.address.city || geo.address.town].filter(Boolean).join(', ')
          : `${capturedLat.toFixed(4)}, ${capturedLng.toFixed(4)}`;
        locationText.textContent = `📍 ${shortAddr}`;
        locationSuccess.classList.remove('hidden');
        locationSuccess.classList.add('flex');
        locationError.classList.add('hidden');
      },
      () => {
        locationBtnText.textContent = 'Share My Location';
        getLocationBtn.disabled = false;
        getLocationBtn.style.background = '';
        showLocError('Unable to retrieve location. Check browser permissions.');
      }
    );
  });

  function showLocError(msg) {
    locationErrorText.textContent = msg;
    locationError.classList.remove('hidden');
    locationError.classList.add('flex');
    locationSuccess.classList.add('hidden');
  }

  // ── Section visibility ────────────────────────────────────
  function showSection(section) {
    [reportSection, loadingSection, resultsSection].forEach(s => s.classList.add('hidden'));
    section.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth' });
  }

  // ── Loading step animation ────────────────────────────────
  const CHECK_SVG = `<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
  </svg>`;
  const SPIN_SVG = `<svg class="w-3.5 h-3.5 spin" style="color:#14B8A6" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
    <path class="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>`;

  function animateSteps() {
    const steps = [
      { icon: document.getElementById('step1Icon'), text: document.getElementById('step1Text') },
      { icon: document.getElementById('step2Icon'), text: document.getElementById('step2Text') },
      { icon: document.getElementById('step3Icon'), text: document.getElementById('step3Text') },
    ];
    steps.forEach(({ icon, text }) => {
      icon.className = 'w-7 h-7 rounded-full border-2 border-teal-200 flex items-center justify-center flex-shrink-0 transition-all';
      icon.innerHTML = '<div class="w-2 h-2 bg-teal-200 rounded-full"></div>';
      icon.style.background = '';
      text.className = 'text-sm text-teal-500 transition-colors';
    });

    steps.forEach(({ icon, text }, i) => {
      setTimeout(() => {
        icon.className = 'w-7 h-7 rounded-full border-2 border-teal-400 flex items-center justify-center flex-shrink-0 transition-all';
        icon.innerHTML = SPIN_SVG;
        text.className = 'text-sm text-teal-600 font-semibold transition-colors';

        if (i > 0) {
          const prev = steps[i - 1];
          prev.icon.style.background = 'linear-gradient(135deg,#276749,#166534)';
          prev.icon.className = 'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all';
          prev.icon.innerHTML = CHECK_SVG;
          prev.text.className = 'text-sm text-green-800 font-medium transition-colors';
        }

        if (i === steps.length - 1) {
          setTimeout(() => {
            icon.style.background = 'linear-gradient(135deg,#276749,#166534)';
            icon.className = 'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all';
            icon.innerHTML = CHECK_SVG;
            text.className = 'text-sm text-green-800 font-medium transition-colors';
          }, 1100);
        }
      }, i * 1200);
    });
  }

  // ── Severity config ───────────────────────────────────────
  const SEV = {
    Low:      { badgeClass:'sev-low',      routingBg:'#F0FDF4', routingBorder:'#BBF7D0', iconGradient:'linear-gradient(135deg,#276749,#166534)', labelColor:'#166534', textColor:'#14532D', locColor:'#166534', pulse:false },
    Medium:   { badgeClass:'sev-medium',   routingBg:'#FFFBEB', routingBorder:'#FDE68A', iconGradient:'linear-gradient(135deg,#B45309,#92400E)', labelColor:'#92400E', textColor:'#78350F', locColor:'#B45309', pulse:false },
    High:     { badgeClass:'sev-high',     routingBg:'#FFF7ED', routingBorder:'#FDBA74', iconGradient:'linear-gradient(135deg,#C05621,#9A3412)', labelColor:'#9A3412', textColor:'#7C2D12', locColor:'#C05621', pulse:false },
    Critical: { badgeClass:'sev-critical pulse-ring', routingBg:'#FEF2F2', routingBorder:'#FECACA', iconGradient:'linear-gradient(135deg,#B91C1C,#7F1D1D)', labelColor:'#991B1B', textColor:'#7F1D1D', locColor:'#B91C1C', pulse:true },
  };

  // ── Animal emoji ──────────────────────────────────────────
  function animalEmoji(c) {
    c = c.toLowerCase();
    if (c.includes('dog'))    return '🐕';
    if (c.includes('cat'))    return '🐈';
    if (c.includes('bird'))   return '🐦';
    if (c.includes('rabbit')) return '🐇';
    if (c.includes('snake'))  return '🐍';
    if (c.includes('deer'))   return '🦌';
    if (c.includes('fox'))    return '🦊';
    if (c.includes('bear'))   return '🐻';
    if (c.includes('horse'))  return '🐴';
    if (c.includes('turtle')) return '🐢';
    if (c.includes('fish'))   return '🐟';
    if (c.includes('cow'))    return '🐄';
    if (c.includes('zebra'))  return '🦓';
    if (c.includes('monkey')) return '🐒';
    if (c.includes('elephant'))return '🐘';
    if (c.includes('lion'))   return '🦁';
    return '🐾';
  }

  // ── Safety "don't" rules per animal type ─────────────────
  function getSafetyDonts(classification) {
    const c = (classification || '').toLowerCase();
    const universal = [
      { icon: '🍖', text: "Don't feed unknown wildlife — human food can be toxic or encourage dependency." },
      { icon: '🤸', text: "Don't move the animal if spinal injury is suspected — movement can worsen paralysis." },
      { icon: '👶', text: "Don't separate baby wildlife unless clearly abandoned — mothers are often nearby." },
    ];
    const specific = [];

    if (c.includes('bird') || c.includes('hawk') || c.includes('owl') || c.includes('eagle')) {
      specific.push({ icon: '🦅', text: "Don't touch birds of prey bare-handed — talons carry bacteria; use thick gloves or a towel." });
      specific.push({ icon: '🌫️', text: "Don't place in a sealed box — birds of prey need ventilation to avoid heat stress." });
    } else if (c.includes('snake')) {
      specific.push({ icon: '🐍', text: "Don't attempt to handle or restrain the snake — even seemingly dead snakes can bite reflexively." });
      specific.push({ icon: '🏃', text: "Don't block the snake's escape route — a cornered snake is a defensive snake." });
    } else if (c.includes('deer') || c.includes('fox') || c.includes('wolf') || c.includes('coyote') || c.includes('bear')) {
      specific.push({ icon: '🦌', text: "Don't approach large wildlife — they can charge or attack if they feel cornered." });
      specific.push({ icon: '💉', text: "Don't handle without reporting first — wild animals may carry rabies or other zoonotic diseases." });
    } else if (c.includes('cat') || c.includes('dog')) {
      specific.push({ icon: '🐾', text: "Don't restrain an injured domestic animal forcibly — pain can trigger biting even in friendly pets." });
      specific.push({ icon: '🚗', text: "Don't transport without a carrier if possible — a loose injured animal in a car is a safety risk." });
    }

    return [...specific, ...universal].slice(0, 4);
  }

  // ── Render results ────────────────────────────────────────
  function renderResults(analysis, resultData) {
    const sev    = analysis.severity || 'Medium';
    const config = SEV[sev] || SEV.Medium;

    document.getElementById('resultTimestamp').textContent =
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Classification
    document.getElementById('classificationText').textContent = analysis.classification;
    document.getElementById('animalEmoji').textContent = animalEmoji(analysis.classification);

    // Severity badge
    document.getElementById('severityBadge').innerHTML = `
      <span class="relative inline-flex items-center gap-1.5 ${config.badgeClass} text-white text-[0.7rem] font-black px-3 py-1.5 rounded-full uppercase tracking-wider">
        <span class="w-1.5 h-1.5 bg-white rounded-full ${config.pulse ? 'animate-pulse' : ''}"></span>${sev}
      </span>`;

    // Urgency reason
    if (analysis.urgency_reason) {
      document.getElementById('urgencyReasonText').textContent = analysis.urgency_reason;
      const pillsEl = document.getElementById('geoRiskPills');
      const pills = buildGeoPills(nominatimData);
      pillsEl.innerHTML = pills.map(p =>
        `<span class="geo-pill ${p.color}">${p.icon} ${p.label}</span>`
      ).join('');
      document.getElementById('urgencyCard').classList.remove('hidden');
    }

    // Routing card
    const rc = document.getElementById('routingCard');
    rc.style.background   = config.routingBg;
    rc.style.borderColor  = config.routingBorder;
    document.getElementById('routingIcon').style.background = config.iconGradient;
    document.getElementById('routingLabel').style.color = config.labelColor;
    document.getElementById('routingLabel').textContent = 'Rescue Protocol Initiated';
    document.getElementById('routingText').style.color = config.textColor;
    document.getElementById('routingText').textContent  = analysis.routing;
    document.getElementById('routingLocation').style.color = config.locColor;
    document.getElementById('routingLocation').textContent =
      resultData.location.lat && resultData.location.lng
        ? `Coordinates: ${resultData.location.lat.toFixed(4)}, ${resultData.location.lng.toFixed(4)}`
        : 'Location not provided';

    // Map
    if (resultData.location.lat && resultData.location.lng) {
      const mapCard = document.getElementById('mapCard');
      mapCard.classList.remove('hidden');
      // Short address chip
      const shortAddr = nominatimData?.display_name
        ? nominatimData.display_name.split(',').slice(0, 3).join(', ')
        : `${resultData.location.lat.toFixed(4)}, ${resultData.location.lng.toFixed(4)}`;
      document.getElementById('mapAddressChip').textContent = shortAddr;

      // Init or update Leaflet map
      setTimeout(() => {
        if (resultMapInstance) {
          resultMapInstance.remove();
          resultMapInstance = null;
        }
        resultMapInstance = L.map('resultMap').setView(
          [resultData.location.lat, resultData.location.lng], 15
        );
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(resultMapInstance);

        const color = sev === 'Critical' ? '#B91C1C' : sev === 'High' ? '#C05621' : sev === 'Medium' ? '#B45309' : '#276749';
        const marker = L.circleMarker([resultData.location.lat, resultData.location.lng], {
          radius: 12, fillColor: color, color: '#fff', weight: 3,
          opacity: 1, fillOpacity: 0.85
        }).addTo(resultMapInstance);
        marker.bindPopup(`<b>${analysis.classification}</b><br/>Severity: ${sev}`).openPopup();
      }, 150);
    }

    // Tips
    document.getElementById('tipsContainer').innerHTML = analysis.tips.map((tip, i) => `
      <div class="tip-item flex items-start gap-3 bg-teal-50 border border-teal-100 rounded-2xl p-3.5">
        <span class="w-7 h-7 flex-shrink-0 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm" style="background:linear-gradient(135deg,#14B8A6,#0D9488)">${i + 1}</span>
        <p class="text-sm text-teal-800 leading-relaxed pt-0.5">${tip}</p>
      </div>`).join('');

    // Safety don'ts
    const donts = getSafetyDonts(analysis.classification);
    document.getElementById('dontsContainer').innerHTML = donts.map(d => `
      <div class="dont-item flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-3.5">
        <span class="text-xl flex-shrink-0 mt-0.5">${d.icon}</span>
        <p class="text-xs text-red-800 leading-relaxed font-medium">${d.text}</p>
      </div>`).join('');

    showSection(resultsSection);
  }

  // ── Toast ─────────────────────────────────────────────────
  function showToast(message, isError = true) {
    const toast = document.createElement('div');
    toast.className = `toast fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white max-w-[90vw] ${isError ? 'bg-red-600' : 'bg-emerald-600'}`;
    toast.innerHTML = isError
      ? `<svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>${message}`
      : `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>${message}`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.transition = 'opacity .3s'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4500);
  }

  // ── Reset ─────────────────────────────────────────────────
  window.resetForm = () => {
    form.reset();
    capturedLat = capturedLng = null;
    geoContext = '';
    nominatimData = null;
    latInput.value = lngInput.value = '';
    locationBtnText.textContent = 'Share My Location';
    getLocationBtn.style.background = '';
    getLocationBtn.disabled = false;
    locationSuccess.classList.add('hidden');
    locationError.classList.add('hidden');
    uploadDefault.classList.remove('hidden');
    uploadPreview.classList.add('hidden');
    
    // Reset chat
    currentIncidentContext = "";
    chatMessagesHistory = [];
    document.getElementById('chatMessages').innerHTML = '<div class="text-teal-600 italic text-center text-xs my-4">Chat started</div>';
    
    document.getElementById('urgencyCard').classList.add('hidden');
    document.getElementById('mapCard').classList.add('hidden');
    if (resultMapInstance) { resultMapInstance.remove(); resultMapInstance = null; }
    showSection(reportSection);
  };

  // ── Form submit ───────────────────────────────────────────
  let currentIncidentContext = "";
  let chatMessagesHistory = [];

  window.handleChatSubmit = async (e) => {
    e.preventDefault();
    const chatInput = document.getElementById('chatInput');
    const msgText = chatInput.value.trim();
    if (!msgText) return;

    chatInput.value = '';
    addChatMessage('user', msgText);
    
    // Disable input while generating
    const submitBtn = document.getElementById('chatSubmitBtn');
    submitBtn.disabled = true;
    chatInput.disabled = true;

    try {
      const response = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_context: currentIncidentContext,
          messages: chatMessagesHistory
        })
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        addChatMessage('assistant', result.reply);
      } else {
        showToast('Chat error: ' + (result.detail || 'Internal server error'));
      }
    } catch (err) {
      console.error('Chat error:', err);
      showToast('Could not connect to the chat service.');
    } finally {
      submitBtn.disabled = false;
      chatInput.disabled = false;
      chatInput.focus();
    }
  };

  function addChatMessage(role, content) {
    chatMessagesHistory.push({ role, content });
    const chatMessagesDiv = document.getElementById('chatMessages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
    
    const innerDiv = document.createElement('div');
    if (role === 'user') {
      innerDiv.className = `max-w-[85%] p-3 rounded-2xl bg-teal-600 text-white rounded-tr-sm`;
      innerDiv.textContent = content;
    } else {
      innerDiv.className = `max-w-[85%] p-3 rounded-2xl bg-white border border-teal-100 text-teal-900 rounded-tl-sm shadow-sm prose prose-sm prose-teal max-w-none`;
      // Use marked.js to render Markdown from the LLM
      innerDiv.innerHTML = marked.parse(content);
    }
    
    msgDiv.appendChild(innerDiv);
    chatMessagesDiv.appendChild(msgDiv);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const description = document.getElementById('descriptionInput').value.trim();
    const imageFile   = imageInput.files[0];

    if (!description) {
      document.getElementById('descriptionInput').focus();
      showToast('Please describe what you see before submitting.');
      return;
    }
    if (!capturedLat || !capturedLng) {
      showLocError('Please share your location before submitting.');
      getLocationBtn.classList.add('animate-pulse');
      setTimeout(() => getLocationBtn.classList.remove('animate-pulse'), 1500);
      return;
    }

    showSection(loadingSection);
    animateSteps();

    const formData = new FormData();
    formData.append('description', description);
    formData.append('latitude',    capturedLat);
    formData.append('longitude',   capturedLng);
    formData.append('geo_context', geoContext);
    if (imageFile) formData.append('image', imageFile);

    const minWait = new Promise(res => setTimeout(res, 3800));

    try {
      const [response] = await Promise.all([
        fetch(`${API}/api/report`, { method: 'POST', body: formData }),
        minWait,
      ]);
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        currentIncidentContext = `Description: ${description}. Classification: ${result.analysis.classification}. Severity: ${result.analysis.severity}. Routing: ${result.analysis.routing}.`;
        renderResults(result.analysis, result.data);
        // Refresh analytics in the background
        setTimeout(loadAnalytics, 500);
      } else {
        showSection(reportSection);
        showToast(result.detail || 'The server returned an error. Please try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      await minWait;
      showSection(reportSection);
      showToast('Could not connect to the backend. Make sure the server is running on port 8000.');
    }
  });


  // ════════════════════════════════════════════════════════
  //  ANALYTICS DASHBOARD
  // ════════════════════════════════════════════════════════

  let analyticsMapInstance = null;
  let hourChartInstance    = null;
  let classChartInstance   = null;

  const SEV_COLORS = {
    Critical: '#B91C1C',
    High:     '#C05621',
    Medium:   '#B45309',
    Low:      '#276749',
  };

  window.loadAnalytics = async () => {
    try {
      const res  = await fetch(`${API}/api/analytics`);
      const data = await res.json();

      if (!data.total) {
        document.getElementById('analyticsEmpty').classList.remove('hidden');
        document.getElementById('statsCards').classList.add('opacity-40');
        return;
      }

      document.getElementById('analyticsEmpty').classList.add('hidden');
      document.getElementById('statsCards').classList.remove('opacity-40');

      // Stat cards
      document.getElementById('statTotal').textContent    = data.total;
      document.getElementById('statCritical').textContent = data.severity_counts?.Critical || 0;

      const topAnimal = Object.entries(data.classification_counts || {})
        .sort((a, b) => b[1] - a[1])[0];
      document.getElementById('statTopAnimal').textContent =
        topAnimal ? topAnimal[0].split(' ')[0] : '—';

      const peakHour = Object.entries(data.hour_counts || {})
        .sort((a, b) => b[1] - a[1])[0];
      if (peakHour) {
        const h = parseInt(peakHour[0]);
        document.getElementById('statPeakHour').textContent =
          `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`;
      }

      // ── Hotspot map ──────────────────────────────────────
      if (!analyticsMapInstance) {
        const center = data.alerts.length > 0
          ? [data.alerts[0].lat, data.alerts[0].lng]
          : [20, 0];
        analyticsMapInstance = L.map('analyticsMap', { scrollWheelZoom: false })
          .setView(center, data.alerts.length > 0 ? 12 : 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(analyticsMapInstance);
      }

      // Clear old markers
      analyticsMapInstance.eachLayer(layer => {
        if (layer instanceof L.CircleMarker) analyticsMapInstance.removeLayer(layer);
      });

      const bounds = [];
      data.alerts.forEach(alert => {
        const color = SEV_COLORS[alert.severity] || '#0D9488';
        const m = L.circleMarker([alert.lat, alert.lng], {
          radius: 8, fillColor: color, color: '#fff',
          weight: 2, opacity: 1, fillOpacity: 0.75
        }).addTo(analyticsMapInstance);
        m.bindPopup(`<b>${alert.classification}</b><br/>Severity: ${alert.severity}<br/><small>${alert.timestamp?.slice(0,16) || ''}</small>`);
        bounds.push([alert.lat, alert.lng]);
      });

      if (bounds.length > 1) {
        analyticsMapInstance.fitBounds(bounds, { padding: [30, 30] });
      } else if (bounds.length === 1) {
        analyticsMapInstance.setView(bounds[0], 14);
      }

      // ── Hour chart ───────────────────────────────────────
      const hourLabels = Array.from({length: 24}, (_, i) => `${i === 0 ? 12 : i > 12 ? i - 12 : i}${i >= 12 ? 'p' : 'a'}`);
      const hourData   = Array.from({length: 24}, (_, i) => data.hour_counts[String(i)] || 0);

      if (hourChartInstance) hourChartInstance.destroy();
      hourChartInstance = new Chart(document.getElementById('hourChart'), {
        type: 'bar',
        data: {
          labels: hourLabels,
          datasets: [{
            data: hourData,
            backgroundColor: hourData.map(v => v === Math.max(...hourData) ? '#0D9488' : '#99F6E4'),
            borderRadius: 6,
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#5eead4' } },
            y: { grid: { color: '#f0fdfa' }, ticks: { font: { size: 10 }, color: '#5eead4', stepSize: 1 } }
          }
        }
      });

      // ── Classification chart ─────────────────────────────
      const classEntries = Object.entries(data.classification_counts || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 7);
      const classColors = ['#0D9488','#14B8A6','#2DD4BF','#5EEAD4','#99F6E4','#B45309','#C05621'];

      if (classChartInstance) classChartInstance.destroy();
      classChartInstance = new Chart(document.getElementById('classChart'), {
        type: 'doughnut',
        data: {
          labels: classEntries.map(e => e[0]),
          datasets: [{
            data: classEntries.map(e => e[1]),
            backgroundColor: classColors.slice(0, classEntries.length),
            borderWidth: 2,
            borderColor: '#fff',
          }]
        },
        options: {
          plugins: {
            legend: {
              position: 'right',
              labels: { font: { size: 11 }, color: '#0F766E', padding: 10, boxWidth: 12 }
            }
          },
          cutout: '60%',
        }
      });

    } catch (err) {
      console.warn('Analytics load failed:', err);
    }
  };

  // Auto-load analytics on page open
  loadAnalytics();
});
