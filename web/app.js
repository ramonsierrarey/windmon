/**
 * WindMon Burguillo - Frontend Logic (Mobile-First Visual Forecast & Spot Advisor)
 * Diseño visual horizontal inspirado en apps móviles de viento + Quiver Goya / North 3Di / Loft.
 */

const BURGUILLO_COORDS = { lat: 40.429030, lon: -4.564277 };
const IS_STATIC_DEPLOYMENT = window.WINDMON_STATIC_DEPLOYMENT === true;

const COMPASS_16 = [
  "N", "NNE", "NE", "ENE",
  "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW",
  "W", "WNW", "NW", "NNW"
];

const COMPASS_DEG = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5, NW: 315, NNW: 337.5
};

const SPOT_DIRECTION_INFO = {
  N:   { quality: "buena",     label: "Norte encañonado", thermal_boost: 1.15, gustiness: "media-alta", notes: "Entra con fuerza desde la Sierra. Más racheado pegado a la orilla norte, muy potente del centro hacia el sur del embalse." },
  NNE: { quality: "excelente", label: "NNE alineado al valle", thermal_boost: 1.20, gustiness: "media", notes: "Alineado con el eje del embalse. Fetch largo y viento más constante en el centro del pantano." },
  NE:  { quality: "excelente", label: "Nordeste clásico (Eje del pantano)", thermal_boost: 1.22, gustiness: "baja-media", notes: "Una de las mejores direcciones en El Burguillo. Acelera por encañonamiento en Las Cruceras y centro del embalse." },
  ENE: { quality: "buena",     label: "Este-Nordeste", thermal_boost: 1.12, gustiness: "media", notes: "Funciona bien en la mitad occidental del embalse, algo de sombra de viento cerca de la orilla este." },
  E:   { quality: "regular",   label: "Levante (Cruzado)", thermal_boost: 1.05, gustiness: "alta", notes: "Cruza transversalmente la zona estrecha; suele entrar racheado y con roles. Conviene tabla con más volumen." },
  ESE: { quality: "mala",      label: "ESE (Muy cruzado / Sombra)", thermal_boost: 0.95, gustiness: "muy alta", notes: "Desfavorable por las laderas del sureste. Muchos huecos de viento." },
  SE:  { quality: "mala",      label: "Sureste (Racheado por montaña)", thermal_boost: 0.95, gustiness: "muy alta", notes: "Dirección perpendicular al valle. Rachas bruscas y calmas prolongadas." },
  SSE: { quality: "regular",   label: "Sur-Sureste", thermal_boost: 1.05, gustiness: "alta", notes: "Entra mejor cerca de la presa, pero rolón en la zona norte." },
  S:   { quality: "buena",     label: "Sur (Hacia Las Cruceras)", thermal_boost: 1.12, gustiness: "media", notes: "Buen recorrido desde la cola/presa hacia la zona norte del embalse." },
  SSW: { quality: "excelente", label: "SSW (Alineado al cañón)", thermal_boost: 1.20, gustiness: "baja-media", notes: "Excelente canalización subiendo por el valle del Alberche. Choppy ordenado para saltar/trasluchar." },
  SW:  { quality: "excelente", label: "Suroeste dominante (Clásico Burguillo)", thermal_boost: 1.25, gustiness: "baja-media", notes: "La dirección reina en El Burguillo (tanto con frentes atlánticos como térmico de tarde). Fetch largo y noble." },
  WSW: { quality: "excelente", label: "Oeste-Suroeste (Poniente canalizado)", thermal_boost: 1.20, gustiness: "media", notes: "Muy frecuente por las tardes de primavera, verano y otoño. Entra franco en Las Cruceras." },
  W:   { quality: "buena",     label: "Poniente (Oeste)", thermal_boost: 1.12, gustiness: "media-alta", notes: "Buen viento en las zonas abiertas del embalse; algo racheado en las calas resguardadas al oeste." },
  WNW: { quality: "regular",   label: "Oeste-Noroeste", thermal_boost: 1.00, gustiness: "alta", notes: "Descarga desde Gredos/Paramera con rachas fuertes y huecos. Monta tabla con reserva de flotabilidad." },
  NW:  { quality: "mala",      label: "Noroeste (Cruzado y racheado)", thermal_boost: 0.95, gustiness: "muy alta", notes: "Baja perpendicular desde la sierra; genera rachas violentas en el agua seguidas de calmas." },
  NNW: { quality: "regular",   label: "Norte-Noroeste", thermal_boost: 1.05, gustiness: "alta", notes: "Navegable si tiene suficiente intensidad base, pero racheado." }
};

const DEFAULT_QUIVER = {
  rider: {
    name: "Rider Burguillo",
    weight_kg: 70,
    style: "Slalom / Freerace"
  },
  boards: [
    {
      id: "goya-proton-137",
      name: "Goya Proton 137L",
      short_name: "137L",
      brand_model: "Goya Proton Pro Slalom 137L (Manga ~85 cm)",
      volume_l: 137,
      width_cm: 85,
      min_sail_m2: 6.6,
      max_sail_m2: 9.5,
      ideal_wind_min_kt: 10,
      ideal_wind_max_kt: 16,
      fin_cm: "44–46 cm Slalom Deep Tuttle"
    },
    {
      id: "goya-proton-118",
      name: "Goya Proton 118L",
      short_name: "118L",
      brand_model: "Goya Proton Pro Slalom 118L (Manga ~75 cm)",
      volume_l: 118,
      width_cm: 75,
      min_sail_m2: 5.8,
      max_sail_m2: 8.4,
      ideal_wind_min_kt: 13,
      ideal_wind_max_kt: 21,
      fin_cm: "38–40 cm Slalom Tuttle"
    },
    {
      id: "goya-bolt4-99",
      name: "Goya Bolt 4 99L",
      short_name: "99L",
      brand_model: "Goya Bolt 4 Freerace Carbon 99L (Manga ~63 cm)",
      volume_l: 99,
      width_cm: 63,
      min_sail_m2: 4.7,
      max_sail_m2: 7.0,
      ideal_wind_min_kt: 17,
      ideal_wind_max_kt: 30,
      fin_cm: "32–34 cm Freerace Tuttle"
    }
  ],
  sails: [
    {
      id: "north-freespeed-77",
      name: "North Freespeed Gen1 3Di 7.7 m²",
      short_name: "7.7",
      brand_model: "North Sails 3Di Molded Freerace 7.7 m²",
      size_m2: 7.7,
      cambers: 0,
      wind_min_kt: 10.5,
      wind_sweet_kt: 13.5,
      wind_max_kt: 17.5
    },
    {
      id: "loft-switchblade-68",
      name: "Loft Switchblade 6.8 m² (3 Cam)",
      short_name: "6.8",
      brand_model: "Loft Sails Switchblade 6.8 m² · 3 Cambers",
      size_m2: 6.8,
      cambers: 3,
      wind_min_kt: 13.5,
      wind_sweet_kt: 17.0,
      wind_max_kt: 22.0
    },
    {
      id: "north-freerace-60",
      name: "North Freerace 3Di 6.0 m² (AirCam)",
      short_name: "6.0",
      brand_model: "North Sails Freerace 3Di AirCam 6.0 m²",
      size_m2: 6.0,
      cambers: 1,
      wind_min_kt: 17.0,
      wind_sweet_kt: 21.0,
      wind_max_kt: 28.0
    }
  ]
};

