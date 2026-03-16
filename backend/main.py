import os
import json
import csv
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

load_dotenv()

app = FastAPI(title="Aura AI - Animal Urgent Response Agent")

# Allow CORS for local frontend testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client pointing to NVIDIA's API
# Get your API key from https://build.nvidia.com/
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
NVIDIA_MODEL_NAME = os.getenv("NVIDIA_MODEL_NAME", "meta/llama-3.1-70b-instruct")

if not NVIDIA_API_KEY:
    print("WARNING: NVIDIA_API_KEY not found in environment variables.")

client = OpenAI(
  base_url="https://integrate.api.nvidia.com/v1",
  api_key=NVIDIA_API_KEY
)

@app.get("/")
def read_root():
    return {"message": "Aura API is running"}

@app.post("/api/report")
async def submit_report(
    description: str = Form(...),
    latitude: float = Form(None),
    longitude: float = Form(None),
    image: UploadFile = File(None)
):
    # MVP constraint: Mocking image analysis, relying primarily on text description.
    # We construct a prompt for NVIDIA Nemotron-4-340B-Instruct (or similar model)
    system_prompt = """
    You are Aura, an expert AI animal response agent. 
    Analyze the provided description of an animal in distress.
    Determine:
    1. The classification of the animal (e.g., Dog, Cat, Bird, Wildlife) and the severity of the situation (Low, Medium, High, Critical).
    2. The appropriate routing: either "Alerting Local Wildlife NGO" (for wild animals or specialized cases) or "Alerting Animal Control / Rescue" (for domestic pets like dogs/cats).
    3. Exactly 3 brief, actionable bullet points of immediate, safe first-aid or securing tips for the user (ensure user safety first).

    Output strictly in the following JSON format without markdown blocks:
    {
      "classification": "string",
      "severity": "string",
      "routing": "string",
      "tips": ["tip 1", "tip 2", "tip 3"]
    }
    """

    user_prompt = f"Animal Description: {description}"

    try:
        completion = client.chat.completions.create(
          model=NVIDIA_MODEL_NAME, 
          messages=[
              {"role": "system", "content": system_prompt},
              {"role": "user", "content": user_prompt}
          ],
          temperature=0.2,
          max_tokens=500
        )
        
        # Parse the JSON response from the agent
        ai_response_text = completion.choices[0].message.content
        ai_analysis = json.loads(ai_response_text)

        # Save to CSV
        csv_file = "alerts.csv"
        file_exists = os.path.isfile(csv_file)
        
        with open(csv_file, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if not file_exists:
                # Write headers if the file is being created for the first time
                writer.writerow(['timestamp', 'latitude', 'longitude', 'description', 'classification', 'severity', 'routing', 'tips'])
            
            # Combine the tips into a single string
            tips_str = " | ".join(ai_analysis.get('tips', []))
            
            writer.writerow([
                datetime.utcnow().isoformat(),
                latitude,
                longitude,
                description,
                ai_analysis.get('classification', ''),
                ai_analysis.get('severity', ''),
                ai_analysis.get('routing', ''),
                tips_str
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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)