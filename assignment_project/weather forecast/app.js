"use strict";

/* ==============
   API config
   ============== */
const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast";
const GEOJSON_URLS = [
  "https://raw.githubusercontent.com/mptwaktusolat/jakim.geojson/master/malaysia.state.geojson",
  "https://raw.githubusercontent.com/yanganto/malaysia-geojson/master/lib/malaysia.state.geojson",
];

/* ==============
   state catalog
   ============== */
const MALAYSIA_STATES = [
  { name: "Johor", code: "JHR", latitude: 1.4927, longitude: 103.7414, aliases: ["JOHOR", "JHR"] },
  { name: "Kedah", code: "KDH", latitude: 6.1248, longitude: 100.3678, aliases: ["KEDAH", "KDH"] },
  { name: "Kelantan", code: "KTN", latitude: 6.1254, longitude: 102.2386, aliases: ["KELANTAN", "KTN"] },
  { name: "Melaka", code: "MLK", latitude: 2.1896, longitude: 102.2501, aliases: ["MELAKA", "MALACCA", "MLK"] },
  { name: "Negeri Sembilan", code: "NSN", latitude: 2.7297, longitude: 101.9381, aliases: ["NEGERISEMBILAN", "NSN"] },
  { name: "Pahang", code: "PHG", latitude: 3.8077, longitude: 103.326, aliases: ["PAHANG", "PHG"] },
  { name: "Perak", code: "PRK", latitude: 4.5975, longitude: 101.0901, aliases: ["PERAK", "PRK"] },
  { name: "Perlis", code: "PLS", latitude: 6.4414, longitude: 100.1986, aliases: ["PERLIS", "PLS"] },
  { name: "Penang", code: "PNG", latitude: 5.4141, longitude: 100.3288, aliases: ["PENANG", "PULAUPINANG", "PNG"] },
  { name: "Sabah", code: "SBH", latitude: 5.9804, longitude: 116.0735, aliases: ["SABAH", "SBH"] },
  { name: "Sarawak", code: "SWK", latitude: 1.5533, longitude: 110.3592, aliases: ["SARAWAK", "SWK"] },
  { name: "Selangor", code: "SGR", latitude: 3.0733, longitude: 101.5185, aliases: ["SELANGOR", "SGR"] },
  { name: "Terengganu", code: "TRG", latitude: 5.3297, longitude: 103.137, aliases: ["TERENGGANU", "TRG"] },
  {
    name: "Kuala Lumpur",
    code: "KUL",
    latitude: 3.139,
    longitude: 101.6869,
    aliases: ["KUALALUMPUR", "WPKUALALUMPUR", "WPKL", "KUL"],
  },
  { name: "Labuan", code: "LBN", latitude: 5.2831, longitude: 115.2308, aliases: ["LABUAN", "WPLABUAN", "LBN"] },
  { name: "Putrajaya", code: "PJY", latitude: 2.9264, longitude: 101.6964, aliases: ["PUTRAJAYA", "WPPUTRAJAYA", "PJY"] },
];

/* ==============
   lookup maps
   ============== */
const STATE_BY_NAME = new Map(MALAYSIA_STATES.map((item) => [item.name, item]));
const STATE_BY_ALIAS = buildAliasMap(MALAYSIA_STATES);

/* ==============
   map styles
   ============== */
const mapBaseStyle = {
  color: "#0f4b85",
  weight: 1.2,
  fillColor: "#48a5ea",
  fillOpacity: 0.22,
};
const mapHoverStyle = {
  color: "#0b72c4",
  weight: 2.1,
  fillOpacity: 0.3,
};
const mapActiveStyle = {
  color: "#08589d",
  weight: 2.6,
  fillOpacity: 0.4,
};
const RAIN_WEATHER_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const RAIN_GRID_SPACING_KM = 14;
const RAIN_BATCH_SIZE = 40;
const MAX_RAIN_SAMPLE_POINTS = 180;
const CLUSTER_JOIN_FACTOR = 1.65;
const FALLBACK_RAIN_RADIUS_KM = 10;
const RAIN_HISTORY_DAYS = 7;

/* ==============
   DOM references
   ============== */
