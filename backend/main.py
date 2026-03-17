import os
import json
import csv
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn

load_dotenv()

app = FastAPI(title="Aura AI - Animal Urgent Response Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

NVIDIA_API_KEY  = os.getenv("NVIDIA_API_KEY")
NVIDIA_MODEL_NAME = os.getenv("NVIDIA_MODEL_NAME", "meta/llama-3.1-70b-instruct")

if not NVIDIA_API_KEY:
    print("WARNING: NVIDIA_API_KEY not found in environment variables.")

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=NVIDIA_API_KEY
)

CSV_FILE = "alerts.csv"
CSV_HEADERS = ['timestamp', 'latitude', 'longitude', 'description',
               'classification', 'severity', 'routing', 'tips', 'geo_context']


@app.get("/")
def read_root():
    return {"message": "Aura API is running"}


@app.post("/api/report")
async def submit_report(
    description: str  = Form(...),
    latitude:    float = Form(None),
    longitude:   float = Form(None),
    geo_context: str  = Form(None),   # enriched location risk from frontend
    image: UploadFile = File(None)
):
    system_prompt = """
You are Aura, an expert AI animal emergency response agent.
Analyze the provided animal distress report — including the text description AND any location context (proximity to roads, water, urban/wild area).

Determine:
1. The classification of the animal (e.g., "Injured Dog", "Wild Bird", "Stray Cat", "Deer").
2. The severity of the emergency: Low, Medium, High, or Critical.
   - Elevate severity if the location context indicates traffic risk, drowning risk, or remote wildlife area.
3. The appropriate routing:
   - "Alerting Animal Control / Rescue" for domestic pets (dogs, cats, etc.)
   - "Alerting Local Wildlife NGO" for wild animals or specialized cases.
4. Exactly 3 brief, safe, actionable immediate steps for the bystander (prioritise bystander safety first).
5. A short urgency_reason (1 sentence) that explains WHY this severity was assigned — referencing location context if relevant.
   E.g. "High urgency due to road proximity — risk of repeated collision." or "Wildlife in remote area — avoid direct contact."

Output STRICTLY in this JSON format with no markdown blocks:
{
  "classification": "string",
  "severity": "string",
  "routing": "string",
  "urgency_reason": "string",
  "tips": ["tip 1", "tip 2", "tip 3"]
}
"""

    user_prompt = f"Animal Description: {description}"
    if geo_context:
        user_prompt += f"\n\nLocation Context: {geo_context}"

    try:
        completion = client.chat.completions.create(
            model=NVIDIA_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=600
        )

        raw = completion.choices[0].message.content
        # Strip any accidental markdown fences
        raw = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        ai_analysis = json.loads(raw)

        # Persist to CSV
        file_exists = os.path.isfile(CSV_FILE)
        with open(CSV_FILE, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(CSV_HEADERS)
            writer.writerow([
                datetime.utcnow().isoformat(),
                latitude,
                longitude,
                description,
                ai_analysis.get('classification', ''),
                ai_analysis.get('severity', ''),
                ai_analysis.get('routing', ''),
                " | ".join(ai_analysis.get('tips', [])),
                geo_context or ''
            ])

        return {
            "status": "success",
            "message": "AI analysis complete.",
            "analysis": ai_analysis,
            "data": {
                "location": {"lat": latitude, "lng": longitude},
                "filename": image.filename if image else "No image uploaded"
            }
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse AI response.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    incident_context: str
    messages: List[ChatMessage]

@app.post("/api/chat")
async def chat_with_agent(request: ChatRequest):
    system_prompt = f"""
    You are Aura, an expert AI animal response agent.
    A user has reported an animal emergency and is asking for more assistance or information.
    Here is the context of their report:
    {request.incident_context}
    
    Answer the user's questions about this incident, providing safe, calm, and helpful advice.
    Ensure user safety first. Keep your answers concise, empathetic, and directly related to the incident context.
    Do not use markdown blocks unless necessary, but format the text clearly.
    """
    
    api_messages = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        api_messages.append({"role": msg.role, "content": msg.content})
        
    try:
        completion = client.chat.completions.create(
          model=NVIDIA_MODEL_NAME, 
          messages=api_messages,
          temperature=0.3,
          max_tokens=500
        )
        
        reply = completion.choices[0].message.content
        return {"status": "success", "reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics")
def get_analytics():
    if not os.path.isfile(CSV_FILE):
        return {"alerts": [], "total": 0}

    alerts = []
    severity_counts = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    classification_counts = {}
    hour_counts = {str(h): 0 for h in range(24)}

    with open(CSV_FILE, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                lat = float(row.get('latitude') or 0)
                lng = float(row.get('longitude') or 0)
                sev = row.get('severity', 'Medium').strip()
                cls = row.get('classification', 'Unknown').strip()
                ts  = row.get('timestamp', '')

                if lat and lng:
                    alerts.append({
                        "lat":            lat,
                        "lng":            lng,
                        "classification": cls,
                        "severity":       sev,
                        "routing":        row.get('routing', ''),
                        "timestamp":      ts,
                        "geo_context":    row.get('geo_context', ''),
                    })

                severity_counts[sev] = severity_counts.get(sev, 0) + 1
                classification_counts[cls] = classification_counts.get(cls, 0) + 1

                if ts:
                    try:
                        hour = str(datetime.fromisoformat(ts).hour)
                        hour_counts[hour] = hour_counts.get(hour, 0) + 1
                    except Exception:
                        pass

            except (ValueError, TypeError):
                continue

    return {
        "alerts":               alerts,
        "total":                len(alerts),
        "severity_counts":      severity_counts,
        "classification_counts": classification_counts,
        "hour_counts":          hour_counts,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
