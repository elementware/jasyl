from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import shutil
import uuid
import datetime

# ============================================
#  ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
# ============================================
app = FastAPI(title="JASYL API", version="1.0.0")

# Разрешаем CORS (для разработки)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
#  МОДЕЛИ ДАННЫХ
# ============================================
class Tree(BaseModel):
    id: str
    species: str
    common_name: Optional[str] = None
    status: str = "unknown"
    confidence: Optional[float] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    photo_url: Optional[str] = None
    last_inspection: Optional[str] = None
    recommendations: List[str] = []
    history: List[Dict[str, str]] = []

class RequestCreate(BaseModel):
    tree_id: str
    type: str
    priority: str
    comment: str

# ============================================
#  ХРАНИЛИЩА (В ПАМЯТИ)
# ============================================
trees_db: Dict[str, Tree] = {}
requests_db: List[Dict[str, Any]] = []

# ============================================
#  ИНИЦИАЛИЗАЦИЯ ТЕСТОВЫМИ ДАННЫМИ
# ============================================
def init_test_data():
    if not trees_db:
        trees_db["1"] = Tree(
            id="1",
            species="Quercus robur",
            common_name="Дуб черешчатый",
            status="healthy",
            confidence=0.95,
            lat=53.1706,
            lon=63.5845,
            photo_url="https://via.placeholder.com/400x300/4caf50/FFFFFF?text=Дуб",
            last_inspection="2026-08-10",
            recommendations=["Регулярный полив", "Обрезка сухих веток"],
            history=[{"date": "2026-08-10", "status": "healthy"}]
        )
        trees_db["2"] = Tree(
            id="2",
            species="Pinus sylvestris",
            common_name="Сосна обыкновенная",
            status="damaged",
            confidence=0.82,
            lat=53.1750,
            lon=63.5900,
            photo_url="https://via.placeholder.com/400x300/ff9800/FFFFFF?text=Сосна",
            last_inspection="2026-08-05",
            recommendations=["Обработка от вредителей", "Удаление повреждённых веток"],
            history=[{"date": "2026-08-05", "status": "damaged"}]
        )

init_test_data()

# ============================================
#  ЭНДПОИНТЫ API
# ============================================

# ---------- ДЕРЕВЬЯ ----------
@app.get("/api/trees")
async def get_trees():
    """Получить список всех деревьев"""
    return list(trees_db.values())

@app.get("/api/trees/{tree_id}")
async def get_tree(tree_id: str):
    """Получить информацию о конкретном дереве"""
    if tree_id not in trees_db:
        raise HTTPException(status_code=404, detail="Дерево не найдено")
    return trees_db[tree_id]

# ---------- ЗАГРУЗКА ФОТО ----------
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Загрузить фото дерева, выполнить анализ (заглушка) и сохранить дерево"""
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Генерируем уникальное имя файла
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    filepath = os.path.join(upload_dir, filename)
    
    # Сохраняем файл
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Имитация анализа (заглушка)
    new_id = str(len(trees_db) + 1)
    new_tree = Tree(
        id=new_id,
        species="Новое дерево",
        common_name="Неизвестно",
        status="healthy",
        confidence=0.88,
        lat=53.1706 + (hash(new_id) % 100) / 10000,
        lon=63.5845 + (hash(new_id) % 100) / 10000,
        photo_url=f"/uploads/{filename}",
        last_inspection=datetime.date.today().isoformat(),
        recommendations=["Требуется осмотр"],
        history=[{"date": datetime.date.today().isoformat(), "status": "healthy"}]
    )
    trees_db[new_id] = new_tree
    
    # Возвращаем данные для фронтенда
    return {
        "id": new_id,
        "filename": filename,
        "species": "Новое дерево",
        "condition": "healthy",
        "confidence": 0.88,
        "lat": new_tree.lat,
        "lon": new_tree.lon
    }

# ---------- ОБНОВЛЕНИЕ КООРДИНАТ ----------
@app.post("/update-coords/{tree_id}")
async def update_coords(tree_id: str, coords: dict):
    """Обновить координаты дерева"""
    if tree_id not in trees_db:
        raise HTTPException(status_code=404, detail="Дерево не найдено")
    tree = trees_db[tree_id]
    tree.lat = coords.get("lat")
    tree.lon = coords.get("lon")
    return {"status": "ok"}

# ---------- АНАЛИТИКА ----------
@app.get("/api/analytics")
async def get_analytics():
    """Статистика по деревьям и прогноз"""
    total = len(trees_db)
    healthy = sum(1 for t in trees_db.values() if t.status == "healthy")
    damaged = sum(1 for t in trees_db.values() if t.status == "damaged")
    dead = sum(1 for t in trees_db.values() if t.status == "dead")
    leaning = sum(1 for t in trees_db.values() if t.status == "leaning")
    prediction = {
        "pruning": 5,
        "high_risk": 2,
        "next_pruning_date": "2026-09-01"
    }
    return {
        "total": total,
        "healthy": healthy,
        "damaged": damaged,
        "dead": dead,
        "leaning": leaning,
        "prediction": prediction
    }

# ---------- ЗАЯВКИ ----------
@app.post("/api/requests")
async def create_request(req: RequestCreate):
    """Создать новую заявку на работы"""
    req_dict = req.dict()
    req_dict["created_at"] = datetime.datetime.now().isoformat()
    req_dict["tree_name"] = trees_db.get(req.tree_id, {}).common_name or "Unknown"
    requests_db.append(req_dict)
    return req_dict

@app.get("/api/requests")
async def get_requests():
    """Получить список всех заявок"""
    return requests_db

# ---------- УПРАВЛЕНИЕ МОДЕЛЯМИ ----------
@app.get("/models")
async def get_models():
    """Список доступных моделей"""
    return {"models": ["dummy", "local", "cloud"], "active": "dummy"}

@app.post("/select-model")
async def select_model(name: str = Form(...)):
    """Переключить активную модель"""
    # Здесь можно реализовать логику переключения модели
    return {"status": "ok", "selected": name}

# ============================================
#  ЗДОРОВЬЕ И КОРЕНЬ
# ============================================
@app.get("/")
async def root():
    return {
        "name": "JASYL API",
        "version": "1.0.0",
        "status": "operational",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.datetime.utcnow().isoformat()}

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ============================================
#  ЗАПУСК (для отладки)
# ============================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
