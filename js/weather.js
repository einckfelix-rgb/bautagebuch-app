/* Automatic weather lookup via the free Open-Meteo API (no API key required).
   Used to geocode a construction site's location and to prefill a diary
   entry's weather section for a given date. Requires an internet connection;
   all callers must handle failures gracefully and fall back to manual entry. */

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

const DAILY_PARAMS = "weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max";

async function geocodeLocation(query) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=6&language=de&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding fehlgeschlagen (" + res.status + ")");
  const data = await res.json();
  return (data.results || []).map((r) => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
  }));
}

function mapWeatherCodeToCondition(code, windMax) {
  if (windMax != null && windMax >= 62) return "sturm";
  if ([95, 96, 99].includes(code)) return "sturm";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "schnee";
  if ([45, 48].includes(code)) return "neblig";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "regen";
  if ([2, 3].includes(code)) return "bewoelkt";
  if ([0, 1].includes(code)) return "sonnig";
  return "";
}

function inferGroundCondition(precipSum, tempMin) {
  if (tempMin != null && tempMin <= 0) return "gefroren";
  if (precipSum != null && precipSum >= 1) return "nass";
  if (precipSum != null && precipSum > 0) return "feucht";
  return "trocken";
}

function daysBetween(isoDate) {
  const target = new Date(isoDate + "T00:00:00");
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

async function fetchDailyWeather(baseUrl, lat, lon, isoDate) {
  const url = `${baseUrl}?latitude=${lat}&longitude=${lon}&start_date=${isoDate}&end_date=${isoDate}&daily=${DAILY_PARAMS}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Wetterabfrage fehlgeschlagen (" + res.status + ")");
  const data = await res.json();
  if (!data.daily || !data.daily.time || data.daily.time.length === 0) return null;
  return {
    code: data.daily.weathercode[0],
    tempMax: data.daily.temperature_2m_max[0],
    tempMin: data.daily.temperature_2m_min[0],
    precipSum: data.daily.precipitation_sum ? data.daily.precipitation_sum[0] : null,
    windMax: data.daily.windspeed_10m_max ? data.daily.windspeed_10m_max[0] : null,
  };
}

/* Returns { condition, tempMin, tempMax, ground } or null if no data could be retrieved. */
async function fetchWeatherForDate(lat, lon, isoDate) {
  const diff = daysBetween(isoDate);
  const primary = diff >= -92 && diff <= 16 ? FORECAST_URL : ARCHIVE_URL;
  const secondary = primary === FORECAST_URL ? ARCHIVE_URL : FORECAST_URL;

  let day = null;
  try {
    day = await fetchDailyWeather(primary, lat, lon, isoDate);
  } catch (e) {
    day = null;
  }
  if (!day) {
    day = await fetchDailyWeather(secondary, lat, lon, isoDate);
  }
  if (!day) return null;

  return {
    condition: mapWeatherCodeToCondition(day.code, day.windMax),
    tempMin: day.tempMin != null ? Math.round(day.tempMin) : "",
    tempMax: day.tempMax != null ? Math.round(day.tempMax) : "",
    ground: inferGroundCondition(day.precipSum, day.tempMin),
  };
}

window.Weather = { geocodeLocation, fetchWeatherForDate };