let state = {
  activeTab: "forecast",
  forecastModel: "consensus",
  meterUnit: "kt",
  windBaseKt: 15.0,
  windGustKt: 20.0,
  windCompass: "SW",
  windDirDeg: 225,
  mapLayerMode: 0,
  quiver: JSON.parse(localStorage.getItem("windmon_quiver_v3") || "null") || DEFAULT_QUIVER,
  forecastDays: [],
  allFlatHours: [],
  selectedFlatHourIdx: 0,
  measurements: JSON.parse(localStorage.getItem("windmon_measurements") || "[]")
};

let leafletMap = null;
let tileLayerLight = null;
let tileLayerSat = null;

// Conversores de unidades
function ktToUnit(kt, unit) {
  if (unit === "kmh") return kt * 1.852;
  if (unit === "ms") return kt * 0.514444;
  return kt;
}

function unitToKt(val, unit) {
  if (unit === "kmh") return val / 1.852;
  if (unit === "ms") return val / 0.514444;
  return val;
}

function ktToBeaufort(kt) {
  if (kt < 1) return 0;
  if (kt <= 3) return 1;
  if (kt <= 6) return 2;
  if (kt <= 10) return 3;
  if (kt <= 16) return 4;
  if (kt <= 21) return 5;
  if (kt <= 27) return 6;
  if (kt <= 33) return 7;
  return 8;
}

function degToCompass(deg) {
  const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return COMPASS_16[idx];
}

// ============================================================================
// ESCALA DE COLOR REALISTA (SIN VERDE ENGAÑOSO EN CALMAS)
// ============================================================================
function getWindBgColor(kt) {
  const v = Number(kt || 0);
  if (v < 7)  return "#47627d"; // Calma / Azul pizarra apagado (igual que 1,8 - 3,0 kts en la captura)
  if (v < 10.5) return "#567999"; // Brisa floja sin planeo
  if (v < 13.5) return "#38bdf8"; // Cian: Térmico suave / Planeo técnico con 7.7 + 137L
  if (v < 17.5) return "#22c55e"; // Verde vivo: Planeo franco (13.5 a 17.5 kt)
  if (v < 22.0) return "#eab308"; // Ámbar / Amarillo: Viento fuerte (17.5 a 22 kt)
  return "#ec4899";               // Magenta / Fuerte (> 22 kt)
}

function getKtPillClass(kt) {
  if (kt < 10.5) return "kt-low";
  if (kt < 13.5) return "kt-marginal";
  if (kt < 18.0) return "kt-good";
  if (kt < 23.0) return "kt-strong";
  return "kt-nuke";
}

// ============================================================================
// MOTOR DE RECOMENDACIÓN GOYA + NORTH 3Di / LOFT (RIDER 70 KG)
// ============================================================================
function recommendGearLocal(windSpeedKt, windGustKt, compass, quiver) {
  const baseKt = Math.max(0, Number(windSpeedKt));
  const gustKt = Math.max(baseKt, Number(windGustKt));
  const gustDiff = gustKt - baseKt;
  const spotInfo = SPOT_DIRECTION_INFO[compass] || SPOT_DIRECTION_INFO["SW"];
  const weightKg = Number(quiver?.rider?.weight_kg || 70);
  const weightFactor = Math.pow(75.0 / Math.max(45.0, weightKg), 0.55);

  const effSailKt = baseKt * weightFactor;
  const effBoardKt = effSailKt;

  let status = "optimo";
  let statusLabel = "¡Condiciones óptimas de planeo!";
  if (effSailKt < 9.5) {
    status = "no_planeo";
    statusLabel = "Viento medio insuficiente para planear";
  } else if (effSailKt < 13.5) {
    status = "marginal";
    statusLabel = "Planeo técnico / Viento suave (7.7 m² + 137L)";
  } else if (effSailKt > 24.0) {
    status = "fuerte";
    statusLabel = "Viento muy fuerte (6.0 m² + 99L)";
  }

  const sails = [...(quiver.sails || [])].sort((a, b) => b.size_m2 - a.size_m2);
  const boards = [...(quiver.boards || [])].sort((a, b) => b.volume_l - a.volume_l);
  if (!sails.length || !boards.length) return null;

  const scoredSails = sails.map(sail => {
    const wMin = Number(sail.wind_min_kt || 11);
    const wMax = Number(sail.wind_max_kt || 20);
    const wSweet = Number(sail.wind_sweet_kt || (wMin + wMax) / 2);
    const dist = Math.abs(effSailKt - wSweet);
    let penalty = 0;
    if (effSailKt < wMin) penalty += (wMin - effSailKt) * 2.8;
    else if (effSailKt > wMax) penalty += (effSailKt - wMax) * 3.2;
    const score = Math.max(0, 100 - (dist * 6 + penalty * 5));
    return { score, sail };
  }).sort((a, b) => b.score - a.score);

  const bestSail = scoredSails[0].sail;
  const altSail = (scoredSails[1] || scoredSails[0]).sail;
  const bestSailSize = Number(bestSail.size_m2);

  const scoredBoards = boards.map(board => {
    const bMin = Number(board.ideal_wind_min_kt || 12);
    const bMax = Number(board.ideal_wind_max_kt || 22);
    const bSweet = (bMin + bMax) / 2;
    const sMin = Number(board.min_sail_m2 || 4.7);
    const sMax = Number(board.max_sail_m2 || 9.0);
    const dist = Math.abs(effBoardKt - bSweet);
    let penalty = 0;
    if (effBoardKt < bMin) penalty += (bMin - effBoardKt) * 2.5;
    else if (effBoardKt > bMax) penalty += (effBoardKt - bMax) * 2.5;
    if (bestSailSize < sMin) penalty += (sMin - bestSailSize) * 35 + 18;
    else if (bestSailSize > sMax) penalty += (bestSailSize - sMax) * 35 + 18;

    const vol = Number(board.volume_l || 118);
    if (bestSailSize >= 7.4) {
      if (vol >= 130 && effBoardKt <= 14.2) penalty -= 8;
      else if (vol >= 110 && vol < 130 && effBoardKt > 14.2) penalty -= 6;
    } else if (bestSailSize >= 6.5 && bestSailSize < 7.4) {
      if (vol >= 110 && vol <= 125) penalty -= 10;
    } else {
      if (vol <= 105 && effBoardKt >= 17.2) penalty -= 12;
      else if (vol >= 110 && vol <= 125 && effBoardKt < 17.2) penalty -= 8;
    }

    const score = Math.max(0, 100 - (dist * 5 + penalty * 4));
    return { score, board };
  }).sort((a, b) => b.score - a.score);

  const bestBoard = scoredBoards[0].board;
  const altBoard = (scoredBoards[1] || scoredBoards[0]).board;

  const tips = [];
  if (gustDiff >= 7) {
    tips.push(`Diferencial de racha alto (+${gustDiff.toFixed(0)} kt): tensa amura +1 cm para abrir baluma en la racha y mantén bolsa en escota para pasar los huecos.`);
  } else if (gustDiff <= 4 && baseKt < 15) {
    tips.push(`Viento constante pero justo: suelta 1 cm de escota (outhaul) para acelerar la salida al planeo.`);
  } else {
    tips.push(`Rango de viento noble: tensión estándar de amura y escota, pie de mástil centrado.`);
  }
  tips.push(`${compass} (${spotInfo.label}): ${spotInfo.notes}`);

  return {
    status,
    statusLabel,
    effSailKt: effSailKt.toFixed(1),
    effBoardKt: effBoardKt.toFixed(1),
    isGusty: gustDiff >= 6.0 || spotInfo.gustiness === "alta" || spotInfo.gustiness === "muy alta",
    spotInfo,
    primary: {
      board: bestBoard,
      sail: bestSail,
      matchScore: Math.round((scoredSails[0].score + scoredBoards[0].score) / 2)
    },
    alternative: {
      board: altBoard,
      sail: altSail
    },
    tips
  };
}

