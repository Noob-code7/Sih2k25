// Application State
let currentUser = null
let map = null
const hazardReports = []
const socialPosts = []
let pendingAction = null // Track what action user was trying to perform

// DOM Elements
const landingPage = document.getElementById("landingPage")
const mapScreen = document.getElementById("mapScreen")
const socialScreen = document.getElementById("socialScreen")
const helpScreen = document.getElementById("helpScreen")
const loginBtn = document.getElementById("loginBtn")
const logoutBtn = document.getElementById("logoutBtn")
const userRoleDisplay = document.getElementById("userRoleDisplay")
const startReportingBtn = document.getElementById("startReportingBtn")
const featureCards = document.querySelectorAll(".feature-card")
const backButtons = document.querySelectorAll(".back-btn")
const reportHazardBtn = document.getElementById("reportHazardBtn")
const reportModal = document.getElementById("reportModal")
const closeModal = document.getElementById("closeModal")
const cancelReport = document.getElementById("cancelReport")
const hazardForm = document.getElementById("hazardForm")
const loginModal = document.getElementById("loginModal")
const loginForm = document.getElementById("loginForm")
const closeLoginModal = document.getElementById("closeLoginModal")
const cancelLogin = document.getElementById("cancelLogin")

// Feature flags
const USE_NODE_AUTH = false

// Leaflet library
const L = window.L

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  initializeApp()
})

function initializeApp() {
  const savedUser = localStorage.getItem("currentUser")
  if (savedUser) {
    currentUser = JSON.parse(savedUser)
    updateAuthUI()
  }
  // Try to hydrate from server session only if enabled
  if (USE_NODE_AUTH) {
    syncUserFromServer()
  }

  // Event Listeners
  loginForm.addEventListener("submit", handleLogin)
  loginBtn.addEventListener("click", () => showLoginModal())
  logoutBtn.addEventListener("click", handleLogout)
  closeLoginModal.addEventListener("click", () => hideModal(loginModal))
  cancelLogin.addEventListener("click", () => hideModal(loginModal))

  // Start Reporting button
  startReportingBtn.addEventListener("click", () => {
    if (requireAuth(() => showScreen("mapScreen"))) {
      showScreen("mapScreen")
    }
  })

  // Feature card navigation
  featureCards.forEach((card) => {
    card.addEventListener("click", () => {
      const feature = card.dataset.feature
      handleFeatureCardClick(feature)
    })
  })

  // Back buttons
  backButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      showScreen("landingPage")
    })
  })

  // Report hazard functionality
  if (reportHazardBtn) {
    reportHazardBtn.addEventListener("click", () => {
      if (requireAuth(() => showModal(reportModal))) {
        showModal(reportModal)
      }
    })
  }

  if (closeModal) closeModal.addEventListener("click", () => hideModal(reportModal))
  if (cancelReport) cancelReport.addEventListener("click", () => hideModal(reportModal))
  if (hazardForm) hazardForm.addEventListener("submit", handleHazardReport)

  // Load sample data
  loadSampleData()
}

function handleFeatureCardClick(feature) {
  switch (feature) {
    case "heatmap":
      if (requireAuth(() => showScreen("mapScreen"))) {
        showScreen("mapScreen")
        // Initialize map if needed
        setTimeout(() => {
          if (!map) initializeMap()
        }, 100)
      }
      break
    case "reports":
      if (requireAuth(() => showModal(reportModal))) {
        showModal(reportModal)
      }
      break
    case "social":
      // Social feed does not require login; request location and load
      showScreen("socialScreen")
      loadSocialFeed()
      break
    case "emergency":
      showScreen("helpScreen") // Emergency info doesn't require auth
      break
    case "ai":
      if (requireAuth(() => alert("AI-powered detection is coming soon!"))) {
        alert("AI-powered detection is coming soon!")
      }
      break
    case "community":
      if (requireAuth(() => alert("Community features are coming soon!"))) {
        alert("Community features are coming soon!")
      }
      break
  }
}

