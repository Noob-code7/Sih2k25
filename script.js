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
      if (requireAuth(() => showScreen("socialScreen"))) {
        showScreen("socialScreen")
        loadSocialFeed()
      }
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

  // Simple validation (in real app, this would be server-side)
  if (email && password && role) {
    currentUser = {
      email: email,
      role: role,
      loginTime: new Date().toISOString(),
    }

    localStorage.setItem("currentUser", JSON.stringify(currentUser))
    updateAuthUI()
    hideModal(loginModal)

    if (pendingAction) {
      pendingAction()
      pendingAction = null
    }

    loginForm.reset()
  } else {
    alert("Please fill in all fields")
  }
}

function handleLogout() {
  currentUser = null
  localStorage.removeItem("currentUser")
  updateAuthUI()
  showScreen("landingPage") // Return to landing page on logout
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
function handleHazardReport(e) {
  e.preventDefault()

  if (!currentUser) {
    showLoginModal()
    return
  }

  const hazardType = document.getElementById("hazardType").value
  const description = document.getElementById("description").value
  const severity = document.getElementById("severity").value
  const mediaFile = document.getElementById("mediaUpload").files[0]

  // Get current location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const report = {
          id: Date.now(),
          type: hazardType,
          description: description,
          severity: severity,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: new Date().toISOString(),
          reporter: currentUser.email,
          media: mediaFile ? mediaFile.name : null,
        }

        hazardReports.push(report)
        addHazardToMap(report)
        hideModal(reportModal)
        hazardForm.reset()

        alert("Hazard report submitted successfully!")
      },
      (error) => {
        alert("Location access required to submit hazard report")
      },
    )
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
function loadSocialFeed() {
  const socialFeed = document.getElementById("socialFeed")
  if (!socialFeed) return

  // Clear existing content
  socialFeed.innerHTML = ""

  // Load sample social media posts
  const samplePosts = [
    {
      platform: "twitter",
      user: "@OceanWatch",
      content: "Strong rip currents reported at Manhattan Beach. Please exercise caution! #OceanSafety",
      timestamp: "2 hours ago",
      location: "Manhattan Beach, CA",
    },
    {
      platform: "instagram",
      user: "@surfer_dude",
      content: "Massive waves today! 8-10 footers rolling in. Not for beginners! 🌊",
      timestamp: "4 hours ago",
      location: "Malibu, CA",
    },
    {
      platform: "facebook",
      user: "LA County Lifeguards",
      content:
        "Water quality advisory in effect for Santa Monica Bay due to recent rainfall. Avoid water contact for 72 hours.",
      timestamp: "6 hours ago",
      location: "Santa Monica Bay",
    },
  ]

  samplePosts.forEach((post) => {
    const postElement = createSocialPostElement(post)
    socialFeed.appendChild(postElement)
  })
}

function createSocialPostElement(post) {
  const postDiv = document.createElement("div")
  postDiv.className = "social-post"

  postDiv.innerHTML = `
        <div class="post-header">
            <div class="platform-icon ${post.platform}">
                <i class="fab fa-${post.platform}"></i>
            </div>
            <div>
                <strong>${post.user}</strong>
                <div style="font-size: 0.9em; color: #666;">${post.location} • ${post.timestamp}</div>
            </div>
        </div>
        <div class="post-content">
            ${post.content}
        </div>
    `

  return postDiv
}

// Modal Management
function showModal(modal) {
  modal.classList.add("active")
}

function hideModal(modal) {
  modal.classList.remove("active")
}

// Sample Data Loading
function loadSampleData() {
  // This would typically load from a server
  console.log("Sample data loaded")
}

// Filter Functions
document.getElementById("locationFilter")?.addEventListener("input", (e) => {
  filterSocialPosts(e.target.value, document.getElementById("platformFilter").value)
})

document.getElementById("platformFilter")?.addEventListener("change", (e) => {
  filterSocialPosts(document.getElementById("locationFilter").value, e.target.value)
})

function filterSocialPosts(location, platform) {
  // Implementation for filtering social media posts
  console.log("Filtering posts:", { location, platform })
}