// ============================================================================
// MAPA DE LAS CRUCERAS + FLECHA DE NUDOS
// ============================================================================
function initSpotMap() {
  const mapEl = document.getElementById("burguillo-map");
  if (!mapEl) return;

  const svgEl = document.getElementById("wind-compass-svg");
  if (svgEl) {
    let dragging = false;
    const handlePointer = (clientX, clientY) => {
      const rect = svgEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let deg = Math.round((Math.atan2(clientX - cx, -(clientY - cy)) * 180) / Math.PI);
      if (deg < 0) deg += 360;
      state.windDirDeg = deg;
      state.windCompass = degToCompass(deg);
      const dirLabel = document.getElementById("disp-wind-dir");
      if (dirLabel) dirLabel.textContent = `${state.windCompass} (${deg}°)`;
      renderCompassWheel();
      updateSpotRecommendationUI();
    };

    svgEl.addEventListener("pointerdown", e => {
      dragging = true;
      svgEl.setPointerCapture(e.pointerId);
      handlePointer(e.clientX, e.clientY);
    });
    svgEl.addEventListener("pointermove", e => {
      if (dragging) handlePointer(e.clientX, e.clientY);
    });
    svgEl.addEventListener("pointerup", () => { dragging = false; });
    svgEl.addEventListener("pointercancel", () => { dragging = false; });
  }

  if (typeof L !== "undefined") {
    try {
      leafletMap = L.map("burguillo-map", {
        center: [BURGUILLO_COORDS.lat, BURGUILLO_COORDS.lon],
        zoom: 15,
        zoomControl: false
      });

      tileLayerLight = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      });
      tileLayerSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 18
      });

      tileLayerLight.addTo(leafletMap);
    } catch (_) {}
  }
}

function cycleMapLayer() {
  state.mapLayerMode = (state.mapLayerMode + 1) % 3;
  if (!leafletMap) return;
  leafletMap.setView([BURGUILLO_COORDS.lat, BURGUILLO_COORDS.lon], 15);
  if (state.mapLayerMode === 0) {
    if (tileLayerSat) leafletMap.removeLayer(tileLayerSat);
    if (tileLayerLight) tileLayerLight.addTo(leafletMap);
  } else if (state.mapLayerMode === 1) {
    if (tileLayerLight) leafletMap.removeLayer(tileLayerLight);
    if (tileLayerSat) tileLayerSat.addTo(leafletMap);
  } else {
    if (tileLayerLight) leafletMap.removeLayer(tileLayerLight);
    if (tileLayerSat) leafletMap.removeLayer(tileLayerSat);
  }
}

function setMapWindIndicator(wsKt, wgKt, deg, comp, contextLabel) {
  const pointerGroup = document.getElementById("wind-pointer-group");
  const pointerShape = document.getElementById("wind-pointer-shape");
  const textGroup = document.getElementById("wind-pointer-text-group");
  const ktsText = document.getElementById("wind-pointer-kts");
  const coordsEl = document.getElementById("map-spot-coords");

  if (!pointerGroup || !ktsText) return;

  const angle = Number(deg ?? 225);
  pointerGroup.setAttribute("transform", `rotate(${angle}, 130, 130)`);
  const textRot = (angle > 0 && angle < 180) ? 90 : -90;
  textGroup.setAttribute("transform", `translate(130, 54) rotate(${textRot})`);

  const ktFormatted = Number(wsKt).toFixed(1).replace(".", ",");
  ktsText.textContent = `${ktFormatted} kts`;

  // Color realista en la flecha del mapa: gris/azul pizarra si es calma (<10.5 kt),
  // cian si es planeo suave (10.5-13.5 kt), verde vivo solo cuando hay planeo franco (>=13.5 kt)
  let fillColor = "#64829e"; // Calma / sin planeo
  let textColor = "#0b1520";
  if (wsKt >= 18 || wgKt >= 23) {
    fillColor = "#eab308"; // Viento fuerte (Ámbar)
    textColor = "#1e1b4b";
  } else if (wsKt >= 13.5 || wgKt >= 17) {
    fillColor = "#22c55e"; // Planeo franco (Verde vivo)
    textColor = "#052e16";
  } else if (wsKt >= 10.5 || wgKt >= 13.5) {
    fillColor = "#38bdf8"; // Planeo técnico 7.7 + 137L (Cian)
    textColor = "#082f49";
  }
  pointerShape.setAttribute("fill", fillColor);
  ktsText.setAttribute("fill", textColor);

  if (coordsEl) {
    const wgFmt = Number(wgKt).toFixed(1).replace(".", ",");
    coordsEl.textContent = `${contextLabel ? contextLabel + " · " : ""}${comp} (${Math.round(angle)}°) · Racha ${wgFmt} kts`;
  }
}

