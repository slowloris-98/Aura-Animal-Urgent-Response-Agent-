document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reportForm');
    const getLocationBtn = document.getElementById('getLocationBtn');
    const locationStatus = document.getElementById('locationStatus');
    const latInput = document.getElementById('latInput');
    const lngInput = document.getElementById('lngInput');
    const resultsArea = document.getElementById('resultsArea');
    const responseText = document.getElementById('responseText');
    const submitBtn = document.getElementById('submitBtn');

    // Geolocation handler
    getLocationBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            locationStatus.textContent = 'Geolocation is not supported by your browser.';
            locationStatus.className = 'text-xs text-red-500 text-center mt-1';
            return;
        }

        locationStatus.textContent = 'Locating...';
        locationStatus.className = 'text-xs text-gray-500 text-center mt-1';

        navigator.geolocation.getCurrentPosition(
            (position) => {
                latInput.value = position.coords.latitude;
                lngInput.value = position.coords.longitude;
                locationStatus.textContent = `Location captured: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
                locationStatus.className = 'text-xs text-green-600 text-center mt-1 font-medium';
            },
            (error) => {
                console.error('Error getting location:', error);
                locationStatus.textContent = 'Unable to retrieve location. Please check permissions.';
                locationStatus.className = 'text-xs text-red-500 text-center mt-1';
            }
        );
    });

    // Form submission handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const description = document.getElementById('descriptionInput').value;
        const imageFile = document.getElementById('imageInput').files[0];
        const lat = latInput.value;
        const lng = lngInput.value;

        if (!lat || !lng) {
            alert('Please capture your location first to help the response team find the animal.');
            return;
        }

        // Show loading state
        resultsArea.classList.remove('hidden');
        responseText.innerHTML = '<span class="animate-pulse text-emerald-600 font-medium">Analyzing with Aura AI...</span>';
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

        const formData = new FormData();
        formData.append('description', description);
        formData.append('latitude', lat);
        formData.append('longitude', lng);
        if (imageFile) {
            formData.append('image', imageFile);
        }

        try {
            // Pointing to our FastAPI backend
            const response = await fetch('http://localhost:8000/api/report', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            if (response.ok && result.status === 'success') {
                const analysis = result.analysis;
                const severityColors = {
                    'Low': 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    'Medium': 'bg-orange-100 text-orange-800 border-orange-200',
                    'High': 'bg-red-100 text-red-800 border-red-200',
                    'Critical': 'bg-red-600 text-white border-red-700 font-bold'
                };
                
                const sevColor = severityColors[analysis.severity] || severityColors['Medium'];

                let tipsHtml = analysis.tips.map(tip => `<li class="flex items-start gap-2"><svg class="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span>${tip}</span></li>`).join('');

                responseText.innerHTML = `
                    <div class="space-y-4">
                        <!-- Header / Classification -->
                        <div class="flex items-center justify-between border-b pb-3">
                            <div>
                                <h4 class="font-bold text-gray-800 text-lg">${analysis.classification}</h4>
                                <p class="text-xs text-gray-500">AI Classification</p>
                            </div>
                            <span class="px-3 py-1 rounded-full text-xs border uppercase tracking-wider ${sevColor}">${analysis.severity} SEVERITY</span>
                        </div>

                        <!-- Routing Alert -->
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
                            <div class="bg-blue-100 p-2 rounded-full mt-1">
                                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                            </div>
                            <div>
                                <p class="text-sm font-semibold text-blue-900">Authorities Notified</p>
                                <p class="text-xs text-blue-700 mt-1">Initiated protocol: <strong>${analysis.routing}</strong> near location (${result.data.location.lat.toFixed(3)}, ${result.data.location.lng.toFixed(3)}).</p>
                            </div>
                        </div>

                        <!-- First Aid Tips -->
                        <div class="pt-2">
                            <p class="text-sm font-bold text-gray-700 mb-2">Immediate Safety Steps:</p>
                            <ul class="text-sm text-gray-600 space-y-2">
                                ${tipsHtml}
                            </ul>
                            <p class="text-xs text-gray-400 italic mt-3">⚠️ AI generated tips. Prioritize your personal safety at all times.</p>
                        </div>
                    </div>
                `;
            } else {
                 responseText.innerHTML = '<span class="text-red-500 font-medium">Server processed the request but returned an error. Check logs.</span>';
            }
            
        } catch (error) {
            console.error('Submission error:', error);
            responseText.innerHTML = '<span class="text-red-500 font-medium">Error connecting to the server. Please ensure the backend is running.</span>';
        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
});