function showScreen(screenId) {
  // Hide all screens
  landingPage.style.display = "none"
  mapScreen.style.display = "none"
  socialScreen.style.display = "none"
  helpScreen.style.display = "none"

  // Show requested screen
  document.getElementById(screenId).style.display = "block"

  // Initialize map if showing map screen
  if (screenId === "mapScreen" && !map) {
    setTimeout(initializeMap, 100)
  }
}

function requireAuth(callback) {
  if (!currentUser) {
    pendingAction = callback
    showLoginModal()
    return false
  }
  return true
}

function showLoginModal() {
  showModal(loginModal)
}

// Authentication
function handleLogin(e) {
  e.preventDefault()

  const email = document.getElementById("email").value
  const password = document.getElementById("password").value
  const role = document.getElementById("userRole").value
  const errorBox = document.getElementById("loginError")

  const errors = []
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    errors.push("Enter a valid email address")
  }
  if (!password || password.length < 6) {
    errors.push("Password must be at least 6 characters")
  }
  if (!role) {
    errors.push("Please select your role")
  }

  if (errors.length) {
    if (errorBox) {
      errorBox.innerHTML = errors.map((e) => `<div>• ${e}</div>`).join("")
      errorBox.style.display = "block"
    } else {
      alert(errors.join("\n"))
    }
    return
  }

  // Try server login first; gracefully fall back to local if unavailable
  serverLogin(email, password)
    .then((serverUser) => {
      const effectiveRole = role || serverUser.role || 'citizen'
      currentUser = { email: serverUser.email, role: effectiveRole, loginTime: new Date().toISOString() }
      localStorage.setItem("currentUser", JSON.stringify(currentUser))
      updateAuthUI()
      hideModal(loginModal)
      if (errorBox) {
        errorBox.style.display = "none"
        errorBox.innerHTML = ""
      }
      if (pendingAction) {
        pendingAction()
        pendingAction = null
      }
      loginForm.reset()
    })
    .catch(() => {
      // Fallback to existing local-only behavior
      if (email && password && role) {
        currentUser = {
          email: email,
          role: role,
          loginTime: new Date().toISOString(),
        }
        localStorage.setItem("currentUser", JSON.stringify(currentUser))
        updateAuthUI()
        hideModal(loginModal)
        if (errorBox) {
          errorBox.style.display = "none"
          errorBox.innerHTML = ""
        }
        if (pendingAction) {
          pendingAction()
          pendingAction = null
        }
        loginForm.reset()
      }
    })
}

function handleLogout() {
  // Attempt server logout but do not depend on it
  fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(() => {
    currentUser = null
    localStorage.removeItem("currentUser")
    updateAuthUI()
    showScreen("landingPage") // Return to landing page on logout
  })
}

function updateAuthUI() {
  if (currentUser) {
    loginBtn.style.display = "none"
    logoutBtn.style.display = "block"
    userRoleDisplay.style.display = "block"
    userRoleDisplay.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
  } else {
    loginBtn.style.display = "block"
    logoutBtn.style.display = "none"
    userRoleDisplay.style.display = "none"
  }
}

// Map Functionality
function initializeMap() {
  if (map) return

  const mapContainer = document.getElementById("map")
  if (!mapContainer) return

  // Initialize Leaflet map
  map = L.map("map").setView([34.0522, -118.2437], 10) // Los Angeles default

  // Add tile layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map)

  // Add sample hazard markers
  addSampleHazards()

  // Get user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      map.setView([lat, lng], 12)

      // Add user location marker
      L.marker([lat, lng]).addTo(map).bindPopup("Your Location").openPopup()
    })
  }
}

function addSampleHazards() {
  const sampleHazards = [
    { lat: 34.0522, lng: -118.2437, severity: "high", type: "Rip Current", description: "Strong rip current reported" },
    { lat: 34.0622, lng: -118.2537, severity: "medium", type: "High Waves", description: "Waves 6-8 feet" },
    { lat: 34.0422, lng: -118.2337, severity: "low", type: "Marine Debris", description: "Floating debris spotted" },
  ]

  sampleHazards.forEach((hazard) => {
    const color = hazard.severity === "high" ? "red" : hazard.severity === "medium" ? "orange" : "yellow"

    const circle = L.circle([hazard.lat, hazard.lng], {
      color: color,
      fillColor: color,
      fillOpacity: 0.3,
      radius: hazard.severity === "high" ? 5000 : hazard.severity === "medium" ? 3000 : 1000,
    }).addTo(map)

    circle.bindPopup(`
            <strong>${hazard.type}</strong><br>
            Severity: ${hazard.severity}<br>
            ${hazard.description}
        `)
  })
}

