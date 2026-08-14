import time, random, io
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

app = FastAPI(title="JASYL ML")
CLASSES = ["healthy","dead","damaged","leaning","diseased","unknown"]

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents))
        time.sleep(0.5+random.random()*0.5)
        status = random.choice(CLASSES)
        confidence = 0.7+random.random()*0.25
        probs = {cls: confidence if cls==status else (1-confidence)/(len(CLASSES)-1)*(0.5+random.random()*0.5) for cls in CLASSES}
        total = sum(probs.values())
        probs = {k: v/total for k,v in probs.items()}
        return JSONResponse(content={"status":status,"confidence":float(probs[status]),"probabilities":probs,"model":"mock","processing_time_ms":500+int(random.random()*500)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error":str(e)})

@app.get("/health")
async def health():
    return {"status":"healthy","model":"mock"}

@app.get("/")
async def root():
    return {"name":"JASYL ML","version":"1.0.0","status":"running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
