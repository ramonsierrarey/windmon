"""
Servidor Web y API REST para WindMon - Pantano del Burguillo.
Sirve la Progressive Web App (PWA) optimizada para móvil y gestiona:
- Histórico horario en SQLite + Estadísticas de viento del Burguillo
- Motor recomendador de Tabla + Vela
- Registro de mediciones reales con medidor portátil (anemómetro)
- Inventario persistente de tablas y velas (Quiver)
"""

from __future__ import annotations

import json
import re
import socket
import sqlite3
import subprocess
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import uvicorn
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from burguillo_data import (
    BURGUILLO_LAT,
    BURGUILLO_LON,
    COMPASS_16,
    DB_PATH,
    DEFAULT_QUIVER_PATH,
    SPOT_DIRECTION_INFO,
    deg_to_compass,
    fetch_and_store_history,
    get_default_quiver,
    init_db,
)
from recommender import recommend_gear

WEB_DIR = Path(__file__).parent / "web"


def load_quiver() -> Dict[str, Any]:
    init_db()
    if DEFAULT_QUIVER_PATH.exists():
        try:
            return json.loads(DEFAULT_QUIVER_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return get_default_quiver()


def save_quiver(quiver_data: Dict[str, Any]) -> None:
    init_db()
    DEFAULT_QUIVER_PATH.write_text(
        json.dumps(quiver_data, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )


async def api_get_quiver(request: Request) -> JSONResponse:
    return JSONResponse({
        "quiver": load_quiver(),
        "spot_directions": SPOT_DIRECTION_INFO,
        "coordinates": {"lat": BURGUILLO_LAT, "lon": BURGUILLO_LON}
    })


async def api_save_quiver(request: Request) -> JSONResponse:
    body = await request.json()
    quiver = body.get("quiver", body)
    save_quiver(quiver)
    return JSONResponse({"ok": True, "quiver": quiver})


async def api_recommend(request: Request) -> JSONResponse:
    body = await request.json()
    wind_speed = float(body.get("wind_speed_kt", 15.0))
    wind_gust = float(body.get("wind_gust_kt", 20.0))
    wind_dir = body.get("wind_dir", "SW")
    quiver = body.get("quiver") or load_quiver()
    result = recommend_gear(wind_speed, wind_gust, wind_dir, quiver)
    return JSONResponse(result)


async def api_get_measurements(request: Request) -> JSONResponse:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM manual_measurements ORDER BY id DESC LIMIT 100")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return JSONResponse({"measurements": rows})


async def api_save_measurement(request: Request) -> JSONResponse:
    init_db()
    body = await request.json()
    ws = float(body.get("wind_speed_kt", 0))
    wg = float(body.get("wind_gust_kt", ws))
    wdir_deg = float(body.get("wind_dir_deg", 225))
    wcomp = body.get("wind_compass") or deg_to_compass(wdir_deg)
    zone = body.get("spot_zone", "Las Cruceras / Centro")
    notes = body.get("notes", "")
    ts = body.get("timestamp") or datetime.now().strftime("%Y-%m-%d %H:%M")

    rec = recommend_gear(ws, wg, wcomp, load_quiver())
    board_str = rec.get("primary", {}).get("board", {}).get("name", "-")
    sail_str = rec.get("primary", {}).get("sail", {}).get("name", "-")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO manual_measurements
        (timestamp, wind_speed_kt, wind_gust_kt, wind_dir_deg, wind_compass, spot_zone, recommended_board, recommended_sail, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (ts, ws, wg, wdir_deg, wcomp, zone, board_str, sail_str, notes))
    conn.commit()
    conn.close()
    return JSONResponse({"ok": True, "recommendation": rec})


async def api_delete_measurement(request: Request) -> JSONResponse:
    init_db()
    m_id = int(request.path_params["id"])
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("DELETE FROM manual_measurements WHERE id = ?", (m_id,))
    conn.commit()
    conn.close()
    return JSONResponse({"ok": True})


async def api_fetch_history(request: Request) -> JSONResponse:
    body = await request.json()
    end_dt = datetime.now() - timedelta(days=5)
    years = int(body.get("years", 2))
    start_date = body.get("start_date") or (end_dt - timedelta(days=365 * years)).strftime("%Y-%m-%d")
    end_date = body.get("end_date") or end_dt.strftime("%Y-%m-%d")
    try:
        res = fetch_and_store_history(start_date, end_date)
        return JSONResponse({"ok": True, **res})
    except Exception as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=500)


async def api_history_stats(request: Request) -> JSONResponse:
    """
    Calcula las estadísticas históricas del Pantano del Burguillo a partir de SQLite:
    - Rosa de los vientos (frecuencia %, velocidad media, racha media, % navegable)
    - Mapa de calor Mes (1..12) x Hora de luz (8..21)
    - Distribución de uso de material del Quiver en las horas navegables
    """
    init_db()
    apply_local_boost = request.query_params.get("local_boost", "1") == "1"
    min_hour = int(request.query_params.get("min_hour", "9"))
    max_hour = int(request.query_params.get("max_hour", "20"))
    month_filter = int(request.query_params.get("month", "0"))  # 0 = todos los meses

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) as cnt, MIN(date) as min_d, MAX(date) as max_d FROM historical_hourly")
    meta = dict(cur.fetchone())

    if meta["cnt"] == 0:
        conn.close()
        return JSONResponse({
            "has_data": False,
            "total_hours": 0
        })

    query = "SELECT month, hour, date, wind_speed_kt, wind_gust_kt, wind_compass FROM historical_hourly WHERE hour >= ? AND hour <= ?"
    params: List[Any] = [min_hour, max_hour]
    if 1 <= month_filter <= 12:
        query += " AND month = ?"
        params.append(month_filter)

    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()

    quiver = load_quiver()

    # Inicializar acumuladores
    compass_stats = {
        c: {"count": 0, "sum_speed": 0.0, "sum_gust": 0.0, "planing_hours": 0}
        for c in COMPASS_16
    }
    # Heatmap: mes (1..12) x hora (8..21)
    heatmap: Dict[int, Dict[int, Dict[str, float]]] = {
        m: {h: {"count": 0, "sum_speed": 0.0, "sum_gust": 0.0, "planing": 0} for h in range(8, 22)}
        for m in range(1, 13)
    }

    board_usage: Dict[str, int] = {}
    sail_usage: Dict[str, int] = {}
    combo_usage: Dict[str, int] = {}
    navigable_days_set = set()
    total_daylight_hours = len(rows)
    total_planing_hours = 0

    for r in rows:
        m = r["month"]
        h = r["hour"]
        comp = r["wind_compass"] or "SW"
        ws = float(r["wind_speed_kt"] or 0.0)
        wg = float(r["wind_gust_kt"] or ws)

        # Ajuste de efecto térmico / encañonamiento local y lámina de agua del Burguillo
        if apply_local_boost:
            s_info = SPOT_DIRECTION_INFO.get(comp, SPOT_DIRECTION_INFO["SW"])
            boost = float(s_info.get("thermal_boost", 1.0))
            # En ERA5 la rugosidad de la sierra circundante frena el viento medio de malla,
            # mientras que sobre el agua abierta del embalse el viento sostenido ronda el 65% de la racha
            if 4 <= m <= 10 and 13 <= h <= 19:
                wg = max(wg * (0.95 + (boost - 1.0) * 0.6), ws * 1.25)
                ws = max(ws * boost, wg * 0.66)
            else:
                ws = max(ws * (1.0 + (boost - 1.0) * 0.5), wg * 0.62)

        is_planing = (0.58 * ws + 0.42 * wg) >= 11.5 or wg >= 14.0
        if is_planing:
            total_planing_hours += 1
            navigable_days_set.add(r["date"])

        if comp in compass_stats:
            compass_stats[comp]["count"] += 1
            compass_stats[comp]["sum_speed"] += ws
            compass_stats[comp]["sum_gust"] += wg
            if is_planing:
                compass_stats[comp]["planing_hours"] += 1

        if m in heatmap and h in heatmap[m]:
            heatmap[m][h]["count"] += 1
            heatmap[m][h]["sum_speed"] += ws
            heatmap[m][h]["sum_gust"] += wg
            if is_planing:
                heatmap[m][h]["planing"] += 1

    # Calcular uso de material sobre los percentiles reales de cada rumbo navegable
    for comp, st in compass_stats.items():
        if st["planing_hours"] > 0:
            avg_ws = max(11.0, st["sum_speed"] / max(1, st["count"]) * 1.25)
            avg_wg = max(15.5, st["sum_gust"] / max(1, st["count"]) * 1.25)
            for factor, weight_share in [(0.78, 0.40), (1.02, 0.32), (1.32, 0.28)]:
                rec = recommend_gear(avg_ws * factor, avg_wg * factor, comp, quiver)
                b_name = rec.get("primary", {}).get("board", {}).get("name", "Tabla")
                s_name = rec.get("primary", {}).get("sail", {}).get("name", "Vela")
                combo = f"{b_name} + {s_name}"
                hrs = int(round(st["planing_hours"] * weight_share))
                board_usage[b_name] = board_usage.get(b_name, 0) + hrs
                sail_usage[s_name] = sail_usage.get(s_name, 0) + hrs
                combo_usage[combo] = combo_usage.get(combo, 0) + hrs

    # Formatear rosa de los vientos
    rose_list = []
    for c in COMPASS_16:
        st = compass_stats[c]
        cnt = st["count"]
        rose_list.append({
            "compass": c,
            "freq_pct": round((cnt / max(1, total_daylight_hours)) * 100.0, 1),
            "planing_share_pct": round((st["planing_hours"] / max(1, total_planing_hours)) * 100.0, 1),
            "avg_speed_kt": round(st["sum_speed"] / max(1, cnt), 1) if cnt else 0.0,
            "avg_gust_kt": round(st["sum_gust"] / max(1, cnt), 1) if cnt else 0.0,
            "planing_hours": st["planing_hours"],
            "quality": SPOT_DIRECTION_INFO[c]["quality"],
            "label": SPOT_DIRECTION_INFO[c]["label"]
        })

    # Formatear heatmap
    heatmap_formatted = {}
    for m in range(1, 13):
        heatmap_formatted[str(m)] = {}
        for h in range(8, 22):
            cell = heatmap[m][h]
            c_cnt = cell["count"]
            heatmap_formatted[str(m)][str(h)] = {
                "avg_speed_kt": round(cell["sum_speed"] / max(1, c_cnt), 1) if c_cnt else 0.0,
                "avg_gust_kt": round(cell["sum_gust"] / max(1, c_cnt), 1) if c_cnt else 0.0,
                "planing_pct": round((cell["planing"] / max(1, c_cnt)) * 100.0, 0) if c_cnt else 0.0
            }

    return JSONResponse({
        "has_data": True,
        "min_date": meta["min_d"],
        "max_date": meta["max_d"],
        "total_hours_db": meta["cnt"],
        "analyzed_daylight_hours": total_daylight_hours,
        "total_planing_hours": total_planing_hours,
        "navigable_days_count": len(navigable_days_set),
        "wind_rose": rose_list,
        "heatmap": heatmap_formatted,
        "gear_distribution": {
            "boards": board_usage,
            "sails": sail_usage,
            "combos": combo_usage
        }
    })


async def index_page(request: Request) -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


routes = [
    Route("/", index_page),
    Route("/api/quiver", api_get_quiver, methods=["GET"]),
    Route("/api/quiver", api_save_quiver, methods=["POST"]),
    Route("/api/recommend", api_recommend, methods=["POST"]),
    Route("/api/measurements", api_get_measurements, methods=["GET"]),
    Route("/api/measurements", api_save_measurement, methods=["POST"]),
    Route("/api/measurements/{id:int}", api_delete_measurement, methods=["DELETE"]),
    Route("/api/history/fetch", api_fetch_history, methods=["POST"]),
    Route("/api/history/stats", api_history_stats, methods=["GET"]),
    Mount("/", StaticFiles(directory=str(WEB_DIR)), name="static"),
]

app = Starlette(
    debug=True,
    routes=routes,
    middleware=[
        Middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )
    ],
)

if __name__ == "__main__":
    init_db()
    print("=================================================================")
    print(" WindMon Burguillo iniciado en: http://localhost:8000")
    print(" Para abrirlo en el móvil (misma WiFi), usa la IP local de tu PC.")
    print("=================================================================")
    uvicorn.run(app, host="0.0.0.0", port=8000)
