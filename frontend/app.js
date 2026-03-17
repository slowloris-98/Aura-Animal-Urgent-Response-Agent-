document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ──────────────────────────────────────────────
  const form            = document.getElementById('reportForm');
  const submitBtn       = document.getElementById('submitBtn');
  const imageInput      = document.getElementById('imageInput');
  const uploadZone      = document.getElementById('uploadZone');
  const uploadDefault   = document.getElementById('uploadDefault');
  const uploadPreview   = document.getElementById('uploadPreview');
  const previewImg      = document.getElementById('previewImg');
  const previewName     = document.getElementById('previewName');
  const getLocationBtn  = document.getElementById('getLocationBtn');
  const locationBtnText = document.getElementById('locationBtnText');
  const locationSuccess = document.getElementById('locationSuccess');
  const locationText    = document.getElementById('locationText');
  const locationError   = document.getElementById('locationError');
  const locationErrorText = document.getElementById('locationErrorText');
  const latInput        = document.getElementById('latInput');
  const lngInput        = document.getElementById('lngInput');
  const reportSection   = document.getElementById('reportSection');
  const loadingSection  = document.getElementById('loadingSection');
  const resultsSection  = document.getElementById('resultsSection');

  // ── Scroll helpers (called from HTML onclick) ─────────────
  window.scrollToReport = () =>
    document.getElementById('reportSection').scrollIntoView({ behavior: 'smooth' });

  window.scrollToHowItWorks = () =>
    document.getElementById('howItWorksSection').scrollIntoView({ behavior: 'smooth' });

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

  // Drag-and-drop
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

  // ── Geolocation ───────────────────────────────────────────
  getLocationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showLocError('Geolocation is not supported by your browser.');
      return;
    }
    locationBtnText.textContent = 'Locating…';
    getLocationBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        latInput.value = pos.coords.latitude;
        lngInput.value = pos.coords.longitude;
        locationBtnText.textContent = 'Location Captured ✓';
        getLocationBtn.style.background = 'linear-gradient(135deg, #276749, #166534)';
        getLocationBtn.disabled = false;
        locationText.textContent =
          `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
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

    // Reset all
    steps.forEach(({ icon, text }) => {
      icon.className = 'w-7 h-7 rounded-full border-2 border-slate-200 flex items-center justify-center flex-shrink-0 transition-all';
      icon.innerHTML = '<div class="w-2 h-2 bg-slate-300 rounded-full"></div>';
      text.className = 'text-sm text-slate-500 transition-colors';
    });

    steps.forEach(({ icon, text }, i) => {
      setTimeout(() => {
        // Activate current
        icon.className = 'w-7 h-7 rounded-full border-2 border-teal-400 flex items-center justify-center flex-shrink-0 transition-all';
        icon.innerHTML = SPIN_SVG;
        text.className = 'text-sm text-teal-600 font-semibold transition-colors';

        // Mark previous done
        if (i > 0) {
          const prev = steps[i - 1];
          prev.icon.className = 'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all';
          prev.icon.style.background = 'linear-gradient(135deg,#276749,#166534)';
          prev.icon.innerHTML = CHECK_SVG;
          prev.text.className = 'text-sm text-green-800 font-medium transition-colors';
        }

        // Mark last done after delay
        if (i === steps.length - 1) {
          setTimeout(() => {
            icon.className = 'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all';
            icon.style.background = 'linear-gradient(135deg,#276749,#166534)';
            icon.innerHTML = CHECK_SVG;
            text.className = 'text-sm text-green-800 font-medium transition-colors';
          }, 1100);
        }
      }, i * 1200);
    });
  }

  // ── Severity config ───────────────────────────────────────
  const SEV = {
    Low: {
      badgeClass:   'sev-low',
      routingBg:    '#F0FDF4',
      routingBorder:'#BBF7D0',
      iconGradient: 'linear-gradient(135deg,#276749,#166534)',
      labelColor:   '#166534',
      textColor:    '#14532D',
      locColor:     '#166534',
      pulse: false,
    },
    Medium: {
      badgeClass:   'sev-medium',
      routingBg:    '#FFFBEB',
      routingBorder:'#FDE68A',
      iconGradient: 'linear-gradient(135deg,#B45309,#92400E)',
      labelColor:   '#92400E',
      textColor:    '#78350F',
      locColor:     '#B45309',
      pulse: false,
    },
    High: {
      badgeClass:   'sev-high',
      routingBg:    '#FFF7ED',
      routingBorder:'#FDBA74',
      iconGradient: 'linear-gradient(135deg,#C05621,#9A3412)',
      labelColor:   '#9A3412',
      textColor:    '#7C2D12',
      locColor:     '#C05621',
      pulse: false,
    },
    Critical: {
      badgeClass:   'sev-critical pulse-ring',
      routingBg:    '#FEF2F2',
      routingBorder:'#FECACA',
      iconGradient: 'linear-gradient(135deg,#B91C1C,#7F1D1D)',
      labelColor:   '#991B1B',
      textColor:    '#7F1D1D',
      locColor:     '#B91C1C',
      pulse: true,
    },
  };


  // ── Animal emoji map ──────────────────────────────────────
  function animalEmoji(classification) {
    const c = classification.toLowerCase();
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
    if (c.includes('pig'))    return '🐷';
    if (c.includes('monkey')) return '🐒';
    return '🐾';
  }

  // ── Render results ────────────────────────────────────────
  function renderResults(analysis, resultData) {
    const sev    = analysis.severity || 'Medium';
    const config = SEV[sev] || SEV.Medium;

    // Timestamp
    document.getElementById('resultTimestamp').textContent =
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Classification
    document.getElementById('classificationText').textContent = analysis.classification;
    document.getElementById('animalEmoji').textContent = animalEmoji(analysis.classification);

    // Severity badge
    document.getElementById('severityBadge').innerHTML = `
      <span class="relative inline-flex items-center gap-1.5 ${config.badgeClass} text-white text-[0.7rem] font-black px-3 py-1.5 rounded-full uppercase tracking-wider">
        <span class="w-1.5 h-1.5 bg-white rounded-full ${config.pulse ? 'animate-pulse' : ''}"></span>
        ${sev}
      </span>`;

    // Routing card
    const rc = document.getElementById('routingCard');
    rc.style.background    = config.routingBg;
    rc.style.borderColor   = config.routingBorder;

    const ri = document.getElementById('routingIcon');
    ri.style.background = config.iconGradient;

    document.getElementById('routingLabel').style.color = config.labelColor;
    document.getElementById('routingLabel').textContent = 'Rescue Protocol Initiated';

    document.getElementById('routingText').style.color = config.textColor;
    document.getElementById('routingText').textContent = analysis.routing;

    document.getElementById('routingLocation').style.color = config.locColor;
    document.getElementById('routingLocation').textContent =
      resultData.location.lat && resultData.location.lng
        ? `Near coordinates: ${resultData.location.lat.toFixed(4)}, ${resultData.location.lng.toFixed(4)}`
        : 'Location not provided';

    // Tips
    document.getElementById('tipsContainer').innerHTML = analysis.tips.map((tip, i) => `
      <div class="tip-item flex items-start gap-3 bg-teal-50 border border-teal-100 rounded-2xl p-3.5">
        <span class="w-7 h-7 flex-shrink-0 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm" style="background:linear-gradient(135deg,#14B8A6,#0D9488)">${i + 1}</span>
        <p class="text-sm text-teal-800 leading-relaxed pt-0.5">${tip}</p>
      </div>`).join('');

    showSection(resultsSection);
  }

  // ── Toast helper ──────────────────────────────────────────
  function showToast(message, isError = true) {
    const toast = document.createElement('div');
    toast.className =
      `toast fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white max-w-[90vw] text-center ${isError ? 'bg-red-600' : 'bg-emerald-600'}`;
    toast.innerHTML = isError
      ? `<svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
           <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
         </svg>${message}`
      : `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
         </svg>${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity .3s';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  // ── Reset form ────────────────────────────────────────────
  window.resetForm = () => {
    form.reset();
    latInput.value = '';
    lngInput.value = '';
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
    const lat         = latInput.value;
    const lng         = lngInput.value;

    if (!description) {
      document.getElementById('descriptionInput').focus();
      showToast('Please describe what you see before submitting.');
      return;
    }

    if (!lat || !lng) {
      showLocError('Please share your location before submitting.');
      getLocationBtn.classList.add('animate-pulse');
      setTimeout(() => getLocationBtn.classList.remove('animate-pulse'), 1500);
      return;
    }

    // Show loading
    showSection(loadingSection);
    animateSteps();

    const formData = new FormData();
    formData.append('description', description);
    formData.append('latitude',    lat);
    formData.append('longitude',   lng);
    if (imageFile) formData.append('image', imageFile);

    // Minimum display time for the loading animation to feel intentional
    const minWait = new Promise(res => setTimeout(res, 3800));

    try {
      const [response] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/report', { method: 'POST', body: formData }),
        minWait,
      ]);
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        currentIncidentContext = `Description: ${description}. Classification: ${result.analysis.classification}. Severity: ${result.analysis.severity}. Routing: ${result.analysis.routing}.`;
        renderResults(result.analysis, result.data);
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

});