// Hazard Reporting
async function handleHazardReport(e) {
  e.preventDefault()

  if (!currentUser) {
    showLoginModal()
    return
  }

  const hazardType = document.getElementById("hazardType").value
  const description = document.getElementById("description").value
  const severity = document.getElementById("severity").value
  const mediaFile = document.getElementById("mediaUpload").files[0]

  // Enforce image with EXIF GPS that matches live location (≤ 1 km)
  try {
    if (!mediaFile) throw new Error('Please select an image with EXIF GPS metadata.')
    const allowed = ['image/jpeg', 'image/jpg']
    if (!allowed.includes((mediaFile.type || '').toLowerCase())) {
      throw new Error('Only JPEG images with EXIF GPS are allowed.')
    }
    const live = await getLiveLocationStrict()
    const exifData = await readExifFromFile(mediaFile)
    const check = compareGeoTagsStrict(live, exifData)
    if (!check.ok) throw new Error(check.reason || 'Image location validation failed.')
  } catch (err) {
    alert(err && err.message ? err.message : 'Image validation failed.')
    return
  }

  // If validation passed, submit and use the live location we already obtained
  // We query once more to place the marker but fall back to previous result if needed
  let coords
  try {
    coords = await getLiveLocationStrict()
  } catch (_) {
    // If immediate re-fetch fails, skip placing marker but still accept as validation already succeeded
    coords = null
  }
  const report = {
    id: Date.now(),
    type: hazardType,
    description: description,
    severity: severity,
    lat: coords ? coords.lat : undefined,
    lng: coords ? coords.lng : undefined,
    timestamp: new Date().toISOString(),
    reporter: currentUser.email,
    media: mediaFile ? mediaFile.name : null,
  }
  hazardReports.push(report)
  if (coords) addHazardToMap({ ...report, lat: coords.lat, lng: coords.lng })
  hideModal(reportModal)
  hazardForm.reset()
  alert("Hazard report submitted successfully!")
}

// ---------- Image geotag validation helpers (vanilla JS) ----------
function toNumberStrict(value) {
  if (typeof value === 'number') return value
  if (value && typeof value.numerator === 'number' && typeof value.denominator === 'number' && value.denominator !== 0) {
    return value.numerator / value.denominator
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

function dmsToDecimalStrict(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3 || !ref) return null
  const d = toNumberStrict(dms[0])
  const m = toNumberStrict(dms[1])
  const s = toNumberStrict(dms[2])
  if (![d, m, s].every(Number.isFinite)) return null
  let dec = d + m / 60 + s / 3600
  const upper = String(ref).toUpperCase()
  if (upper === 'S' || upper === 'W') dec = -dec
  return dec
}

function haversineKmStrict(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}

function compareGeoTagsStrict(liveCoords, exifData) {
  const lat = dmsToDecimalStrict(exifData && exifData.GPSLatitude, exifData && exifData.GPSLatitudeRef)
  const lng = dmsToDecimalStrict(exifData && exifData.GPSLongitude, exifData && exifData.GPSLongitudeRef)
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: 'Image must contain location metadata.' }
  }
  const exifCoords = { lat, lng }
  const distanceKm = haversineKmStrict(liveCoords, exifCoords)
  if (distanceKm > 1) {
    return { ok: false, reason: 'Image location does not match your current location.' }
  }
  return { ok: true }
}

function readExifFromFile(file) {
  return new Promise((resolve, reject) => {
    try {
      if (!window.EXIF) {
        reject(new Error('EXIF library not loaded'))
        return
      }
      window.EXIF.getData(file, function () {
        const data = window.EXIF.getAllTags(this)
        resolve(data)
      })
    } catch (e) {
      reject(e)
    }
  })
}