// ============================================================================
// NAVEGACIÓN DE PESTAÑAS
// ============================================================================
function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll(".tab-section").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".top-tab-btn").forEach(el => el.classList.remove("active"));

  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.classList.add("active");

  const btn = document.querySelector(`.top-tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add("active");

  // Mostrar el mapa superior en Pronóstico y en Medidor Spot; ocultarlo en Historial y Mi Quiver para ganar espacio
  const mapWrapper = document.getElementById("shared-map-wrapper");
  if (mapWrapper) {
    mapWrapper.style.display = (tabId === "forecast" || tabId === "spot") ? "block" : "none";
    if (leafletMap && (tabId === "forecast" || tabId === "spot")) {
      setTimeout(() => leafletMap.invalidateSize(), 80);
    }
  }

  if (tabId === "spot") {
    updateSpotRecommendationUI();
  } else if (tabId === "forecast") {
    if (!state.allFlatHours.length) {
      loadWeeklyForecast();
    } else {
      selectFlatHour(state.selectedFlatHourIdx, false);
    }
  } else if (tabId === "history") {
    loadHistoryStats();
  } else if (tabId === "quiver") {
    renderQuiverEditor();
  }
}

// ============================================================================
// PESTAÑA 1: PRONÓSTICO 7D VISUAL HORIZONTAL (COMO EN LA CAPTURA)
// ============================================================================
function selectForecastModel(modelKey) {
  state.forecastModel = modelKey;
  document.querySelectorAll(".model-pill").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.model === modelKey);
  });
  loadWeeklyForecast();
}

function getSailSvgHtml(rec) {
  const isPlaning = rec && rec.status !== "no_planeo";
  if (!isPlaning) {
    return `
      <span style="font-size:0.68rem; color:#64748b; font-weight:700;">-</span>
      <svg width="20" height="24" viewBox="0 0 24 28" style="opacity:0.18;">
        <path d="M7 25 L8 3 C18 8 20 17 17 24 Z" fill="#94a3b8"/>
        <rect x="4" y="25" width="16" height="2" rx="1" fill="#94a3b8"/>
      </svg>
    `;
  }

  const sailShort = rec.primary.sail.short_name || `${rec.primary.sail.size_m2}`;
  const boardShort = rec.primary.board.short_name || `${rec.primary.board.volume_l}L`;
  const sailColor = rec.primary.sail.size_m2 >= 7.4 ? "#38bdf8" : (rec.primary.sail.size_m2 >= 6.5 ? "#00d68f" : "#f59e0b");

  return `
    <div class="wx-sail-gear-txt" style="color:${sailColor};">${sailShort}</div>
    <svg width="20" height="22" viewBox="0 0 24 28">
      <path d="M7 24 L8 2 C19 7 21 16 18 23 Z" fill="${sailColor}"/>
      <rect x="4" y="24" width="16" height="2.2" rx="1" fill="#e2e8f0"/>
    </svg>
    <div style="font-size:0.58rem; color:#cbd5e1; font-weight:700; margin-top:-2px;">${boardShort}</div>
  `;
}

// Flecha que apunta hacia dónde va el viento (convención meteorológica en tablas de viento: wdir + 180°)
function getFlowArrowSvg(wdirDeg) {
  const flowDeg = (Number(wdirDeg) + 180) % 360;
  return `
    <svg width="16" height="16" viewBox="0 0 24 24" style="transform:rotate(${flowDeg}deg);">
      <path d="M12 3l6 6h-4v12h-4V9H6l6-6z" fill="#cbd5e1"/>
    </svg>
  `;
}

async function loadWeeklyForecast() {
  const scrollContainer = document.getElementById("wx-hours-scroll");
  scrollContainer.innerHTML = `<div style="padding:24px; color:var(--text-muted); font-size:0.84rem;">Consultando pronóstico para Embalse del Burguillo...</div>`;

  try {
    const modelSel = state.forecastModel;
    let url = `https://api.open-meteo.com/v1/forecast?latitude=${BURGUILLO_COORDS.lat}&longitude=${BURGUILLO_COORDS.lon}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,precipitation&wind_speed_unit=kn&timezone=Europe%2FMadrid&forecast_days=7`;
    if (modelSel !== "consensus" && modelSel !== "best_match") {
      url += `&models=${modelSel}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    const h = data.hourly;

    const daysMap = {};
    const flatHours = [];

    for (let i = 0; i < h.time.length; i++) {
      const [datePart, timePart] = h.time[i].split("T");
      const hourNum = parseInt(timePart.split(":")[0], 10);
      // Mostramos horas de 08:00 a 21:00 para centrarnos en el horario útil de navegación
      if (hourNum < 8 || hourNum > 21) continue;

      let ws = Number(h.wind_speed_10m[i] || 0);
      let wg = Number(h.wind_gusts_10m[i] || ws);
      const wdir = Number(h.wind_direction_10m[i] || 225);
      const temp = Number(h.temperature_2m[i] || 15);
      const rain = Number(h.precipitation?.[i] || 0);
      const comp = degToCompass(wdir);
      const sInfo = SPOT_DIRECTION_INFO[comp] || SPOT_DIRECTION_INFO["SW"];

      if (modelSel === "consensus") {
        const boost = sInfo.thermal_boost || 1.0;
        if (hourNum >= 13 && hourNum <= 19 && temp >= 18 && ws >= 6.5) {
          ws = ws * boost;
          wg = Math.max(wg * (0.95 + (boost - 1.0) * 0.8), ws * 1.25);
        } else if (ws >= 7.0) {
          ws = ws * (1.0 + (boost - 1.0) * 0.45);
        }
      }

      const rec = recommendGearLocal(ws, wg, comp, state.quiver);
      const hourObj = {
        flatIdx: flatHours.length,
        date: datePart,
        hourStr: String(hourNum).padStart(2, "0"),
        hourNum,
        ws: Number(ws.toFixed(1)),
        wg: Number(wg.toFixed(1)),
        wdir: Math.round(wdir),
        comp,
        temp: Number(temp.toFixed(1)),
        rain: Number(rain.toFixed(1)),
        spotLabel: sInfo.label,
        rec
      };

      if (!daysMap[datePart]) daysMap[datePart] = [];
      daysMap[datePart].push(hourObj);
      flatHours.push(hourObj);
    }

    state.forecastDays = Object.keys(daysMap).map((d, dIdx) => {
      const hrs = daysMap[d];
      const planingCount = hrs.filter(x => x.rec && x.rec.status !== "no_planeo").length;
      return {
        dayIdx: dIdx,
        date: d,
        hasWind: planingCount >= 2,
        firstFlatIdx: hrs[0]?.flatIdx || 0,
        hours: hrs
      };
    });
    state.allFlatHours = flatHours;

    renderWeekDaysAndOverviewBar();
    renderHorizontalForecastStrip();
    renderBestWindowsSummary();

    // Seleccionar por defecto la primera hora navegable, o las 14:00 de hoy
    const firstPlaning = flatHours.find(x => x.rec && x.rec.status !== "no_planeo");
    const defaultHour = firstPlaning || flatHours.find(x => x.hourNum === 14) || flatHours[0];
    if (defaultHour) {
      selectFlatHour(defaultHour.flatIdx, true);
    }
  } catch (err) {
    scrollContainer.innerHTML = `<div style="padding:20px; color:#fb7185;">Error al cargar pronóstico: ${err.message}</div>`;
  }
}

function renderWeekDaysAndOverviewBar() {
  const daysStrip = document.getElementById("week-days-strip");
  daysStrip.innerHTML = state.forecastDays.map((dObj, idx) => {
    const dt = new Date(dObj.date + "T12:00:00");
    const wName = dt.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "").slice(0, 2);
    const dNum = String(dt.getDate()).padStart(2, "0");
    const windCls = dObj.hasWind ? "has-wind" : "";
    return `
      <div class="week-day-item ${windCls}" id="week-day-pill-${idx}" onclick="scrollToDay(${idx})">
        <div class="week-day-name">${wName}</div>
        <div class="week-day-num">${dNum}</div>
      </div>
    `;
  }).join("");

  const track = document.getElementById("wind-overview-track");
  const segsHtml = state.allFlatHours.map(h => {
    // Pintamos la barra según el viento efectivo / racha solo cuando realmente sube
    const bg = getWindBgColor(h.ws);
    return `<div class="wind-overview-seg" style="background:${bg};"></div>`;
  }).join("");

  track.innerHTML = segsHtml + `<div class="wind-overview-thumb" id="wind-overview-thumb" style="left: 0%;"></div>`;
}

function renderHorizontalForecastStrip() {
  const scrollContainer = document.getElementById("wx-hours-scroll");

  scrollContainer.innerHTML = state.forecastDays.map(dObj => {
    const dt = new Date(dObj.date + "T12:00:00");
    const dayHeaderStr = dt.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).toUpperCase().replace(".", "");

    const colsHtml = dObj.hours.map(h => {
      const wsFmt = h.ws.toFixed(1).replace(".", ",");
      const wgFmt = h.wg.toFixed(1).replace(".", ",");
      const wsBg = getWindBgColor(h.ws);
      const wgBg = getWindBgColor(h.wg * 0.85);
      const tempFmt = h.temp >= 10 ? `${Math.round(h.temp)}°` : `${h.temp.toFixed(1).replace(".", ",")}°`;

      return `
        <div class="wx-hour-col" id="wx-col-${h.flatIdx}" onclick="selectFlatHour(${h.flatIdx}, false)">
          <div class="wx-cell-hour">${h.hourStr}</div>
          <div class="wx-cell-sail">${getSailSvgHtml(h.rec)}</div>
          <div class="wx-cell-dir" title="${h.comp} (${h.wdir}°)">${getFlowArrowSvg(h.wdir)}</div>
          <div class="wx-cell-kt" style="background:${wsBg};">${wsFmt}</div>
          <div class="wx-cell-kt" style="background:${wgBg};">${wgFmt}</div>
          <div class="wx-cell-temp">${tempFmt}</div>
          <div class="wx-cell-rain">${h.rain > 0 ? h.rain : 0}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="wx-day-group" id="wx-day-group-${dObj.dayIdx}">
        <div class="wx-day-group-header">
          <span>${dayHeaderStr}</span>
          <small>🌅 07:55 🌇 18:10</small>
        </div>
        <div class="wx-day-cols">${colsHtml}</div>
      </div>
    `;
  }).join("");
}

function selectFlatHour(flatIdx, shouldScroll) {
  if (!state.allFlatHours.length) return;
  const idx = Math.max(0, Math.min(state.allFlatHours.length - 1, flatIdx));
  state.selectedFlatHourIdx = idx;
  const h = state.allFlatHours[idx];

  document.querySelectorAll(".wx-hour-col.selected").forEach(el => el.classList.remove("selected"));
  const colEl = document.getElementById(`wx-col-${idx}`);
  if (colEl) {
    colEl.classList.add("selected");
    if (shouldScroll) {
      const scroller = document.getElementById("wx-hours-scroll");
      scroller.scrollTo({ left: Math.max(0, colEl.offsetLeft - 90), behavior: "smooth" });
    }
  }

  // Actualizar posición del círculo blanco en la barra resumen
  const thumb = document.getElementById("wind-overview-thumb");
  if (thumb) {
    const pct = (idx / Math.max(1, state.allFlatHours.length - 1)) * 100;
    thumb.style.left = `${pct}%`;
  }

  // Marcar día activo en la tira superior
  const dayObj = state.forecastDays.find(d => d.date === h.date);
  document.querySelectorAll(".week-day-item").forEach((el, i) => {
    el.classList.toggle("active", dayObj && dayObj.dayIdx === i);
  });

  // Actualizar flecha del mapa de Las Cruceras arriba
  const dt = new Date(h.date + "T12:00:00");
  const shortDay = dt.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
  setMapWindIndicator(h.ws, h.wg, h.wdir, h.comp, `${shortDay} ${h.hourStr}:00`);

  // Actualizar banda de propuesta de material Goya / North / Loft
  const timeLabel = document.getElementById("sh-time-label");
  const gearLabel = document.getElementById("sh-gear-label");
  timeLabel.textContent = `${shortDay.toUpperCase()} · ${h.hourStr}:00h · ${h.comp} ${h.ws.toFixed(1).replace(".", ",")} / Racha ${h.wg.toFixed(1).replace(".", ",")} kts`;

  if (h.rec && h.rec.status !== "no_planeo") {
    gearLabel.style.color = "#00d68f";
    gearLabel.innerHTML = `🏄‍♂️ <strong>${h.rec.primary.board.name}</strong> + ⛵ <strong>${h.rec.primary.sail.name}</strong>`;
  } else {
    gearLabel.style.color = "#94a3b8";
    gearLabel.textContent = "⚪ Viento insuficiente para planear";
  }
}

function scrollToDay(dayIdx) {
  const dObj = state.forecastDays[dayIdx];
  if (!dObj) return;
  // Si el día tiene horas de tarde (14:00), seleccionamos las 14:00 de ese día
  const targetH = dObj.hours.find(h => h.hourNum === 14) || dObj.hours[0];
  if (targetH) {
    selectFlatHour(targetH.flatIdx, true);
  }
}

function onOverviewBarClick(event) {
  const track = document.getElementById("wind-overview-track");
  const rect = track.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const idx = Math.round(ratio * (state.allFlatHours.length - 1));
  selectFlatHour(idx, true);
}

function onStripScroll() {
  const scroller = document.getElementById("wx-hours-scroll");
  const maxScroll = Math.max(1, scroller.scrollWidth - scroller.clientWidth);
  const ratio = Math.max(0, Math.min(1, scroller.scrollLeft / maxScroll));
  const thumb = document.getElementById("wind-overview-thumb");
  if (thumb) {
    thumb.style.left = `${ratio * 100}%`;
  }
}

function renderBestWindowsSummary() {
  const box = document.getElementById("best-windows-box");
  const windows = [];

  state.forecastDays.forEach(dObj => {
    const planingHours = dObj.hours.filter(h => h.rec && h.rec.status !== "no_planeo");
    if (planingHours.length >= 2) {
      const firstH = planingHours[0];
      const lastH = planingHours[planingHours.length - 1];
      const maxGust = Math.max(...planingHours.map(h => h.wg));
      const avgBase = (planingHours.reduce((s, h) => s + h.ws, 0) / planingHours.length).toFixed(0);
      const midHour = planingHours[Math.floor(planingHours.length / 2)];
      const dt = new Date(dObj.date + "T12:00:00");
      windows.push({
        flatIdx: midHour.flatIdx,
        dayLabel: dt.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }),
        range: `${firstH.hourStr}:00–${lastH.hourStr}:00`,
        comp: midHour.comp,
        windStr: `${avgBase}–${maxGust.toFixed(0)} kt`,
        board: midHour.rec.primary.board.name,
        sail: midHour.rec.primary.sail.name
      });
    }
  });

  if (!windows.length) {
    box.innerHTML = `
      <div style="background:rgba(79,109,140,0.18); border:1px solid var(--border-color); padding:10px 12px; border-radius:10px; font-size:0.8rem; color:#cbd5e1;">
        ℹ️ <strong>Sin ventanas claras de planeo (>12 kt) en este modelo para los próximos 7 días.</strong> Prueba a pulsar en la píldora <em>AROME / HD</em> o <em>ICON7</em> para ver si entra térmico local por la tarde.
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div style="font-size:0.75rem; font-weight:700; color:var(--accent-mint); margin-bottom:6px; text-transform:uppercase;">
      🎯 Franjas con Viento Navegable esta Semana (Pulsa para ir a esa hora):
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:8px;">
      ${windows.map(w => `
        <div onclick="selectFlatHour(${w.flatIdx}, true)" style="cursor:pointer; background:rgba(0,214,143,0.1); border:1px solid rgba(0,214,143,0.4); border-radius:10px; padding:10px;">
          <div style="font-weight:800; color:#fff; font-size:0.84rem;">📅 ${w.dayLabel} (${w.range})</div>
          <div style="font-size:0.78rem; color:var(--accent-mint); font-weight:700; margin:2px 0;">💨 ${w.comp} · ${w.windStr}</div>
          <div style="font-size:0.75rem; color:#e2e8f0;">🏄‍♂️ ${w.board} + ⛵ ${w.sail}</div>
        </div>
      `).join("")}
    </div>
  `;
}

// ============================================================================
// PESTAÑA 2: MEDIDOR PORTÁTIL EN EL SPOT
// ============================================================================
function renderCompassWheel() {
  const container = document.getElementById("compass-grid");
  if (!container) return;
  container.innerHTML = COMPASS_16.map(c => {
    const info = SPOT_DIRECTION_INFO[c];
    const activeCls = state.windCompass === c ? "active" : "";
    const qualCls = `dir-${info.quality}`;
    const shortQual = info.quality === "excelente" ? "★ Top" : (info.quality === "buena" ? "Bueno" : (info.quality === "regular" ? "Racheado" : "Cruzado"));
    return `
      <button class="compass-btn ${qualCls} ${activeCls}" onclick="selectCompass('${c}')">
        ${c}
        <span>${shortQual}</span>
      </button>
    `;
  }).join("");
}

function selectCompass(c) {
  state.windCompass = c;
  state.windDirDeg = COMPASS_DEG[c] ?? 225;
  document.getElementById("disp-wind-dir").textContent = `${c} (${state.windDirDeg}°)`;
  renderCompassWheel();
  updateSpotRecommendationUI();
}

function setMeterUnit(unit) {
  state.meterUnit = unit;
  document.querySelectorAll(".unit-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.unit === unit);
  });

  const baseSlider = document.getElementById("slider-wind-base");
  const gustSlider = document.getElementById("slider-wind-gust");

  if (unit === "kt") {
    baseSlider.min = 3; baseSlider.max = 38; baseSlider.step = 0.5;
    gustSlider.min = 3; gustSlider.max = 45; gustSlider.step = 0.5;
  } else if (unit === "kmh") {
    baseSlider.min = 5; baseSlider.max = 70; baseSlider.step = 1;
    gustSlider.min = 5; gustSlider.max = 85; gustSlider.step = 1;
  } else if (unit === "ms") {
    baseSlider.min = 1.5; baseSlider.max = 20; baseSlider.step = 0.2;
    gustSlider.min = 1.5; gustSlider.max = 24; gustSlider.step = 0.2;
  }

  baseSlider.value = ktToUnit(state.windBaseKt, unit).toFixed(1);
  gustSlider.value = ktToUnit(state.windGustKt, unit).toFixed(1);
  updateSpotRecommendationUI();
}

function adjustWind(which, delta) {
  const slider = document.getElementById(which === "base" ? "slider-wind-base" : "slider-wind-gust");
  const step = state.meterUnit === "ms" ? 0.5 : 1;
  slider.value = Math.max(Number(slider.min), Math.min(Number(slider.max), Number(slider.value) + delta * step));
  onMeterInput();
}

function onMeterInput() {
  const baseVal = Number(document.getElementById("slider-wind-base").value);
  let gustVal = Number(document.getElementById("slider-wind-gust").value);
  if (gustVal < baseVal) {
    gustVal = baseVal;
    document.getElementById("slider-wind-gust").value = gustVal;
  }
  state.windBaseKt = unitToKt(baseVal, state.meterUnit);
  state.windGustKt = unitToKt(gustVal, state.meterUnit);
  updateSpotRecommendationUI();
}

function updateSpotRecommendationUI() {
  const unitLabel = state.meterUnit === "kt" ? "kt" : (state.meterUnit === "kmh" ? "km/h" : "m/s");
  const dispBase = ktToUnit(state.windBaseKt, state.meterUnit).toFixed(1);
  const dispGust = ktToUnit(state.windGustKt, state.meterUnit).toFixed(1);

  document.getElementById("disp-wind-base").innerHTML = `${dispBase} <small>${unitLabel}</small>`;
  document.getElementById("disp-wind-gust").innerHTML = `${dispGust} <small>${unitLabel}</small>`;

  const baseKmh = (state.windBaseKt * 1.852).toFixed(1);
  const baseMs = (state.windBaseKt * 0.5144).toFixed(1);
  const bft = ktToBeaufort(state.windBaseKt);
  document.getElementById("conv-wind-base").textContent =
    `${state.windBaseKt.toFixed(1)} kt · ${baseKmh} km/h · ${baseMs} m/s · Beaufort ${bft}`;

  const gustKmh = (state.windGustKt * 1.852).toFixed(1);
  const diffKt = (state.windGustKt - state.windBaseKt).toFixed(1);
  document.getElementById("conv-wind-gust").textContent =
    `${state.windGustKt.toFixed(1)} kt (${gustKmh} km/h) · Diferencial racha: +${diffKt} kt`;

  const rec = recommendGearLocal(state.windBaseKt, state.windGustKt, state.windCompass, state.quiver);
  if (state.activeTab === "spot") {
    setMapWindIndicator(state.windBaseKt, state.windGustKt, state.windDirDeg, state.windCompass, "Medidor Spot");
  }

  const card = document.getElementById("live-rec-card");
  if (!rec || !card) return;

  card.className = `rec-banner status-${rec.status}`;
  const scoreLabel = rec.status === "no_planeo"
    ? ""
    : ` · Adecuación: <strong>${rec.primary.matchScore}%</strong>`;
  const gearRecommendation = rec.status === "no_planeo"
    ? `
      <div style="background:rgba(19,31,43,0.7); border-radius:9px; padding:12px; font-size:0.82rem; border:1px solid var(--border-color);">
        El viento medio es insuficiente: no se recomienda montar tabla ni vela. La racha es solo informativa.
      </div>
    `
    : `
      <div class="rec-combo-grid">
        <div class="gear-box">
          <div class="gear-type">🏄‍♂️ TABLA TITULAR RECOMENDADA</div>
          <div class="gear-name">${rec.primary.board.name}</div>
          <div class="gear-specs">
            Volumen: <strong>${rec.primary.board.volume_l} L</strong> · Manga: ${rec.primary.board.width_cm || "-"} cm<br/>
            Aleta: ${rec.primary.board.fin_cm || "Estándar"}
          </div>
        </div>
        <div class="gear-box">
          <div class="gear-type">⛵ VELA TITULAR RECOMENDADA</div>
          <div class="gear-name">${rec.primary.sail.name}</div>
          <div class="gear-specs">
            Rango óptimo: <strong>${rec.primary.sail.wind_min_kt}–${rec.primary.sail.wind_max_kt} kt</strong> (Dulce: ${rec.primary.sail.wind_sweet_kt} kt)<br/>
            Cambers: ${rec.primary.sail.cambers || 0}
          </div>
        </div>
      </div>
      <div style="background:rgba(19,31,43,0.7); border-radius:9px; padding:9px 11px; font-size:0.78rem; border:1px solid var(--border-color);">
        <strong>💡 Opción Alternativa:</strong> ${rec.alternative.board.name} + ${rec.alternative.sail.name}
      </div>
    `;
  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <span class="status-badge">${rec.statusLabel}</span>
      <span style="font-size:0.75rem; color:var(--text-muted);">
        Viento medio efectivo: <strong>${rec.effSailKt} kt</strong>${scoreLabel}
      </span>
    </div>
    ${gearRecommendation}
    <ul class="trim-list">
      ${rec.tips.map(t => `<li>${t}</li>`).join("")}
    </ul>
  `;
}

async function saveManualMeasurement() {
  const zone = document.getElementById("meas-zone").value;
  const notes = document.getElementById("meas-notes").value.trim();
  const rec = recommendGearLocal(state.windBaseKt, state.windGustKt, state.windCompass, state.quiver);
  const nowStr = new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });

  const entry = {
    id: Date.now(),
    timestamp: nowStr,
    wind_speed_kt: Number(state.windBaseKt.toFixed(1)),
    wind_gust_kt: Number(state.windGustKt.toFixed(1)),
    wind_compass: state.windCompass,
    spot_zone: zone,
    recommended_board: rec?.status === "no_planeo" ? "-" : (rec?.primary?.board?.name || "-"),
    recommended_sail: rec?.status === "no_planeo" ? "-" : (rec?.primary?.sail?.name || "-"),
    notes
  };

  state.measurements.unshift(entry);
  localStorage.setItem("windmon_measurements", JSON.stringify(state.measurements.slice(0, 100)));

  if (!IS_STATIC_DEPLOYMENT) {
    try {
      await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      });
    } catch (_) {}
  }

  document.getElementById("meas-notes").value = "";
  renderMeasurementsList();
}

