"""
Motor de recomendación de material de Windsurf (Vela + Tabla) calibrado para
condiciones de agua interior / pantano (Embalse del Burguillo).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from burguillo_data import SPOT_DIRECTION_INFO, deg_to_compass


def recommend_gear(
    wind_speed_kt: float,
    wind_gust_kt: float,
    wind_dir_deg_or_compass: Any,
    quiver: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Calcula la propuesta óptima de Tabla + Vela dado el viento medio, la racha,
    la dirección del viento en el Pantano del Burguillo y el inventario (quiver).
    """
    base_kt = max(0.0, float(wind_speed_kt))
    gust_kt = max(base_kt, float(wind_gust_kt))
    gust_diff = gust_kt - base_kt

    if isinstance(wind_dir_deg_or_compass, (int, float)):
        compass = deg_to_compass(float(wind_dir_deg_or_compass))
        dir_deg = float(wind_dir_deg_or_compass) % 360
    else:
        compass = str(wind_dir_deg_or_compass).upper().strip()
        if compass not in SPOT_DIRECTION_INFO:
            compass = "SW"
        dir_deg = 225.0

    spot_info = SPOT_DIRECTION_INFO.get(compass, SPOT_DIRECTION_INFO["SW"])
    rider = quiver.get("rider", {})
    weight_kg = float(rider.get("weight_kg", 78))

    # Ajuste por peso del rider respecto a un estándar de 75 kg
    # Un rider más pesado necesita equivalencia de ~1-2 nudos más para planear con la misma vela
    weight_factor = (75.0 / max(45.0, weight_kg)) ** 0.55

    # Viento efectivo para elegir VELA:
    # En pantano miramos una combinación entre base y racha para poder planear en las rachas
    # sin ir completamente pasado.
    eff_sail_kt = (0.58 * base_kt + 0.42 * gust_kt) * weight_factor

    # Viento efectivo para elegir TABLA:
    # Si hay mucha diferencia base-racha (>= 6 kt) o la dirección en el Burguillo es muy racheada,
    # penalizamos bajar de volumen demasiado pronto para no hundirse en los huecos ("lulls").
    is_gusty_condition = (gust_diff >= 6.0) or (spot_info["gustiness"] in ("alta", "muy alta"))
    if is_gusty_condition:
        eff_board_kt = (0.75 * base_kt + 0.25 * gust_kt) * weight_factor
    else:
        eff_board_kt = (0.55 * base_kt + 0.45 * gust_kt) * weight_factor

    # Estado general de navegabilidad
    if gust_kt < 10.0 or eff_sail_kt < 9.5:
        status = "no_planeo"
        status_label = "Viento insuficiente para planeo (Drizar / Paseo / SUP)"
        status_color = "slate"
    elif eff_sail_kt < 13.0:
        status = "marginal"
        status_label = "Planeo marginal / Térmico suave (Material grande o Foil)"
        status_color = "amber"
    elif eff_sail_kt <= 24.0:
        status = "optimo"
        status_label = "¡Condiciones óptimas de planeo!"
        status_color = "emerald"
    else:
        status = "fuerte"
        status_label = "Viento muy fuerte / Temporal de pantano"
        status_color = "purple"

    sails: List[Dict[str, Any]] = sorted(
        quiver.get("sails", []),
        key=lambda s: float(s.get("size_m2", 0)),
        reverse=True
    )
    boards: List[Dict[str, Any]] = sorted(
        quiver.get("boards", []),
        key=lambda b: float(b.get("volume_l", 0)),
        reverse=True
    )

    if not sails or not boards:
        return {
            "status": status,
            "status_label": status_label,
            "error": "No hay tablas o velas configuradas en el inventario."
        }

    # Puntúa cada vela según cómo encaja eff_sail_kt en su rango [wind_min_kt, wind_max_kt]
    scored_sails = []
    for sail in sails:
        w_min = float(sail.get("wind_min_kt", 12))
        w_max = float(sail.get("wind_max_kt", 20))
        w_sweet = float(sail.get("wind_sweet_kt", (w_min + w_max) / 2.0))

        # Distancia al punto dulce
        dist_sweet = abs(eff_sail_kt - w_sweet)
        penalty = 0.0
        if eff_sail_kt < w_min:
            penalty += (w_min - eff_sail_kt) * 2.8
        elif eff_sail_kt > w_max:
            penalty += (eff_sail_kt - w_max) * 3.2

        # Si la racha supera claramente el máximo de la vela, penalizar por descontrol
        if gust_kt * weight_factor > w_max + 4.0:
            penalty += (gust_kt * weight_factor - (w_max + 4.0)) * 1.5

        score = max(0.0, 100.0 - (dist_sweet * 6.0 + penalty * 5.0))
        scored_sails.append((score, sail))

    scored_sails.sort(key=lambda x: x[0], reverse=True)
    best_sail = scored_sails[0][1]
    best_sail_score = round(scored_sails[0][0])
    alt_sail = scored_sails[1][1] if len(scored_sails) > 1 else best_sail

    # Puntúa cada tabla según eff_board_kt y compatibilidad con la vela elegida
    best_sail_size = float(best_sail.get("size_m2", 6.5))
    scored_boards = []
    for board in boards:
        b_min_w = float(board.get("ideal_wind_min_kt", 12))
        b_max_w = float(board.get("ideal_wind_max_kt", 22))
        b_sweet_w = (b_min_w + b_max_w) / 2.0
        s_min = float(board.get("min_sail_m2", 4.5))
        s_max = float(board.get("max_sail_m2", 8.5))

        dist_w = abs(eff_board_kt - b_sweet_w)
        penalty = 0.0
        if eff_board_kt < b_min_w:
            penalty += (b_min_w - eff_board_kt) * 2.5
        elif eff_board_kt > b_max_w:
            penalty += (eff_board_kt - b_max_w) * 2.5

        # Compatibilidad estricta de rango de vela con la tabla
        if best_sail_size < s_min:
            penalty += (s_min - best_sail_size) * 35.0 + 18.0
        elif best_sail_size > s_max:
            penalty += (best_sail_size - s_max) * 35.0 + 18.0

        # Sinergia específica de Slalom/Freerace según medida de vela y condiciones de pantano
        vol = float(board.get("volume_l", 118))
        if best_sail_size >= 7.4:
            # Con 7.7 m²: priorizar 137L hasta ~14 kt efectivos o si está racheado; 118L si el viento es sólido (14-17 kt)
            if vol >= 130 and (eff_board_kt <= 14.2 or is_gusty_condition):
                penalty -= 8.0
            elif 110 <= vol < 130 and eff_board_kt > 14.2 and not is_gusty_condition:
                penalty -= 6.0
        elif 6.5 <= best_sail_size < 7.4:
            # Con 6.8 m² (3 Cam): su pareja estrella en el Burguillo es la Goya Proton 118L
            if 110 <= vol <= 125:
                penalty -= 10.0
            elif vol >= 130 and base_kt < 11.5 and is_gusty_condition:
                penalty -= 6.0
        else:
            # Con 6.0 m² (AirCam): Goya Bolt 4 99L con viento asentado (>=17.5 kt efectivos), o Proton 118L si hay muchos huecos
            if vol <= 105 and eff_board_kt >= 17.2:
                penalty -= 12.0
            elif 110 <= vol <= 125 and eff_board_kt < 17.2:
                penalty -= 8.0

        # En pantano muy racheado, premiar que el volumen sea al menos peso_rider + 25L si el viento base < 14 kt
        if is_gusty_condition and base_kt < 14.0 and vol < (weight_kg + 25):
            penalty += ((weight_kg + 25) - vol) * 0.6

        score = max(0.0, 100.0 - (dist_w * 5.0 + penalty * 4.0))
        scored_boards.append((score, board))

    scored_boards.sort(key=lambda x: x[0], reverse=True)
    best_board = scored_boards[0][1]
    best_board_score = round(scored_boards[0][0])
    alt_board = scored_boards[1][1] if len(scored_boards) > 1 else best_board

    # Consejos de trimado específicos según condiciones
    trim_tips = []
    if gust_diff >= 7.0:
        trim_tips.append(
            f"Racha alta (+{gust_diff:.0f} kt sobre la base): tensa amura (downhaul) +1 cm extra para que la baluma abra en las rachas fuertes sin perder potencia abajo."
        )
    elif gust_diff <= 4.0 and base_kt < 15.0:
        trim_tips.append(
            "Viento constante pero suave: deja la escota (outhaul) ligeramente suelta (+1.5 cm de bolsa) para maximizar potencia de salida al planeo."
        )
    else:
        trim_tips.append(
            "Ajuste estándar de amura y escota. Pie de mástil en posición central (130-132 cm)."
        )

    if spot_info["quality"] in ("mala", "regular"):
        trim_tips.append(
            f"Atención en El Burguillo ({compass}): orientación cruzada con huecos. Navega buscando el centro del embalse y evita ceñir pegado a la orilla de barlovento."
        )
    else:
        trim_tips.append(
            f"Orientación {compass} ({spot_info['label']}): entra bien canalizada por el eje del pantano."
        )

    return {
        "status": status,
        "status_label": status_label,
        "status_color": status_color,
        "input": {
            "wind_speed_kt": round(base_kt, 1),
            "wind_gust_kt": round(gust_kt, 1),
            "gust_diff_kt": round(gust_diff, 1),
            "compass": compass,
            "dir_deg": round(dir_deg, 0),
            "eff_sail_kt": round(eff_sail_kt, 1),
            "eff_board_kt": round(eff_board_kt, 1),
            "is_gusty": is_gusty_condition
        },
        "spot_analysis": spot_info,
        "primary": {
            "board": best_board,
            "sail": best_sail,
            "match_score": int(round((best_sail_score + best_board_score) / 2.0)),
            "summary": f"{best_board['name']} ({best_board['volume_l']}L) + {best_sail['name']} ({best_sail['size_m2']} m²)"
        },
        "alternative": {
            "board": alt_board,
            "sail": alt_sail,
            "reason": (
                "Alternativa si prefieres más control en las rachas fuertes"
                if float(alt_sail.get("size_m2", 0)) < float(best_sail.get("size_m2", 0))
                else "Alternativa si quieres asegurar el planeo en los huecos de viento"
            ),
            "summary": f"{alt_board['name']} ({alt_board['volume_l']}L) + {alt_sail['name']} ({alt_sail['size_m2']} m²)"
        },
        "trim_tips": trim_tips
    }