async function getLiveLocationStrict() {
  if (!navigator.geolocation) throw new Error('Location access is required to submit a report.')
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const st = await navigator.permissions.query({ name: 'geolocation' })
      if (st && st.state === 'denied') throw new Error('Location is blocked for this site. Allow it in Site settings, then reload.')
    }
  } catch (_) {}
  const attempt = (opts) => new Promise((res, rej) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => res({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => rej(err),
      opts
    )
  })
  try {
    return await attempt({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  } catch (e1) {
    try {
      return await attempt({ enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 })
    } catch (e2) {
      if (e2 && e2.code === 2) throw new Error('Location unavailable. Ensure device location is ON and retry.')
      if (e2 && e2.code === 3) throw new Error('Location request timed out. Retry.')
      if (e2 && e2.code === 1) throw new Error('Please allow the location prompt to continue.')
      throw new Error('Location access is required to submit a report.')
    }
  }
}

function addHazardToMap(report) {
  if (!map) return

  const color = report.severity === "high" ? "red" : report.severity === "medium" ? "orange" : "yellow"

  const circle = L.circle([report.lat, report.lng], {
    color: color,
    fillColor: color,
    fillOpacity: 0.3,
    radius: report.severity === "high" ? 5000 : report.severity === "medium" ? 3000 : 1000,
  }).addTo(map)

  circle.bindPopup(`
        <strong>${report.type}</strong><br>
        Severity: ${report.severity}<br>
        ${report.description}<br>
        <small>Reported by: ${report.reporter}</small>
    `)
}

// Social Media Feed
async function loadSocialFeed() {
  const container = document.getElementById("socialFeed")
  if (!container) return

  container.innerHTML = "Loading feed..."

  try {
    const coords = await getUserLocation()
    const resp = await fetch(`/api/social-feed?lat=${coords.lat}&lng=${coords.lng}`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    const posts = (data && data.posts) || []

    if (!posts.length) {
      container.innerHTML = '<p>No posts found in your area.</p>'
      return
    }
    container.innerHTML = ""
    posts.forEach((p) => container.appendChild(renderAggregatedPost(p)))
  } catch (e) {
    container.innerHTML = `<p>Failed to load feed: ${e.message}</p>`
  }
}

function getUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      // Default to Chennai if geolocation unavailable
      resolve({ lat: 13.0827, lng: 80.2707 })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: 13.0827, lng: 80.2707 }),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

function renderAggregatedPost(p) {
  const div = document.createElement("div")
  div.className = "social-post"
  const mediaHtml = p.media_url
    ? p.media_type === "video"
      ? `<video controls style="max-width:100%"><source src="${escapeHtml(p.media_url)}" type="video/mp4"></video>`
      : `<img src="${escapeHtml(p.media_url)}" alt="media" style="max-width:100%">`
    : ""
  const when = p.timestamp ? new Date(p.timestamp).toLocaleString() : ""
  const platform = (p.platform || '').toString().toLowerCase()
  div.innerHTML = `
    <div class="post-header">
      <div class="platform-icon ${platform}">
        <i class="fab fa-${platform || 'globe'}"></i>
      </div>
      <div>
        <strong>${escapeHtml(p.username || p.handle || 'User')}</strong>
        <div style="font-size: 0.9em; color: #666;">${when}</div>
      </div>
    </div>
    <div class="post-content">
      <p>${linkify(escapeHtml(p.text || p.caption || ''))}</p>
      ${mediaHtml}
      ${p.original_url ? `<div style="margin-top:8px"><a href="${escapeAttr(p.original_url)}" target="_blank" rel="noopener noreferrer">View Original</a></div>` : ''}
    </div>
  `
  return div
}