const stateSelect = document.getElementById("stateSelect");
const bufferToggleBtn = document.getElementById("bufferToggleBtn");
const dashboardNow = document.getElementById("dashboardNow");
const apiTimeInfo = document.getElementById("apiTimeInfo");
const mapStatus = document.getElementById("mapStatus");
const temperatureNow = document.getElementById("temperatureNow");
const cloudNow = document.getElementById("cloudNow");
const windNow = document.getElementById("windNow");
const humidityNow = document.getElementById("humidityNow");
const temperatureTime = document.getElementById("temperatureTime");
const cloudTime = document.getElementById("cloudTime");
const windTime = document.getElementById("windTime");
const humidityTime = document.getElementById("humidityTime");
const rainFrequencyInfo = document.getElementById("rainFrequencyInfo");
const rainFrequencyStatus = document.getElementById("rainFrequencyStatus");
const rainFrequencyChartCanvas = document.getElementById("rainFrequencyChart");

/* ==============
   runtime state
   ============== */
let malaysiaMap;
let boundaryLayer;
let activeBoundary;
let rainMarkerLayer;
let rainBuffers = [];
let activeRainBuffer = null;
let isGlobalBufferVisible = false;
let requestCounter = 0;
let rainFrequencyChart;

/* ==============
   bootstrap
   ============== */
initialize();

/* ==============
   app setup
   ============== */
function initialize() {
  populateStateSelector();
  initializeClock();
  initializeMap();
  initializeRainFrequencyChart();
  initializeBufferToggle();
  loadBoundaries();

  stateSelect.addEventListener("change", () => {
    handleStateChange(stateSelect.value, true);
  });

  handleStateChange("Kedah", false);
}

/* ==============
   selector and clock setup
   ============== */
function populateStateSelector() {
  MALAYSIA_STATES.forEach((state) => {
    const option = document.createElement("option");
    option.value = state.name;
    option.textContent = state.name;
    stateSelect.append(option);
  });
  stateSelect.value = "Kedah";
}

function initializeClock() {
  updateDashboardNow();
  window.setInterval(updateDashboardNow, 1000);
}

