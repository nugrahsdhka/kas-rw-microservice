from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Date, Numeric, Enum
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from fastapi.responses import FileResponse
from datetime import date
import os

from fastapi.responses import FileResponse
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from tempfile import NamedTemporaryFile
from datetime import datetime
from zoneinfo import ZoneInfo

# --- KONFIGURASI DATABASE ---
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://kasrw_user:password123@db:3306/kasrw_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- MODEL DATABASE ---
class DBTransaksi(Base):
    __tablename__ = "transaksi"
    id = Column(Integer, primary_key=True, index=True)
    tanggal = Column(Date, nullable=False)
    keterangan = Column(String(255), nullable=False)
    tipe = Column(Enum('Pemasukan', 'Pengeluaran'), nullable=False)
    jumlah = Column(Numeric(15, 2), nullable=False)

# --- SCHEMA VALIDASI (PYDANTIC) ---
class TransaksiBase(BaseModel):
    tanggal: date
    keterangan: str
    tipe: str
    jumlah: float

class TransaksiCreate(TransaksiBase):
    pass

class TransaksiResponse(TransaksiBase):
    id: int
    class Config:
        from_attributes = True

# --- INISIALISASI APLIKASI ---
app = FastAPI(title="API Kas Digital RW 25")

# Izinkan Frontend mengakses API (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency untuk sesi database
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- ENDPOINT CRUD ---

# 1. CREATE: Tambah transaksi baru
@app.post("/transaksi", response_model=TransaksiResponse)
def create_transaksi(transaksi: TransaksiCreate, db: Session = Depends(get_db)):
    db_item = DBTransaksi(**transaksi.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# 2. READ: Ambil semua data transaksi
@app.get("/transaksi", response_model=list[TransaksiResponse])
def get_all_transaksi(db: Session = Depends(get_db)):
    return db.query(DBTransaksi).order_by(DBTransaksi.tanggal.desc()).all()

# 3. READ (Detail): Ambil satu transaksi berdasarkan ID
@app.get("/transaksi/{transaksi_id}", response_model=TransaksiResponse)
def get_transaksi_detail(transaksi_id: int, db: Session = Depends(get_db)):
    item = db.query(DBTransaksi).filter(DBTransaksi.id == transaksi_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    return item

# 4. UPDATE: Edit data transaksi
@app.put("/transaksi/{transaksi_id}", response_model=TransaksiResponse)
def update_transaksi(transaksi_id: int, transaksi: TransaksiCreate, db: Session = Depends(get_db)):
    item = db.query(DBTransaksi).filter(DBTransaksi.id == transaksi_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    
    for key, value in transaksi.model_dump().items():
        setattr(item, key, value)
    
    db.commit()
    db.refresh(item)
    return item

# 5. DELETE: Hapus transaksi
@app.delete("/transaksi/{transaksi_id}")
def delete_transaksi(transaksi_id: int, db: Session = Depends(get_db)):
    item = db.query(DBTransaksi).filter(DBTransaksi.id == transaksi_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    
    db.delete(item)
    db.commit()
    return {"message": "Transaksi berhasil dihapus"}

# 6. EXPORT PDF
@app.get("/export-pdf")
def export_pdf(db: Session = Depends(get_db)):

    transaksi = db.query(DBTransaksi)\
        .order_by(DBTransaksi.tanggal.desc())\
        .all()

    total_income = sum(
        float(t.jumlah)
        for t in transaksi
        if t.tipe == "Pemasukan"
    )

    total_expense = sum(
        float(t.jumlah)
        for t in transaksi
        if t.tipe == "Pengeluaran"
    )

    saldo = total_income - total_expense

    env = Environment(
        loader=FileSystemLoader("templates")
    )

    template = env.get_template("report.html")


    now = datetime.now(ZoneInfo("Asia/Jakarta"))

    html_content = template.render(
        transaksi=transaksi,
        saldo=saldo,
        total_income=total_income,
        total_expense=total_expense,
        printed_date=now.strftime("%d %B %Y"),
        printed_time=now.strftime("%H:%M")
    )

    temp_pdf = NamedTemporaryFile(
        delete=False,
        suffix=".pdf"
    )

    HTML(
        string=html_content,
        base_url="."
    ).write_pdf(temp_pdf.name)

    return FileResponse(
        temp_pdf.name,
        media_type="application/pdf",
        filename="laporan-kas-rw.pdf"
    )