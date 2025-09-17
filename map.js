// Initialize Leaflet map and only fetch/show current location
(function() {
  const L = window.L
  const map = L.map('map').setView([20.5937, 78.9629], 5)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  function showLocation(center) {
    map.setView([center.lat, center.lng], 13)
    L.marker([center.lat, center.lng]).addTo(map).bindPopup('Your Location').openPopup()
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        showLocation(c)
      },
      () => showLocation({ lat: 13.0827, lng: 80.2707 }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  } else {
    showLocation({ lat: 13.0827, lng: 80.2707 })
  }
})()

// Standalone map page logic (extracted from script.js)
// Minimal duplication to keep index.html behavior unchanged

let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null')
let map = null
let heatLayer = null
let userLocationMarker = null
let userCircle100km = null
const hazardReports = []
const API_BASE = window.API_BASE || 'http://localhost:4000'

// DOM
const reportHazardBtn = document.getElementById('reportHazardBtn')
const disasterFilterSelect = document.getElementById('disasterFilter')
const heatToggleCheckbox = document.getElementById('heatToggle')
const reportModal = document.getElementById('reportModal')
const closeModal = document.getElementById('closeModal')
const cancelReport = document.getElementById('cancelReport')
const hazardForm = document.getElementById('hazardForm')

const loginModal = document.getElementById('loginModal')
const loginForm = document.getElementById('loginForm')
const closeLoginModal = document.getElementById('closeLoginModal')
const cancelLogin = document.getElementById('cancelLogin')

const L = window.L

document.addEventListener('DOMContentLoaded', () => {
  init()
})

function init() {
  // Events
  loginForm?.addEventListener('submit', handleLogin)
  closeLoginModal?.addEventListener('click', () => hideModal(loginModal))
  cancelLogin?.addEventListener('click', () => hideModal(loginModal))

  if (reportHazardBtn) {
    reportHazardBtn.addEventListener('click', () => {
      if (!currentUser) return showModal(loginModal)
      showModal(reportModal)
    })
  }
  closeModal?.addEventListener('click', () => hideModal(reportModal))
  cancelReport?.addEventListener('click', () => hideModal(reportModal))
  hazardForm?.addEventListener('submit', handleHazardReport)

  disasterFilterSelect?.addEventListener('change', refreshMapVisuals)
  heatToggleCheckbox?.addEventListener('change', () => toggleHeatLayer(heatToggleCheckbox.checked))

  initializeMap()
}

function handleLogin(e) {
  e.preventDefault()
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const role = document.getElementById('userRole').value
  if (email && password && role) {
    currentUser = { email, role, loginTime: new Date().toISOString() }
    localStorage.setItem('currentUser', JSON.stringify(currentUser))
    hideModal(loginModal)
  } else {
    alert('Please fill in all fields')
  }
}

function initializeMap() {
  const mapContainer = document.getElementById('map')
  if (!mapContainer) return
  map = L.map('map').setView([20.5937, 78.9629], 5)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map)
  heatLayer = L.heatLayer([], { radius: 25, blur: 15, maxZoom: 12 }).addTo(map)
  loadReportsFromBackend()

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      map.setView([lat, lng], 10)
      userLocationMarker = L.marker([lat, lng]).addTo(map).bindPopup('Your Location')
      userCircle100km = L.circle([lat, lng], { radius: 100000, color: '#3182ce', fillColor: '#3182ce', fillOpacity: 0.08, weight: 1 }).addTo(map)
      refreshMapVisuals()
    })
  }
}

function handleHazardReport(e) {
  e.preventDefault()
  if (!currentUser) return showModal(loginModal)
  const hazardType = document.getElementById('hazardType').value
  const description = document.getElementById('description').value
  const severity = document.getElementById('severity').value
  const mediaFile = document.getElementById('mediaUpload').files[0]

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const formData = new FormData()
      formData.append('type', hazardType)
      formData.append('label', document.querySelector(`#hazardType option[value="${hazardType}"]`)?.textContent || hazardType)
      formData.append('description', description)
      formData.append('severity', severity)
      formData.append('lat', position.coords.latitude)
      formData.append('lng', position.coords.longitude)
      formData.append('reporter', currentUser.email)
      if (mediaFile) formData.append('media', mediaFile)

      fetch(`${API_BASE}/api/reports`, { method: 'POST', body: formData })
        .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then((saved) => {
          hazardReports.push(saved)
          addHazardToMap(saved)
          refreshMapVisuals()
          hideModal(reportModal)
          hazardForm.reset()
          alert('Hazard report submitted successfully!')
        })
        .catch((err) => alert(`Failed to submit report. Ensure backend is running at ${API_BASE}. Error: ${err.message}`))
    })
  }
}

function addHazardToMap(report) {
  if (!map) return
  const color = report.severity === 'high' ? 'red' : report.severity === 'medium' ? 'orange' : 'yellow'
  const circle = L.circle([report.lat, report.lng], { color, fillColor: color, fillOpacity: 0.3, radius: report.severity === 'high' ? 5000 : report.severity === 'medium' ? 3000 : 1000 }).addTo(map)
  circle.bindPopup(`
    <strong>${report.label || report.type}</strong><br>
    Severity: ${report.severity}<br>
    ${report.description || ''}<br>
    ${report.mediaUrl ? renderMedia(report.mediaUrl) : ''}
  `)
}

function getFilteredReports() {
  const selected = disasterFilterSelect?.value || 'all'
  let filtered = !selected || selected === 'all' ? hazardReports : hazardReports.filter((r) => r.type === selected)
  if (userLocationMarker) {
    const center = userLocationMarker.getLatLng()
    filtered = filtered.filter((r) => getDistanceKm(center.lat, center.lng, r.lat, r.lng) <= 100)
  }
  return filtered
}

function computeHeatData(reports) {
  const severityToIntensity = { high: 1.0, medium: 0.6, low: 0.3 }
  return reports.map((r) => [r.lat, r.lng, severityToIntensity[r.severity] || 0.5])
}

function refreshMapVisuals() {
  if (!map || !heatLayer) return
  const filtered = getFilteredReports()
  heatLayer.setLatLngs(computeHeatData(filtered))
}

function toggleHeatLayer(enabled) {
  if (!map || !heatLayer) return
  if (enabled) heatLayer.addTo(map)
  else map.removeLayer(heatLayer)
}

function loadReportsFromBackend() {
  fetch(`${API_BASE}/api/reports`).then((r) => r.json()).then((reports) => {
    hazardReports.length = 0
    reports.forEach((r) => hazardReports.push(r))
    refreshMapVisuals()
  }).catch(() => {})
}

function renderMedia(url) {
  const lower = url.toLowerCase()
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogg')) {
    return `<video src="${API_BASE}${url}" controls style="max-width:100%; border-radius:8px;"></video>`
  }
  return `<img src="${API_BASE}${url}" alt="uploaded media" style="max-width:100%; border-radius:8px;" />`
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
function toRad(v){return (v*Math.PI)/180}

function showModal(modal){ modal?.classList.add('active') }
function hideModal(modal){ modal?.classList.remove('active') }