function updateDashboardNow() {
  dashboardNow.textContent = new Intl.DateTimeFormat("en-MY", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

/* ==============
   map setup
   ============== */
function initializeMap() {
  malaysiaMap = L.map("map", { zoomControl: true, attributionControl: true }).setView([4.2105, 101.9758], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(malaysiaMap);

  rainMarkerLayer = L.layerGroup().addTo(malaysiaMap);

  malaysiaMap.on("click", () => {
    if (isGlobalBufferVisible) {
      return;
    }
    if (activeRainBuffer && malaysiaMap.hasLayer(activeRainBuffer)) {
      malaysiaMap.removeLayer(activeRainBuffer);
      activeRainBuffer = null;
    }
  });
}

function initializeBufferToggle() {
  if (!bufferToggleBtn) {
    return;
  }
  syncBufferToggleButton();
  bufferToggleBtn.addEventListener("click", () => {
    setGlobalBufferVisibility(!isGlobalBufferVisible);
  });
}

/* ==============
   boundary loading
   ============== */
async function loadBoundaries() {
  for (const url of GEOJSON_URLS) {
    try {
      const geojson = await fetchJson(url);
      renderBoundaries(geojson);
      mapStatus.textContent = "Map ready. Tap a state border to apply filter.";
      handleStateChange(stateSelect.value, false);
      return;
    } catch (error) {
      continue;
    }
  }
  mapStatus.textContent = "Unable to load state boundaries right now. Weather data still works by state selector.";
}

function renderBoundaries(geojson) {
  if (boundaryLayer) {
    malaysiaMap.removeLayer(boundaryLayer);
  }

  boundaryLayer = L.geoJSON(geojson, {
    style: () => mapBaseStyle,
    onEachFeature: (feature, layer) => {
      layer.on({
        mouseover: () => {
          if (layer !== activeBoundary) {
            layer.setStyle(mapHoverStyle);
          }
        },
        mouseout: () => {
          if (layer !== activeBoundary && boundaryLayer) {
            boundaryLayer.resetStyle(layer);
          }
        },
        click: () => {
          const state = findStateForFeature(feature);
          if (!state) {
            return;
          }
          stateSelect.value = state.name;
          handleStateChange(state.name, false);
        },
      });
    },
  }).addTo(malaysiaMap);

  updateMapSelection(stateSelect.value, false);
}

/* ==============
   weather loading
   ============== */
async function handleStateChange(stateName, shouldFitToBoundary) {
  const selectedState = STATE_BY_NAME.get(stateName);
  if (!selectedState) {
    return;
  }

  clearRainOverlay();
  setRainFrequencyLoading(selectedState.name);
  mapStatus.textContent = `Loading latest weather for ${selectedState.name}...`;
  const requestId = ++requestCounter;

  try {
    const weatherData = await fetchWeatherByState(selectedState);
    if (requestId !== requestCounter) {
      return;
    }

    updateCurrentStats(weatherData.current);
    updateMapSelection(selectedState.name, shouldFitToBoundary);
    apiTimeInfo.textContent = `Latest occurred data for ${selectedState.name}: ${formatApiTime(weatherData.current.time)} (Asia/Kuala_Lumpur)`;
    mapStatus.textContent = `Showing ${selectedState.name}. Loading rain overlays...`;

    const [rainOverlayResult, rainFrequencyResult] = await Promise.allSettled([
      fetchRainOverlayByState(selectedState.name, selectedState),
      fetchRainFrequencyByState(selectedState),
    ]);
    if (requestId !== requestCounter) {
      return;
    }

    if (rainOverlayResult.status === "fulfilled") {
      renderRainOverlay(selectedState.name, rainOverlayResult.value);
    } else {
      mapStatus.textContent = `Showing ${selectedState.name}. Rain overlay unavailable right now.`;
    }

    if (rainFrequencyResult.status === "fulfilled") {
      renderRainFrequencyChart(selectedState.name, rainFrequencyResult.value);
    } else {
      renderRainFrequencyError(selectedState.name, rainFrequencyResult.reason);
    }
  } catch (error) {
    apiTimeInfo.textContent = "Weather API request failed. Check internet access and try again.";
    mapStatus.textContent = `Failed loading ${selectedState.name}. ${error.message}`;
    renderRainFrequencyError(selectedState.name, error);
  }
}

/* ==============
   API requests
   ============== */
async function fetchWeatherByState(state) {
  const params = new URLSearchParams({
    latitude: String(state.latitude),
    longitude: String(state.longitude),
    current: "temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m",
    timezone: "Asia/Kuala_Lumpur",
  });

  const url = `${WEATHER_API_URL}?${params.toString()}`;
  const data = await fetchJson(url);

  if (!data.current) {
    throw new Error("Invalid weather response.");
  }
  return data;
}

/* ==============
   rain frequency API
   ============== */
async function fetchRainFrequencyByState(state) {
  const params = new URLSearchParams({
    latitude: String(state.latitude),
    longitude: String(state.longitude),
    daily: "precipitation_hours,rain_sum",
    past_days: String(RAIN_HISTORY_DAYS),
    forecast_days: "0",
    timezone: "Asia/Kuala_Lumpur",
  });

  const url = `${WEATHER_API_URL}?${params.toString()}`;
  const data = await fetchJson(url);
  const daily = data && data.daily ? data.daily : {};
  const dates = Array.isArray(daily.time) ? daily.time : [];
  const rainHours = Array.isArray(daily.precipitation_hours) ? daily.precipitation_hours : [];
  const rainSums = Array.isArray(daily.rain_sum) ? daily.rain_sum : [];

  if (!dates.length) {
    throw new Error("Rain-frequency daily data is not available.");
  }

  const startIndex = Math.max(0, dates.length - RAIN_HISTORY_DAYS);
  return dates.slice(startIndex).map((date, index) => {
    const pointIndex = startIndex + index;
    return {
    date,
    rainHours: Math.max(0, toNumber(rainHours[pointIndex], 0)),
    rainSum: Math.max(0, toNumber(rainSums[pointIndex], 0)),
  };
  });
}

/* ==============
   rain frequency chart
   ============== */
function initializeRainFrequencyChart() {
  if (!rainFrequencyChartCanvas || typeof Chart === "undefined") {
    if (rainFrequencyStatus) {
      rainFrequencyStatus.textContent = "Rain-frequency chart is unavailable right now.";
    }
    return;
  }

  const context = rainFrequencyChartCanvas.getContext("2d");
  rainFrequencyChart = new Chart(context, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "Rain Frequency (hours)",
          data: [],
          rainSums: [],
          backgroundColor: "rgba(11, 114, 196, 0.76)",
          borderColor: "#0a4f90",
          borderWidth: 1.5,
          borderRadius: 8,
          maxBarThickness: 44,
          categoryPercentage: 0.72,
          barPercentage: 0.74,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Rain frequency: ${round1(context.parsed.y)} hour(s)`,
            afterLabel: (context) => {
              const rainSums = Array.isArray(context.dataset.rainSums) ? context.dataset.rainSums : [];
              const rainfall = toNumber(rainSums[context.dataIndex], 0);
              return `Rainfall total: ${rainfall.toFixed(1)} mm`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#2b587b" },
        },
        y: {
          beginAtZero: true,
          suggestedMax: 24,
          ticks: { color: "#2b587b" },
          grid: { color: "rgba(10, 77, 128, 0.14)" },
          title: {
            display: true,
            text: "Hours with rain",
            color: "#2b587b",
            font: { weight: "600" },
          },
        },
      },
    },
  });
}

function setRainFrequencyLoading(stateName) {
  if (rainFrequencyInfo) {
    rainFrequencyInfo.textContent = `Loading last ${RAIN_HISTORY_DAYS} days for ${stateName}...`;
  }
  if (rainFrequencyStatus) {
    rainFrequencyStatus.textContent = "Fetching rain-frequency data...";
  }
}

function renderRainFrequencyChart(stateName, series) {
  if (!Array.isArray(series) || !series.length) {
    renderRainFrequencyError(stateName, new Error("No rain-frequency data returned."));
    return;
  }

  if (!rainFrequencyChart) {
    initializeRainFrequencyChart();
  }

  const labels = series.map((item) => formatRainDateShort(item.date));
  const rainHours = series.map((item) => Number(item.rainHours.toFixed(2)));
  const rainSums = series.map((item) => Number(item.rainSum.toFixed(2)));
  const firstDay = series[0];
  const latestDay = series[series.length - 1];

  if (rainFrequencyChart) {
    rainFrequencyChart.data.labels = labels;
    rainFrequencyChart.data.datasets[0].data = rainHours;
    rainFrequencyChart.data.datasets[0].rainSums = rainSums;
    rainFrequencyChart.update();
  }

  if (rainFrequencyInfo) {
    rainFrequencyInfo.textContent =
      `Occurred dates: ${formatRainDateLong(firstDay.date)} to ${formatRainDateLong(latestDay.date)} (Asia/Kuala_Lumpur).`;
  }
  if (rainFrequencyStatus) {
    rainFrequencyStatus.textContent =
      `${stateName} latest (${formatRainDateLong(latestDay.date)}): ${round1(latestDay.rainHours)} hour(s) with rain, ` +
      `${latestDay.rainSum.toFixed(1)} mm rainfall total.`;
  }
}

function renderRainFrequencyError(stateName, error) {
  const message = error instanceof Error ? error.message : "Unable to load rain-frequency data.";
  if (rainFrequencyInfo) {
    rainFrequencyInfo.textContent = `Rain-frequency data unavailable for ${stateName}.`;
  }
  if (rainFrequencyStatus) {
    rainFrequencyStatus.textContent = message;
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

/* ==============
   rain overlay data
   ============== */
async function fetchRainOverlayByState(stateName, fallbackState) {
  const stateLayer = getBoundaryLayerByStateName(stateName);
  const stateGeometry = stateLayer && stateLayer.feature ? stateLayer.feature.geometry : null;
  const samplePoints = buildRainSamplePoints(stateGeometry, fallbackState);
  if (!samplePoints.length) {
    return { clusters: [], observedAt: "" };
  }

  const observations = await fetchRainObservations(samplePoints);
  const rainPoints = observations.filter(isRainObservation);
  const cellAreaKm2 = estimateCellAreaKm2(samplePoints);
  const clusters = buildRainClusters(rainPoints, cellAreaKm2, stateName);
  const observedAt = observations.length ? observations[0].time : "";

  return { clusters, observedAt };
}

function buildRainSamplePoints(stateGeometry, fallbackState) {
  if (!stateGeometry) {
    return fallbackState ? [{ latitude: fallbackState.latitude, longitude: fallbackState.longitude }] : [];
  }

  const bounds = getGeometryBounds(stateGeometry);
  if (!bounds) {
    return fallbackState ? [{ latitude: fallbackState.latitude, longitude: fallbackState.longitude }] : [];
  }

  const points = [];
  const latStepDeg = RAIN_GRID_SPACING_KM / 110.574;
  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latStepDeg) {
    const lonStepDeg = kmToLongitudeDegrees(RAIN_GRID_SPACING_KM, lat);
    for (let lon = bounds.minLon; lon <= bounds.maxLon; lon += lonStepDeg) {
      if (pointInGeometry(lon, lat, stateGeometry)) {
        points.push({ latitude: lat, longitude: lon });
      }
    }
  }

  if (!points.length && fallbackState) {
    points.push({ latitude: fallbackState.latitude, longitude: fallbackState.longitude });
  }

  if (points.length <= MAX_RAIN_SAMPLE_POINTS) {
    return points;
  }

  const stride = Math.ceil(points.length / MAX_RAIN_SAMPLE_POINTS);
  return points.filter((_, index) => index % stride === 0).slice(0, MAX_RAIN_SAMPLE_POINTS);
}

function getGeometryBounds(geometry) {
  if (!geometry || !geometry.coordinates) {
    return null;
  }

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;

  const scan = (node) => {
    if (!Array.isArray(node) || !node.length) {
      return;
    }
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      const lon = node[0];
      const lat = node[1];
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      }
      return;
    }
    node.forEach(scan);
  };

  scan(geometry.coordinates);
  if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) {
    return null;
  }
  return { minLat, maxLat, minLon, maxLon };
}

function kmToLongitudeDegrees(km, latitude) {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const kmPerDegree = 111.32 * Math.max(0.2, Math.cos(latitudeRadians));
  return km / kmPerDegree;
}

async function fetchRainObservations(samplePoints) {
  const batches = chunkArray(samplePoints, RAIN_BATCH_SIZE);
  const responses = await Promise.all(
    batches.map(async (batch) => {
      const params = new URLSearchParams({
        latitude: batch.map((point) => point.latitude.toFixed(4)).join(","),
        longitude: batch.map((point) => point.longitude.toFixed(4)).join(","),
        current: "rain,precipitation,weather_code,relative_humidity_2m",
        timezone: "Asia/Kuala_Lumpur",
      });

      const payload = await fetchJson(`${WEATHER_API_URL}?${params.toString()}`);
      return normalizeRainBatch(payload, batch);
    })
  );

  return responses.flat();
}

function normalizeRainBatch(payload, batch) {
  const normalized = [];
  if (Array.isArray(payload)) {
    payload.forEach((entry, index) => {
      const point = normalizeRainEntry(entry, batch[index]);
      if (point) {
        normalized.push(point);
      }
    });
    return normalized;
  }

  if (payload && Array.isArray(payload.current)) {
    payload.current.forEach((currentItem, index) => {
      const entry = {
        latitude: Array.isArray(payload.latitude) ? payload.latitude[index] : payload.latitude,
        longitude: Array.isArray(payload.longitude) ? payload.longitude[index] : payload.longitude,
        current: currentItem,
      };
      const point = normalizeRainEntry(entry, batch[index]);
      if (point) {
        normalized.push(point);
      }
    });
    return normalized;
  }

  const singlePoint = normalizeRainEntry(payload, batch[0]);
  return singlePoint ? [singlePoint] : [];
}

function normalizeRainEntry(entry, fallbackPoint) {
  const current = entry && entry.current ? entry.current : {};
  const latitude = toNumber(entry && entry.latitude, fallbackPoint && fallbackPoint.latitude);
  const longitude = toNumber(entry && entry.longitude, fallbackPoint && fallbackPoint.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    rain: Math.max(0, toNumber(current.rain, 0)),
    precipitation: Math.max(0, toNumber(current.precipitation, 0)),
    weatherCode: toNumber(current.weather_code, -1),
    humidity: Math.max(0, toNumber(current.relative_humidity_2m, 0)),
    time: String(current.time || ""),
  };
}

function isRainObservation(point) {
  const rain = point.rain;
  const precipitation = point.precipitation;
  const weatherCode = Math.round(point.weatherCode);
  return rain >= 0.05 || precipitation >= 0.1 || RAIN_WEATHER_CODES.has(weatherCode);
}

function estimateCellAreaKm2(samplePoints) {
  if (samplePoints.length < 2) {
    return RAIN_GRID_SPACING_KM * RAIN_GRID_SPACING_KM;
  }

  const nearestNeighborDistances = [];
  for (let index = 0; index < samplePoints.length; index += 1) {
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let otherIndex = 0; otherIndex < samplePoints.length; otherIndex += 1) {
      if (index === otherIndex) {
        continue;
      }
      const distance = haversineKm(samplePoints[index], samplePoints[otherIndex]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
      }
    }
    if (Number.isFinite(nearestDistance)) {
      nearestNeighborDistances.push(nearestDistance);
    }
  }

  if (!nearestNeighborDistances.length) {
    return RAIN_GRID_SPACING_KM * RAIN_GRID_SPACING_KM;
  }

  nearestNeighborDistances.sort((left, right) => left - right);
  const medianDistance = nearestNeighborDistances[Math.floor(nearestNeighborDistances.length / 2)];
  const sideKm = clamp(medianDistance, 6, 30);
  return sideKm * sideKm;
}

function buildRainClusters(rainPoints, cellAreaKm2, stateName) {
  if (!rainPoints.length) {
    return [];
  }

  const clusters = [];
  const visited = new Array(rainPoints.length).fill(false);
  const joinDistanceKm = RAIN_GRID_SPACING_KM * CLUSTER_JOIN_FACTOR;

  for (let start = 0; start < rainPoints.length; start += 1) {
    if (visited[start]) {
      continue;
    }

    const queue = [start];
    visited[start] = true;
    const indices = [];

    while (queue.length) {
      const current = queue.shift();
      indices.push(current);
      for (let next = 0; next < rainPoints.length; next += 1) {
        if (visited[next]) {
          continue;
        }
        if (haversineKm(rainPoints[current], rainPoints[next]) <= joinDistanceKm) {
          visited[next] = true;
          queue.push(next);
        }
      }
    }

    const points = indices.map((index) => rainPoints[index]);
    const cluster = buildRainCluster(points, cellAreaKm2, stateName, clusters.length + 1);
    if (cluster) {
      clusters.push(cluster);
    }
  }

  return clusters.sort((left, right) => right.severityScore - left.severityScore);
}

function buildRainCluster(points, cellAreaKm2, stateName, sequence) {
  if (!points.length) {
    return null;
  }

  let weightedLatSum = 0;
  let weightedLonSum = 0;
  let weightSum = 0;
  let rainTotal = 0;
  let precipitationTotal = 0;
  let humidityTotal = 0;
  let peakIntensity = 0;
  let latestTime = "";
  let latestTimeMs = Number.NEGATIVE_INFINITY;

  points.forEach((point) => {
    const intensity = Math.max(point.rain, point.precipitation);
    const weight = 1 + intensity * 2.4;
    weightedLatSum += point.latitude * weight;
    weightedLonSum += point.longitude * weight;
    weightSum += weight;
    rainTotal += point.rain;
    precipitationTotal += point.precipitation;
    humidityTotal += point.humidity;
    peakIntensity = Math.max(peakIntensity, intensity);

    const parsedTime = parseOpenMeteoTime(point.time);
    const timeMs = parsedTime.getTime();
    if (Number.isFinite(timeMs) && timeMs > latestTimeMs) {
      latestTimeMs = timeMs;
      latestTime = point.time;
    }
  });

  const avgRain = rainTotal / points.length;
  const avgPrecipitation = precipitationTotal / points.length;
  const avgHumidity = humidityTotal / points.length;
  const wetnessMm = Math.max(avgRain, avgPrecipitation);
  const baseAreaKm2 = points.length * cellAreaKm2;
  const rainScale = 1 + clamp(wetnessMm, 0, 12) * 0.06;
  const areaKm2 = clamp(baseAreaKm2 * rainScale, cellAreaKm2 * 0.7, 4200);
  const radiusKm = clamp(Math.sqrt(areaKm2 / Math.PI), 4, 34);
  const severityScore = clamp(1 + wetnessMm * 0.38 + peakIntensity * 0.25 + (avgHumidity / 100) * 0.55, 1, 4);

  return {
    latitude: weightedLatSum / weightSum,
    longitude: weightedLonSum / weightSum,
    radiusKm: Number.isFinite(radiusKm) ? radiusKm : FALLBACK_RAIN_RADIUS_KM,
    areaKm2,
    severityScore,
    locationName: `${stateName} rain cluster ${sequence}`,
    sampleCount: points.length,
    avgRain,
    avgPrecipitation,
    peakIntensity,
    avgHumidity,
    occurredTime: latestTime || points[0].time || "",
  };
}

function renderRainOverlay(stateName, overlayData) {
  clearRainOverlay();

  if (!overlayData.clusters.length) {
    mapStatus.textContent = `Showing ${stateName}. No raining areas detected at current time.`;
    return;
  }

  overlayData.clusters.forEach((cluster) => {
    const marker = L.marker([cluster.latitude, cluster.longitude], {
      icon: createRainMarkerIcon(cluster.severityScore),
      keyboard: true,
    });

    const bufferCircle = L.circle([cluster.latitude, cluster.longitude], {
      radius: cluster.radiusKm * 1000,
      color: "#082f5f",
      weight: 2,
      fillColor: "#0b3f7e",
      fillOpacity: 0.22,
    });
    rainBuffers.push(bufferCircle);

    const popupHtml = [
      "<strong>Rain Area</strong>",
      `Location: ${cluster.locationName}`,
      `Rain now: ${cluster.avgRain.toFixed(2)} mm`,
      `Precipitation now: ${cluster.avgPrecipitation.toFixed(2)} mm`,
      `Peak intensity: ${cluster.peakIntensity.toFixed(2)} mm`,
      `Humidity avg: ${cluster.avgHumidity.toFixed(1)} %`,
      `Computed coverage area: ${cluster.areaKm2.toFixed(1)} km^2`,
      `Calculated radius: ~${cluster.radiusKm.toFixed(1)} km`,
      `Raining sample cells: ${cluster.sampleCount}`,
      `Occurred: ${cluster.occurredTime ? formatApiTime(cluster.occurredTime) : "-"}`,
    ].join("<br>");
    marker.bindPopup(popupHtml);

    marker.on("click", (event) => {
      if (event && event.originalEvent) {
        L.DomEvent.stopPropagation(event.originalEvent);
      }
      if (isGlobalBufferVisible) {
        return;
      }
      toggleRainBuffer(bufferCircle);
    });

    rainMarkerLayer.addLayer(marker);
  });

  mapStatus.textContent =
    `Showing ${stateName}. ${overlayData.clusters.length} raining location(s) detected from Open-Meteo current data.` +
    ` Tap a rain icon to show or hide its buffer radius.`;

  applyGlobalBufferVisibility();
}

function clearRainOverlay() {
  if (rainMarkerLayer) {
    rainMarkerLayer.clearLayers();
  }
  rainBuffers.forEach((circle) => {
    if (malaysiaMap && malaysiaMap.hasLayer(circle)) {
      malaysiaMap.removeLayer(circle);
    }
  });
  rainBuffers = [];
  activeRainBuffer = null;
}

function setGlobalBufferVisibility(visible) {
  isGlobalBufferVisible = Boolean(visible);
  applyGlobalBufferVisibility();
  syncBufferToggleButton();
}

function applyGlobalBufferVisibility() {
  if (!malaysiaMap) {
    return;
  }

  rainBuffers.forEach((circle) => {
    const hasLayer = malaysiaMap.hasLayer(circle);
    if (isGlobalBufferVisible && !hasLayer) {
      circle.addTo(malaysiaMap);
    }
    if (!isGlobalBufferVisible && hasLayer) {
      malaysiaMap.removeLayer(circle);
    }
  });

  if (isGlobalBufferVisible) {
    activeRainBuffer = null;
  }
}

function syncBufferToggleButton() {
  if (!bufferToggleBtn) {
    return;
  }
  const isOn = isGlobalBufferVisible;
  bufferToggleBtn.textContent = `Buffer Radius: ${isOn ? "ON" : "OFF"}`;
  bufferToggleBtn.setAttribute("aria-pressed", isOn ? "true" : "false");
  bufferToggleBtn.classList.toggle("is-on", isOn);
}

function toggleRainBuffer(bufferCircle) {
  if (!malaysiaMap) {
    return;
  }

  if (activeRainBuffer && activeRainBuffer !== bufferCircle && malaysiaMap.hasLayer(activeRainBuffer)) {
    malaysiaMap.removeLayer(activeRainBuffer);
  }

  if (malaysiaMap.hasLayer(bufferCircle)) {
    malaysiaMap.removeLayer(bufferCircle);
    activeRainBuffer = null;
    return;
  }

  bufferCircle.addTo(malaysiaMap);
  activeRainBuffer = bufferCircle;
}

function createRainMarkerIcon(rainAmount) {
  let level = "light";
  if (rainAmount >= 3) {
    level = "heavy";
  } else if (rainAmount >= 2) {
    level = "medium";
  }

  return L.divIcon({
    className: "rain-marker",
    html: `<i class="fas fa-map-marker-alt rain-fa-icon rain-fa-icon--${level}" aria-hidden="true"></i>`,
    iconSize: [20, 22],
    iconAnchor: [10, 21],
    popupAnchor: [0, -18],
  });
}

function getBoundaryLayerByStateName(stateName) {
  if (!boundaryLayer) {
    return null;
  }
  let match = null;
  boundaryLayer.eachLayer((layer) => {
    const state = findStateForFeature(layer.feature);
    if (state && state.name === stateName) {
      match = layer;
    }
  });
  return match;
}

function pointInGeometry(lon, lat, geometry) {
  if (geometry.type === "Polygon") {
    return pointInPolygon(lon, lat, geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => pointInPolygon(lon, lat, polygon));
  }
  return false;
}

function pointInPolygon(lon, lat, rings) {
  if (!Array.isArray(rings) || rings.length === 0) {
    return false;
  }
  if (!pointInRing(lon, lat, rings[0])) {
    return false;
  }
  for (let index = 1; index < rings.length; index += 1) {
    if (pointInRing(lon, lat, rings[index])) {
      return false;
    }
  }
  return true;
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const xi = ring[index][0];
    const yi = ring[index][1];
    const xj = ring[previous][0];
    const yj = ring[previous][1];
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function chunkArray(items, size) {
  const chunkSize = Math.max(1, Number(size) || 1);
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function haversineKm(firstPoint, secondPoint) {
  const lat1 = (firstPoint.latitude * Math.PI) / 180;
  const lon1 = (firstPoint.longitude * Math.PI) / 180;
  const lat2 = (secondPoint.latitude * Math.PI) / 180;
  const lon2 = (secondPoint.longitude * Math.PI) / 180;

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

/* ==============
   stats rendering
   ============== */
function updateCurrentStats(current) {
  const occurredLabel = `Occurred: ${formatApiTime(current.time)}`;
  temperatureNow.textContent = `${round1(current.temperature_2m)} deg C`;
  cloudNow.textContent = `${round1(current.cloud_cover)} %`;
  windNow.textContent = `${round1(current.wind_speed_10m)} km/h`;
  humidityNow.textContent = `${round1(current.relative_humidity_2m)} %`;

  temperatureTime.textContent = occurredLabel;
  cloudTime.textContent = occurredLabel;
  windTime.textContent = occurredLabel;
  humidityTime.textContent = occurredLabel;
}

/* ==============
   map interactions
   ============== */
function updateMapSelection(stateName, shouldFitToBoundary) {
  const targetState = STATE_BY_NAME.get(stateName);
  if (!targetState) {
    return;
  }

  let matchedBoundary = null;
  if (boundaryLayer) {
    boundaryLayer.eachLayer((layer) => {
      const state = findStateForFeature(layer.feature);
      if (state && state.name === stateName) {
        matchedBoundary = layer;
      }
    });
  }

  if (activeBoundary && boundaryLayer) {
    boundaryLayer.resetStyle(activeBoundary);
  }

  if (matchedBoundary) {
    matchedBoundary.setStyle(mapActiveStyle);
    matchedBoundary.bringToFront();
    activeBoundary = matchedBoundary;
    if (shouldFitToBoundary) {
      malaysiaMap.fitBounds(matchedBoundary.getBounds(), {
        padding: [25, 25],
        maxZoom: 8,
      });
    }
    return;
  }

  activeBoundary = null;
  malaysiaMap.flyTo([targetState.latitude, targetState.longitude], 7, { duration: 0.8 });
}

/* ==============
   feature matching
   ============== */
function findStateForFeature(feature) {
  if (!feature || !feature.properties) {
    return null;
  }

  const values = Object.values(feature.properties);
  for (const value of values) {
    const normalized = normalizeKey(value);
    if (!normalized) {
      continue;
    }
    const match = STATE_BY_ALIAS.get(normalized);
    if (match) {
      return match;
    }
  }
  return null;
}

/* ==============
   utility helpers
   ============== */
function normalizeKey(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).toUpperCase().replace(/[^A-Z]/g, "");
}

function buildAliasMap(states) {
  const aliasMap = new Map();
  states.forEach((state) => {
    aliasMap.set(normalizeKey(state.name), state);
    aliasMap.set(normalizeKey(state.code), state);
    state.aliases.forEach((alias) => {
      aliasMap.set(normalizeKey(alias), state);
    });
  });
  return aliasMap;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return number.toFixed(1);
}

function formatRainDateShort(dateValue) {
  const date = parseRainDate(dateValue);
  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

function formatRainDateLong(dateValue) {
  const date = parseRainDate(dateValue);
  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

function parseRainDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+08:00`);
  }
  return parseOpenMeteoTime(value);
}

function formatApiTime(isoTime) {
  const date = parseOpenMeteoTime(isoTime);
  if (Number.isNaN(date.getTime())) {
    return isoTime;
  }
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

function parseOpenMeteoTime(value) {
  if (typeof value !== "string") {
    return new Date(value);
  }
  const hasOffset = /([zZ]|[+-]\d{2}:\d{2})$/.test(value);
  return new Date(hasOffset ? value : `${value}+08:00`);
}
