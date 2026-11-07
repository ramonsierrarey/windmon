"""
Módulo de captura y análisis de datos meteorológicos para el Pantano del Burguillo (Ávila).
Coordenadas de referencia (Zona centro / Las Cruceras - El Barraco):
Latitud: 40.4253° N, Longitud: -4.5583° W, Altitud: ~730 m.
"""

from __future__ import annotations

import json
import math
import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

# Coordenadas exactas en el centro de navegación del Embalse del Burguillo (Las Cruceras / Arroyo de la Parra)
BURGUILLO_LAT = 40.429030
BURGUILLO_LON = -4.564277
TIMEZONE = "Europe/Madrid"

DATA_DIR = Path(__file__).parent / "data"
DB_PATH = DATA_DIR / "burguillo_windmon.db"
DEFAULT_QUIVER_PATH = DATA_DIR / "quiver.json"

COMPASS_16 = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW"
]

# Conocimiento local de las orientaciones de viento en el Embalse del Burguillo
SPOT_DIRECTION_INFO: Dict[str, Dict[str, Any]] = {
    "N": {
        "quality": "buena",
        "label": "Norte encañonado",
        "thermal_boost": 1.15,
        "gustiness": "media-alta",
        "notes": "Entra con fuerza desde la Sierra. Más racheado pegado a la orilla norte, muy potente del centro hacia el sur del embalse."
    },
    "NNE": {
        "quality": "excelente",
        "label": "NNE alineado al valle",
        "thermal_boost": 1.20,
        "gustiness": "media",
        "notes": "Alineado con el eje del embalse. Fetch largo y viento más constante en el centro del pantano."
    },
    "NE": {
        "quality": "excelente",
        "label": "Nordeste clásico (Eje del pantano)",
        "thermal_boost": 1.22,
        "gustiness": "baja-media",
        "notes": "Una de las mejores direcciones en El Burguillo. Acelera por encañonamiento en Las Cruceras y centro del embalse."
    },
    "ENE": {
        "quality": "buena",
        "label": "Este-Nordeste",
        "thermal_boost": 1.12,
        "gustiness": "media",
        "notes": "Funciona bien en la mitad occidental del embalse, algo de sombra de viento cerca de la orilla este."
    },
    "E": {
        "quality": "regular",
        "label": "Levante (Cruzado)",
        "thermal_boost": 1.05,
        "gustiness": "alta",
        "notes": "Cruza transversalmente la zona estrecha; suele entrar racheado y con roles. Conviene tabla con más volumen."
    },
    "ESE": {
        "quality": "mala",
        "label": "ESE (Muy cruzado / Sombra orográfica)",
        "thermal_boost": 0.95,
        "gustiness": "muy alta",
        "notes": "Desfavorable por las laderas del sureste. Muchos huecos de viento."
    },
    "SE": {
        "quality": "mala",
        "label": "Sureste (Racheado por montaña)",
        "thermal_boost": 0.95,
        "gustiness": "muy alta",
        "notes": "Dirección perpendicular al valle. Rachas bruscas y calmas prolongadas."
    },
    "SSE": {
        "quality": "regular",
        "label": "Sur-Sureste",
        "thermal_boost": 1.05,
        "gustiness": "alta",
        "notes": "Entra mejor cerca de la presa, pero rolón en la zona norte."
    },
    "S": {
        "quality": "buena",
        "label": "Sur (Hacia Las Cruceras)",
        "thermal_boost": 1.12,
        "gustiness": "media",
        "notes": "Buen recorrido desde la cola/presa hacia la zona norte del embalse."
    },
    "SSW": {
        "quality": "excelente",
        "label": "SSW (Alineado al cañón)",
        "thermal_boost": 1.20,
        "gustiness": "baja-media",
        "notes": "Excelente canalización subiendo por el valle del Alberche. Olas cortas de pantano (choppy) divertidas."
    },
    "SW": {
        "quality": "excelente",
        "label": "Suroeste dominante (El clásico del Burguillo)",
        "thermal_boost": 1.25,
        "gustiness": "baja-media",
        "notes": "La dirección reina en El Burguillo (tanto con frentes atlánticos como térmico de tarde). Fetch largo y noble."
    },
    "WSW": {
        "quality": "excelente",
        "label": "Oeste-Suroeste (Poniente canalizado)",
        "thermal_boost": 1.20,
        "gustiness": "media",
        "notes": "Muy frecuente por las tardes de primavera, verano y otoño. Entra franco en Las Cruceras."
    },
    "W": {
        "quality": "buena",
        "label": "Poniente (Oeste)",
        "thermal_boost": 1.12,
        "gustiness": "media-alta",
        "notes": "Buen viento en las zonas abiertas del embalse; algo racheado en las calas resguardadas al oeste."
    },
    "WNW": {
        "quality": "regular",
        "label": "Oeste-Noroeste",
        "thermal_boost": 1.00,
        "gustiness": "alta",
        "notes": "Descarga desde Gredos/Paramera con rachas fuertes y huecos. Monta tabla con reserva de flotabilidad."
    },
    "NW": {
        "quality": "mala",
        "label": "Noroeste (Cruzado y racheado)",
        "thermal_boost": 0.95,
        "gustiness": "muy alta",
        "notes": "Baja perpendicular desde la sierra; genera rachas violentas en el agua seguidas de calmas."
    },
    "NNW": {
        "quality": "regular",
        "label": "Norte-Noroeste",
        "thermal_boost": 1.05,
        "gustiness": "alta",
        "notes": "Navegable si tiene suficiente intensidad base, pero racheado."
    }
}


