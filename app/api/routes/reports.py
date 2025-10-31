"""
API de Reportes
===============

Este módulo define los endpoints REST para generar reportes relacionados con:
- Pedidos por cliente
- Pedidos por rango de fechas
- Pedidos por estado
- Pedidos asignados a conductor
- Rutas completadas por conductor
- Conductores disponibles
- Reporte combinado de pedidos con conductor y vehículo
"""

from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, get_order_service, get_driver_service
from app.services.order_service import OrderService
from app.services.driver_service import DriverService
from app.schemas.order_schemas import OrderSummary
from app.schemas.driver_schemas import DriverSummary

router = APIRouter(prefix="/reports", tags=["reports"])


# ============================
# 📦 Reportes de Pedidos
# ============================

@router.get("/orders-by-client/{client_id}", response_model=List[OrderSummary])
async def get_orders_by_client_report(
    client_id: int,
    db: Session = Depends(get_db),
    order_service: OrderService = Depends(get_order_service)
):
    """📄 Reporte: Pedidos por Cliente"""
    try:
        orders = order_service.get_by_client(db, client_id, skip=0, limit=500)
        return orders if orders else []
    except Exception as e:
        print(f"[ERROR] orders-by-client: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener pedidos por cliente")


@router.get("/orders-by-date", response_model=List[OrderSummary])
async def get_orders_by_date_report(
    start_date: str = Query(..., description="Fecha inicial (YYYY-MM-DD)"),
    end_date: str = Query(..., description="Fecha final (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    order_service: OrderService = Depends(get_order_service)
):
    """📄 Reporte: Pedidos por Rango de Fechas"""
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")

        if start > end:
            raise HTTPException(status_code=400, detail="La fecha inicial no puede ser mayor que la final")

        orders = order_service.get_by_date_range(db, start, end)
        return orders if orders else []
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")
    except Exception as e:
        print(f"[ERROR] orders-by-date: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al generar reporte por fechas")


@router.get("/orders-by-status", response_model=List[OrderSummary])
async def get_orders_by_status_report(
    status: str = Query(..., description="Estado del pedido (Ej: ENTREGADO, PENDIENTE, CANCELADO)"),
    db: Session = Depends(get_db),
    order_service: OrderService = Depends(get_order_service)
):
    """📄 Reporte: Pedidos por Estado"""
    try:
        orders = order_service.get_by_status(db, status, skip=0, limit=500)
        return orders if orders else []
    except Exception as e:
        print(f"[ERROR] orders-by-status: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener pedidos por estado")


@router.get("/routes-completed-by-driver/{driver_id}", response_model=List[OrderSummary])
async def get_routes_completed_by_driver_report(
    driver_id: int,
    db: Session = Depends(get_db),
    order_service: OrderService = Depends(get_order_service)
):
    """🚚 Reporte: Rutas completadas por Conductor"""
    try:
        orders = order_service.get_completed_by_driver(db, driver_id)
        return orders if orders else []
    except Exception as e:
        print(f"[ERROR] routes-completed-by-driver: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener rutas completadas por conductor")


@router.get("/driver/{driver_id}/assigned-orders", response_model=List[OrderSummary])
async def get_assigned_orders_by_driver_report(
    driver_id: int,
    db: Session = Depends(get_db),
    order_service: OrderService = Depends(get_order_service)
):
    """🚛 Reporte: Pedidos asignados a un Conductor"""
    try:
        orders = order_service.get_by_driver(db, driver_id, skip=0, limit=500)
        return orders if orders else []
    except Exception as e:
        print(f"[ERROR] driver-assigned-orders: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener pedidos asignados al conductor")


# ============================
# 👨‍✈️ Reportes de Conductores
# ============================

@router.get("/available-drivers", response_model=List[DriverSummary])
async def get_available_drivers_report(
    db: Session = Depends(get_db),
    driver_service: DriverService = Depends(get_driver_service)
):
    """👨‍✈️ Reporte: Conductores Disponibles"""
    try:
        drivers = driver_service.get_available_drivers(db, skip=0, limit=100)
        return drivers if drivers else []
    except Exception as e:
        print(f"[ERROR] available-drivers: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener conductores disponibles")


@router.get("/drivers-all", response_model=List[DriverSummary])
async def get_all_drivers_report(
    db: Session = Depends(get_db),
    driver_service: DriverService = Depends(get_driver_service)
):
    """👨‍✈️ Reporte: Todos los Conductores (activos e inactivos)"""
    try:
        drivers = driver_service.get_all(db, skip=0, limit=500)
        return drivers if drivers else []
    except Exception as e:
        print(f"[ERROR] drivers-all: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener listado de conductores")


# ============================
# 🧩 Reporte Combinado
# ============================

@router.get("/orders-with-drivers")
async def get_orders_with_drivers_report(
    start_date: str = Query(None, description="Fecha inicial (YYYY-MM-DD)"),
    end_date: str = Query(None, description="Fecha final (YYYY-MM-DD)"),
    status: str = Query(None, description="Filtrar por estado del pedido"),
    db: Session = Depends(get_db),
    order_service: OrderService = Depends(get_order_service)
):
    """
    🧾 Reporte combinado: Pedidos + Conductor + Vehículo
    Incluye información del pedido, conductor asignado, vehículo y estado.
    """
    try:
        filters = {}
        if start_date and end_date:
            filters["start_date"] = datetime.strptime(start_date, "%Y-%m-%d")
            filters["end_date"] = datetime.strptime(end_date, "%Y-%m-%d")
        if status:
            filters["status"] = status

        # Lógica interna: usa servicio de pedidos con JOINs o relaciones ORM
        orders = order_service.get_orders_with_driver_info(db, **filters)
        return orders if orders else []
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")
    except Exception as e:
        print(f"[ERROR] orders-with-drivers: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al generar reporte combinado")