function renderMeasurementsList() {
  const container = document.getElementById("measurements-list-container");
  if (!container) return;
  if (!state.measurements.length) {
    container.innerHTML = `<div style="font-size:0.76rem; color:var(--text-muted); text-align:center; padding:8px;">Aún no has guardado mediciones con tu anemómetro portátil.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Zona</th>
            <th>Dir</th>
            <th>Base/Racha</th>
            <th>Equipo</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          ${state.measurements.slice(0, 10).map(m => `
            <tr>
              <td>${m.timestamp}</td>
              <td>${m.spot_zone}</td>
              <td><strong>${m.wind_compass}</strong></td>
              <td><span class="kt-pill ${getKtPillClass(m.wind_gust_kt)}">${m.wind_speed_kt}/${m.wind_gust_kt} kt</span></td>
              <td>${m.recommended_board} + ${m.recommended_sail}</td>
              <td style="text-align:left;">${m.notes || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ============================================================================
// PESTAÑA 3: HISTÓRICO DEL PANTANO DEL BURGUILLO
// ============================================================================
async function loadHistoryStats() {
  const monthFilter = document.getElementById("hist-month-filter").value;
  const localBoost = document.getElementById("hist-local-boost").checked ? "1" : "0";
  const subtitle = document.getElementById("history-meta-subtitle");

  let data = null;
  if (!IS_STATIC_DEPLOYMENT) {
    try {
      const res = await fetch(`./api/history/stats?month=${monthFilter}&local_boost=${localBoost}`);
      if (res.ok) {
        data = await res.json();
      }
    } catch (_) {}
  }

  if (!data || !data.has_data) {
    try {
      const fbRes = await fetch("./history_fallback.json");
      if (fbRes.ok) {
        data = await fbRes.json();
      }
    } catch (_) {}
  }

  if (data && data.has_data) {
    subtitle.textContent = `Periodo: ${data.min_date} a ${data.max_date} (${data.total_hours_db.toLocaleString()} horas registradas).`;
    renderHistoryKPIs(data);
    renderHistoryHeatmap(data.heatmap);
    renderHistoryWindRose(data.wind_rose);
    renderHistoryGearUsage(data.gear_distribution);
  }
}

async function downloadMoreHistory(years) {
  const msg = document.getElementById("hist-status-msg");
  if (IS_STATIC_DEPLOYMENT) {
    msg.textContent = "GitHub Pages solo sirve archivos estáticos. Para ampliar el histórico, inicia el servidor Python.";
    return;
  }

  msg.textContent = `⏳ Descargando histórico de ${years} años...`;
  try {
    const res = await fetch("/api/history/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ years })
    });
    const out = await res.json();
    if (out.ok) {
      msg.textContent = `✅ ${out.inserted_hours.toLocaleString()} horas almacenadas (${out.start_date} a ${out.end_date}).`;
      loadHistoryStats();
    }
  } catch (e) {
    msg.textContent = `Error: ${e.message}`;
  }
}

function renderHistoryKPIs(data) {
  const kpiRow = document.getElementById("hist-kpi-row");
  const topRose = [...data.wind_rose].sort((a, b) => b.planing_hours - a.planing_hours)[0] || { compass: "SW", planing_share_pct: 0, label: "" };
  const pctPlaningHours = ((data.total_planing_hours / Math.max(1, data.analyzed_daylight_hours)) * 100).toFixed(1);

  kpiRow.innerHTML = `
    <div class="gear-box">
      <div class="gear-type">DÍAS CON PLANEO</div>
      <div class="gear-name" style="color:var(--accent-mint);">${data.navigable_days_count} días</div>
      <div class="gear-specs">En el periodo analizado</div>
    </div>
    <div class="gear-box">
      <div class="gear-type">HORAS DIURNAS NAVEGABLES</div>
      <div class="gear-name">${data.total_planing_hours.toLocaleString()} h (${pctPlaningHours}%)</div>
      <div class="gear-specs">De 09:00 a 20:00h</div>
    </div>
    <div class="gear-box">
      <div class="gear-type">RUMBO DOMINANTE</div>
      <div class="gear-name" style="color:#38bdf8;">${topRose.compass} (${topRose.planing_share_pct}%)</div>
      <div class="gear-specs">${topRose.label}</div>
    </div>
  `;
}

function renderHistoryHeatmap(heatmap) {
  const monthsNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const hours = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  let html = `<table><thead><tr><th>Mes</th>${hours.map(h => `<th>${h}h</th>`).join("")}</tr></thead><tbody>`;
  for (let m = 1; m <= 12; m++) {
    html += `<tr><td><strong>${monthsNames[m - 1]}</strong></td>`;
    for (const h of hours) {
      const cell = heatmap[String(m)]?.[String(h)] || { avg_gust_kt: 0, planing_pct: 0 };
      const g = cell.avg_gust_kt;
      const pct = cell.planing_pct;
      const cls = getKtPillClass(g);
      html += `
        <td>
          <span class="kt-pill ${cls}">${g.toFixed(0)}</span>
          <div style="font-size:0.62rem; color:var(--text-muted); margin-top:1px;">${pct}%</div>
        </td>
      `;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  document.getElementById("heatmap-container").innerHTML = html;
}

function renderHistoryWindRose(rose) {
  const sorted = [...rose].sort((a, b) => b.planing_hours - a.planing_hours);
  document.getElementById("hist-rose-tbody").innerHTML = sorted.map(r => `
    <tr>
      <td><strong>${r.compass}</strong></td>
      <td style="text-align:left;">${r.label}</td>
      <td>${r.freq_pct}%</td>
      <td><strong>${r.planing_share_pct}%</strong> <small style="color:var(--text-muted);">(${r.planing_hours}h)</small></td>
      <td>${r.avg_speed_kt} kt</td>
      <td><span class="kt-pill ${getKtPillClass(r.avg_gust_kt)}">${r.avg_gust_kt} kt</span></td>
    </tr>
  `).join("");
}

function renderHistoryGearUsage(dist) {
  const container = document.getElementById("hist-gear-usage");
  const combos = Object.entries(dist.combos || {}).sort((a, b) => b[1] - a[1]);
  const totalSimulated = combos.reduce((acc, c) => acc + c[1], 0) || 1;

  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:10px;">
      ${combos.map(([name, hrs]) => {
        const pct = Math.round((hrs / totalSimulated) * 100);
        return `
          <div class="gear-box">
            <div class="gear-type">${pct}% DE LAS SESIONES</div>
            <div class="gear-name" style="font-size:0.95rem;">${name}</div>
            <div style="margin-top:7px; background:#111c26; height:7px; border-radius:99px; overflow:hidden;">
              <div style="width:${pct}%; height:100%; background:var(--accent-mint);"></div>
            </div>
            <div class="gear-specs" style="margin-top:5px;">~${hrs} horas en el periodo</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ============================================================================
// PESTAÑA 4: MI QUIVER
// ============================================================================
function updateHeaderPill() {
  const w = state.quiver?.rider?.weight_kg || 70;
  document.getElementById("header-rider-pill").textContent = `${w} kg · Goya / North / Loft`;
}

async function persistQuiver() {
  localStorage.setItem("windmon_quiver_v3", JSON.stringify(state.quiver));
  updateHeaderPill();
  updateSpotRecommendationUI();
  if (!IS_STATIC_DEPLOYMENT) {
    try {
      await fetch("/api/quiver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiver: state.quiver })
      });
    } catch (_) {}
  }
}

function saveRiderSettings() {
  state.quiver.rider.weight_kg = Number(document.getElementById("rider-weight").value || 70);
  state.quiver.rider.style = document.getElementById("rider-style").value;
  persistQuiver();
}

function renderQuiverEditor() {
  document.getElementById("rider-weight").value = state.quiver?.rider?.weight_kg || 70;
  document.getElementById("rider-style").value = state.quiver?.rider?.style || "";

  document.getElementById("quiver-boards-list").innerHTML = (state.quiver.boards || []).map((b, idx) => `
    <div class="slider-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="color:#38bdf8;">🏄‍♂️ ${b.name} (${b.volume_l} L)</strong>
        <button class="btn btn-danger" style="padding:4px 8px; font-size:0.72rem;" onclick="removeBoard(${idx})">Eliminar</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Modelo</label>
          <input class="form-control" value="${b.name}" onchange="updateBoardField(${idx}, 'name', this.value)" />
        </div>
        <div class="form-group">
          <label>Litros</label>
          <input type="number" class="form-control" value="${b.volume_l}" onchange="updateBoardField(${idx}, 'volume_l', Number(this.value))" />
        </div>
        <div class="form-group">
          <label>Vela Mín / Máx (m²)</label>
          <div style="display:flex; gap:4px;">
            <input type="number" step="0.1" class="form-control" value="${b.min_sail_m2}" onchange="updateBoardField(${idx}, 'min_sail_m2', Number(this.value))" />
            <input type="number" step="0.1" class="form-control" value="${b.max_sail_m2}" onchange="updateBoardField(${idx}, 'max_sail_m2', Number(this.value))" />
          </div>
        </div>
      </div>
    </div>
  `).join("");

  document.getElementById("quiver-sails-list").innerHTML = (state.quiver.sails || []).map((s, idx) => `
    <div class="slider-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="color:var(--accent-mint);">⛵ ${s.name} (${s.size_m2} m²)</strong>
        <button class="btn btn-danger" style="padding:4px 8px; font-size:0.72rem;" onclick="removeSail(${idx})">Eliminar</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Modelo</label>
          <input class="form-control" value="${s.name}" onchange="updateSailField(${idx}, 'name', this.value)" />
        </div>
        <div class="form-group">
          <label>Metros (m²)</label>
          <input type="number" step="0.1" class="form-control" value="${s.size_m2}" onchange="updateSailField(${idx}, 'size_m2', Number(this.value))" />
        </div>
        <div class="form-group">
          <label>Nudos Mín / Dulce / Máx</label>
          <div style="display:flex; gap:4px;">
            <input type="number" step="0.5" class="form-control" value="${s.wind_min_kt}" onchange="updateSailField(${idx}, 'wind_min_kt', Number(this.value))" />
            <input type="number" step="0.5" class="form-control" value="${s.wind_sweet_kt}" onchange="updateSailField(${idx}, 'wind_sweet_kt', Number(this.value))" />
            <input type="number" step="0.5" class="form-control" value="${s.wind_max_kt}" onchange="updateSailField(${idx}, 'wind_max_kt', Number(this.value))" />
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

function updateBoardField(idx, field, val) {
  state.quiver.boards[idx][field] = val;
  persistQuiver();
  renderQuiverEditor();
}

function removeBoard(idx) {
  state.quiver.boards.splice(idx, 1);
  persistQuiver();
  renderQuiverEditor();
}

function addBoardPrompt() {
  state.quiver.boards.push({
    id: "board-" + Date.now(),
    name: "Nueva Tabla",
    short_name: "110L",
    volume_l: 110,
    width_cm: 70,
    min_sail_m2: 5.5,
    max_sail_m2: 7.5,
    ideal_wind_min_kt: 13,
    ideal_wind_max_kt: 22
  });
  persistQuiver();
  renderQuiverEditor();
}

function updateSailField(idx, field, val) {
  state.quiver.sails[idx][field] = val;
  persistQuiver();
  renderQuiverEditor();
}

function removeSail(idx) {
  state.quiver.sails.splice(idx, 1);
  persistQuiver();
  renderQuiverEditor();
}

function addSailPrompt() {
  state.quiver.sails.push({
    id: "sail-" + Date.now(),
    name: "Nueva Vela",
    short_name: "5.4",
    size_m2: 5.4,
    cambers: 0,
    wind_min_kt: 18,
    wind_sweet_kt: 22,
    wind_max_kt: 28
  });
  persistQuiver();
  renderQuiverEditor();
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
async function initApp() {
  initSpotMap();
  renderCompassWheel();
  updateSpotRecommendationUI();
  renderMeasurementsList();
  updateHeaderPill();
  if (IS_STATIC_DEPLOYMENT) {
    document.getElementById("hist-month-filter").disabled = true;
    document.getElementById("hist-local-boost").disabled = true;
    document.getElementById("history-refresh-2").disabled = true;
    document.getElementById("history-refresh-5").disabled = true;
    document.getElementById("hist-status-msg").textContent =
      "Histórico precomputado. Quiver y mediciones se guardan solo en este dispositivo; ampliar datos requiere el servidor Python.";
  }
  loadWeeklyForecast();
}

window.addEventListener("DOMContentLoaded", () => {
  initApp();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
});