def deg_to_compass(deg: Optional[float]) -> str:
    if deg is None or math.isnan(deg):
        return "SW"
    idx = int(round((deg % 360) / 22.5)) % 16
    return COMPASS_16[idx]


def get_default_quiver() -> Dict[str, Any]:
    """
    Inventario real del Rider (70 kg):
    - Tablas: Goya Proton 137L, Goya Proton 118L, Goya Bolt 4 99L
    - Velas: North Freespeed Gen1 3Di 7.7 m², Loft Switchblade 6.8 m² (3 cam), North Freerace 3Di 6.0 m² (AirCam)
    """
    return {
        "rider": {
            "name": "Rider Burguillo",
            "weight_kg": 70,
            "level": "avanzado",
            "style": "Slalom / Freerace",
            "prefer_comfort_in_gusts": True
        },
        "boards": [
            {
                "id": "goya-proton-137",
                "name": "Goya Proton 137L",
                "brand_model": "Goya Proton Pro Slalom 137L (Manga ~85 cm)",
                "volume_l": 137,
                "width_cm": 85,
                "type": "Slalom Lightwind",
                "min_sail_m2": 6.6,
                "max_sail_m2": 9.5,
                "ideal_wind_min_kt": 10,
                "ideal_wind_max_kt": 16,
                "fin_cm": "44–46 cm Slalom Deep Tuttle",
                "notes": "Reina del térmico y días racheados de 10 a 16 kt. Con 70 kg y 85 cm de manga pasa todos los huecos del Burguillo sin perder el planeo."
            },
            {
                "id": "goya-proton-118",
                "name": "Goya Proton 118L",
                "brand_model": "Goya Proton Pro Slalom 118L (Manga ~75 cm)",
                "volume_l": 118,
                "width_cm": 75,
                "type": "Slalom Medium",
                "min_sail_m2": 5.8,
                "max_sail_m2": 8.4,
                "ideal_wind_min_kt": 13,
                "ideal_wind_max_kt": 21,
                "fin_cm": "38–40 cm Slalom Tuttle",
                "notes": "Tu tabla más polivalente en El Burguillo: admite las 3 velas (7.7, 6.8 y 6.0) y vuela cuando el SW o NE se asienta entre 13 y 21 nudos."
            },
            {
                "id": "goya-bolt4-99",
                "name": "Goya Bolt 4 99L",
                "brand_model": "Goya Bolt 4 Freerace Carbon 99L (Manga ~63 cm)",
                "volume_l": 99,
                "width_cm": 63,
                "type": "Freerace High-Wind",
                "min_sail_m2": 4.7,
                "max_sail_m2": 7.0,
                "ideal_wind_min_kt": 17,
                "ideal_wind_max_kt": 30,
                "fin_cm": "32–34 cm Freerace Tuttle",
                "notes": "Control total para días de SW fuerte o nortada (>17-18 kt sostenidos con rachas de 22-28 kt), cuando el centro del pantano levanta choppy."
            }
        ],
        "sails": [
            {
                "id": "north-freespeed-77",
                "name": "North Freespeed Gen1 3Di 7.7 m²",
                "brand_model": "North Sails 3Di Molded Freerace 7.7 m²",
                "size_m2": 7.7,
                "cambers": 0,
                "type": "3Di Freerace / Lightwind",
                "wind_min_kt": 10.5,
                "wind_sweet_kt": 13.5,
                "wind_max_kt": 17.5,
                "notes": "Construcción 3Di ultra estable: con tus 70 kg te saca al planeo desde 10.5-11 kt de racha sobre la Proton 137L o 118L."
            },
            {
                "id": "loft-switchblade-68",
                "name": "Loft Switchblade 6.8 m² (3 Cam)",
                "brand_model": "Loft Sails Switchblade 6.8 m² · 3 Cambers",
                "size_m2": 6.8,
                "cambers": 3,
                "type": "Freerace 3-Cam",
                "wind_min_kt": 13.5,
                "wind_sweet_kt": 17.0,
                "wind_max_kt": 22.0,
                "notes": "Enorme rango de viento gracias a los 3 cambers. Perfecta para condiciones racheadas de pantano: tira abajo y ni se inmuta en rachas de 21-22 kt."
            },
            {
                "id": "north-freerace-60",
                "name": "North Freerace 3Di 6.0 m² (AirCam)",
                "brand_model": "North Sails Freerace 3Di AirCam 6.0 m²",
                "size_m2": 6.0,
                "cambers": 1,
                "type": "3Di Freerace AirCam",
                "wind_min_kt": 17.0,
                "wind_sweet_kt": 21.0,
                "wind_max_kt": 28.0,
                "notes": "Ligera y rapidísima con AirCam: ideal en la Goya Bolt 4 99L (o en la Proton 118L si hay rachas de 22 kt pero muchos huecos)."
            }
        ]
    }


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DEFAULT_QUIVER_PATH.exists():
        DEFAULT_QUIVER_PATH.write_text(
            json.dumps(get_default_quiver(), indent=2, ensure_ascii=False),
            encoding="utf-8"
        )

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS historical_hourly (
            time TEXT PRIMARY KEY,
            date TEXT,
            year INTEGER,
            month INTEGER,
            day INTEGER,
            hour INTEGER,
            wind_speed_kt REAL,
            wind_gust_kt REAL,
            wind_dir_deg REAL,
            wind_compass TEXT,
            temp_c REAL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS manual_measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            wind_speed_kt REAL,
            wind_gust_kt REAL,
            wind_dir_deg REAL,
            wind_compass TEXT,
            spot_zone TEXT,
            recommended_board TEXT,
            recommended_sail TEXT,
            notes TEXT
        )
    """)
    conn.commit()
    conn.close()


def fetch_and_store_history(start_date: str, end_date: str) -> Dict[str, Any]:
    """
    Descarga el histórico horario real desde Open-Meteo Archive API (ERA5-Land / CERRA)
    para las coordenadas del Pantano del Burguillo en nudos (knots).
    """
    init_db()
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": BURGUILLO_LAT,
        "longitude": BURGUILLO_LON,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": "wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m",
        "wind_speed_unit": "kn",
        "timezone": TIMEZONE
    }
    resp = requests.get(url, params=params, timeout=30)
    if resp.status_code == 400:
        # Si el reloj del sistema está adelantado respecto al corte de ERA5, usamos el último rango consolidado
        params["start_date"] = "2023-01-01"
        params["end_date"] = "2024-12-31"
        start_date = params["start_date"]
        end_date = params["end_date"]
        resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    payload = resp.json()

    hourly = payload.get("hourly", {})
    times = hourly.get("time", [])
    speeds = hourly.get("wind_speed_10m", [])
    gusts = hourly.get("wind_gusts_10m", [])
    dirs = hourly.get("wind_direction_10m", [])
    temps = hourly.get("temperature_2m", [])

    rows = []
    for i, t_str in enumerate(times):
        ws = speeds[i] if i < len(speeds) and speeds[i] is not None else 0.0
        wg = gusts[i] if i < len(gusts) and gusts[i] is not None else ws
        wd = dirs[i] if i < len(dirs) and dirs[i] is not None else 225.0
        tc = temps[i] if i < len(temps) and temps[i] is not None else 15.0
        dt_part, hr_part = t_str.split("T")
        y, m, d = [int(x) for x in dt_part.split("-")]
        hr = int(hr_part.split(":")[0])
        comp = deg_to_compass(wd)
        rows.append((t_str, dt_part, y, m, d, hr, round(ws, 1), round(wg, 1), round(wd, 0), comp, round(tc, 1)))

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.executemany("""
        INSERT OR REPLACE INTO historical_hourly
        (time, date, year, month, day, hour, wind_speed_kt, wind_gust_kt, wind_dir_deg, wind_compass, temp_c)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()
    conn.close()

    return {
        "inserted_hours": len(rows),
        "start_date": start_date,
        "end_date": end_date
    }


if __name__ == "__main__":
    init_db()
    # Por defecto descargamos los últimos 2 años completos disponibles en Open-Meteo Archive
    end_dt = datetime.now() - timedelta(days=5)
    start_dt = end_dt - timedelta(days=730)
    print(f"Descargando histórico del Pantano del Burguillo ({start_dt.strftime('%Y-%m-%d')} a {end_dt.strftime('%Y-%m-%d')})...")
    res = fetch_and_store_history(start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d"))
    print(f"Completado: {res['inserted_hours']} registros horarios almacenados en {DB_PATH}")
