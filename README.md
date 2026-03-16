# Aura AI - Animal Urgent Response Agent 🐾🚨

Aura is a mobile-first, AI-powered web application built for hackathons to help bystanders quickly and safely report distressed animals. Acting as an intelligent orchestrator, the application leverages the **NVIDIA Nemotron API** to analyze the situation, grade the severity, route the alert to the appropriate authority (e.g., local Wildlife NGO vs. Animal Control), and provide the user with safe, immediate first-aid instructions.

## 🚀 Features
* **Mobile-First Frontend**: Built with HTML5, Vanilla JavaScript, and Tailwind CSS.
* **Device APIs**: Seamless integration with HTML5 Geolocation (for accurate rescue routing) and Camera APIs (`capture="environment"`).
* **AI Orchestration**: Python FastAPI backend powered by the NVIDIA API (using `meta/llama-3.1-70b-instruct` or Nemotron models) to process reports using structured JSON prompting.
* **Real-time Triage**: Automatically determines the animal classification, emergency severity, action routing, and generates 3 actionable safety tips. 

---

## 🛠️ Tech Stack
* **Frontend**: HTML5, Tailwind CSS, JavaScript
* **Backend**: Python, FastAPI, Uvicorn
* **AI**: NVIDIA NIM (via `openai` Python SDK)

---

## 🏃‍♂️ Getting Started

### 1. Backend Setup

Open a terminal and navigate to the project root.

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure your Environment**:
   Navigate to the `backend` folder and open the `.env` file (or create one if it doesn't exist). Add your NVIDIA API key (which you can get from [build.nvidia.com](https://build.nvidia.com/)):
   ```env
   NVIDIA_API_KEY=your-nvidia-api-key-here
   ```

3. **Run the FastAPI server**:
   ```bash
   cd backend
   uvicorn main:app --reload
   ```
   *The server will start at `http://localhost:8000`.*

### 2. Frontend Setup

The frontend is built with pure HTML/JS and Tailwind CSS (via CDN), so there is no build step required!

1. Simply open the `frontend/index.html` file in your preferred web browser. 
   *(Tip: You can use VS Code's "Live Server" extension for a better development experience).*
2. Grant the browser permission to access your **Camera** and **Location** to test the full flow.
3. Fill out the report form, capture an image, and click "Alert Rescue Agent" to see the AI triage in action!

---

## 💡 Hackathon Notes
* **Mocked Image Analysis**: For the scope of this MVP, the AI triage relies entirely on the descriptive text and prompt engineering. The image is uploaded and received by the backend but is not processed by a Vision language model.
* **CORS**: CORS is fully enabled in `main.py` allowing you to run the frontend strictly from `file://` or `localhost` while testing against the FastAPI backend.