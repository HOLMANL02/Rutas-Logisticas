"""
API de Rutas Logísticas
Gestión de vehículos, conductores, clientes y direcciones
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import asyncio

from app.core.config import config
from app.core.database import db_manager
from app.api.routes import userses, vehicles, drivers, clients, geocoding, orders,directions 
from app.api.routes import reports


# Configurar logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Maneja el inicio y cierre de la aplicación"""
    logger.info("Iniciando aplicación...")
    
    # Conectar a la base de datos con reintentos
    for intento in range(10):
        try:
            db_manager.create_tables()
            if db_manager.health_check():
                logger.info("Base de datos conectada")
                break
        except Exception as e:
            if intento < 9:
                logger.warning(f"Reintentando conexión... ({intento + 1}/10)")
                await asyncio.sleep(2)
            else:
                logger.error(f"Error conectando a la base de datos: {e}")
                raise
    
    yield
    
    logger.info("Cerrando aplicación...")


# Crear aplicación FastAPI
app = FastAPI(
    title="Rutas Logísticas API",
    description="API para gestión de vehículos, conductores, clientes y pedidos",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan
)

# Configurar CORS ANTES de incluir las rutas
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
    ],
    expose_headers=["*"],
)

# Incluir rutas de la API
app.include_router(vehicles.router, prefix="/api/v1")
app.include_router(drivers.router, prefix="/api/v1")
app.include_router(clients.router, prefix="/api/v1")
app.include_router(userses.router, prefix="/api/v1")
app.include_router(geocoding.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")
app.include_router(directions.router, prefix="/api/v1")
app.include_router(reports.router)


# Rutas básicas
@app.get("/")
async def root():
    """Información básica de la API"""
    return {
        "message": "API de Rutas Logísticas",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Verifica el estado de la aplicación"""
    try:
        if db_manager.health_check():
            return {"status": "ok", "message": "Aplicación funcionando correctamente"}
        else:
            return {"status": "error", "message": "Problema con la base de datos"}
    except Exception:
        return {"status": "error", "message": "Error en la aplicación"}


@app.get("/test-vehicles")
async def test_vehicles():
    """Endpoint simple para probar vehículos"""
    try:
        from sqlalchemy import text
        with db_manager.get_session() as session:
            result = session.execute(text("SELECT license_plate, vehicle_type FROM vehicles LIMIT 3"))
            vehicles = [{"license_plate": row[0], "vehicle_type": row[1]} for row in result.fetchall()]
            return {"status": "ok", "vehicles": vehicles}
    except Exception as e:
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=config.app.api_host,
        port=config.app.api_port,
        reload=config.app.debug,
        log_level="info" if not config.app.debug else "debug"
    )