function escapeHtml(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function escapeAttr(s) {
  return s.replace(/"/g, '&quot;')
}

function linkify(s) {
  return s
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/#(\w+)/g, '<span style="color:#1d4ed8">#$1<\/span>')
}

// Modal Management
function showModal(modal) {
  modal.classList.add("active")
}

function hideModal(modal) {
  modal.classList.remove("active")
}

// -------- Server auth helpers (non-breaking) --------
async function syncUserFromServer() {
  try {
    const resp = await fetch('/api/auth/me', { credentials: 'include' })
    if (!resp.ok) return
    const data = await resp.json()
    if (data && data.success && data.user) {
      const role = (currentUser && currentUser.role) || data.user.role || 'citizen'
      currentUser = { email: data.user.email, role: role, loginTime: new Date().toISOString() }
      localStorage.setItem('currentUser', JSON.stringify(currentUser))
      updateAuthUI()
    }
  } catch (_) {
    // Ignore; keep existing local behavior
  }
}

async function serverLogin(email, password) {
  const resp = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  })
  if (!resp.ok) throw new Error('server login failed')
  const data = await resp.json()
  if (!data || !data.success || !data.user) throw new Error('bad response')
  return data.user
}

// Sample Data Loading
function loadSampleData() {
  // This would typically load from a server
  console.log("Sample data loaded")
}

// Filter Functions
document.getElementById("locationFilter")?.addEventListener("input", async (e) => {
  // For now just re-run load with current user location; backend already filters by keywords and radius
  await loadSocialFeed()
})

document.getElementById("platformFilter")?.addEventListener("change", async (e) => {
  // Platform-level filtering can be done client-side later; reloading for simplicity
  await loadSocialFeed()
})
async function fetchSocialMediaFeed(platform = 'all', keywords = [], location = null) {
    // Use unified aggregator endpoint that already returns mock/fallback data
    const coords = location || await getUserLocation()
    const platformParam = encodeURIComponent(platform || 'all')
    const resp = await fetch(`/api/social-feed?platform=${platformParam}&lat=${coords.lat}&lng=${coords.lng}`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    let posts = (data && data.posts) ? data.posts.slice() : []
    if (keywords && keywords.length) {
        const lowered = keywords.map(k => String(k).toLowerCase()).filter(Boolean)
        posts = posts.filter(p => {
            const hay = (p.text || p.caption || '').toLowerCase()
            return lowered.some(k => hay.includes(k))
        })
    }
    return posts
}

function renderSocialFeed(posts) {
    const feed = document.getElementById('socialFeed');
    feed.innerHTML = '';
    if (!posts.length) {
        feed.innerHTML = '<p>No posts found.</p>';
        return;
    }
    posts.forEach(post => {
        const div = document.createElement('div');
        div.className = 'social-post';
        div.innerHTML = `
            <div class="post-header">
                <span class="username">${post.username || 'Unknown'}</span>
                <span class="platform">${post.platform}</span>
                <span class="date">${new Date(post.created_at).toLocaleString()}</span>
            </div>
            <div class="post-content">
                <p>${post.caption}</p>
                ${post.media_url ? `<img src="${post.media_url}" alt="Media" style="max-width:100%;">` : ''}
            </div>
        `;
        feed.appendChild(div);
    });
}

// Event listeners for filter controls
document.addEventListener('DOMContentLoaded', () => {
    const socialCard = document.querySelector('.feature-card[data-feature="social"]');
    if (socialCard) {
        socialCard.addEventListener('click', async () => {
            document.getElementById('landingPage').style.display = 'none';
            document.getElementById('socialScreen').style.display = 'block';
            const posts = await fetchSocialMediaFeed('all', ['ocean', 'hazard', 'flood', 'tsunami', 'marine debris']);
            renderSocialFeed(posts);
        });
    }

    document.getElementById('platformFilter').addEventListener('change', async (e) => {
        const platform = e.target.value;
        const posts = await fetchSocialMediaFeed(platform, ['ocean', 'hazard', 'flood', 'tsunami', 'marine debris']);
        renderSocialFeed(posts);
    });

    document.getElementById('locationFilter').addEventListener('input', async (e) => {
        // For demo: location filter is not implemented in backend
        const keyword = e.target.value;
        const posts = await fetchSocialMediaFeed('all', [keyword]);
        renderSocialFeed(posts);
    });

    document.getElementById('backToLandingSocial').addEventListener('click', () => {
        document.getElementById('socialScreen').style.display = 'none';
        document.getElementById('landingPage').style.display = 'block';
    });
});
