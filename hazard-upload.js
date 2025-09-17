// HazardUpload (vanilla JS, backend upload to /api/uploads)
// - Requires: exif-js loaded globally (window.EXIF)
// - Mounts into element with id="hazardUploadMount" if present

// -------- Utility: numbers, DMS, Haversine --------
function toNumber(value) {
  if (typeof value === 'number') return value
  if (value && typeof value.numerator === 'number' && typeof value.denominator === 'number' && value.denominator !== 0) {
    return value.numerator / value.denominator
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3 || !ref) return null
  const d = toNumber(dms[0])
  const m = toNumber(dms[1])
  const s = toNumber(dms[2])
  if (![d, m, s].every(Number.isFinite)) return null
  let dec = d + m / 60 + s / 3600
  const upper = String(ref).toUpperCase()
  if (upper === 'S' || upper === 'W') dec = -dec
  return dec
}

function haversineKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}

// -------- Core requirement: compareGeoTags --------
function compareGeoTags(liveCoords, exifData) {
  const lat = dmsToDecimal(exifData?.GPSLatitude, exifData?.GPSLatitudeRef)
  const lng = dmsToDecimal(exifData?.GPSLongitude, exifData?.GPSLongitudeRef)
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: 'Image must contain location metadata.' }
  }
  const exifCoords = { lat, lng }
  const distanceKm = haversineKm(liveCoords, exifCoords)
  if (distanceKm > 1) {
    return { ok: false, exifCoords, reason: 'Image location does not match your current location.' }
  }
  return { ok: true, exifCoords }
}

// -------- Geolocation (required) --------
function getLiveLocation() {
  return new Promise(async (resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location access is required to submit a report.'))
      return
    }
    // Try to provide actionable guidance if permission is denied
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const st = await navigator.permissions.query({ name: 'geolocation' })
        if (st && st.state === 'denied') {
          reject(new Error('Location is blocked for this site. Click the lock icon → Site settings → Location → Allow, then reload.'))
          return
        }
      }
    } catch (_) {}

    const viaWatch = (options) => new Promise((res, rej) => {
      const id = navigator.geolocation.watchPosition(
        (pos) => { navigator.geolocation.clearWatch(id); res({ lat: pos.coords.latitude, lng: pos.coords.longitude }) },
        (err) => { navigator.geolocation.clearWatch(id); rej(err) },
        options
      )
    })
    const viaOnce = (options) => new Promise((res, rej) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => res({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => rej(err),
        options
      )
    })

    try {
      // First attempt: watchPosition to trigger prompt and fresh reading
      const loc = await viaWatch({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
      resolve(loc)
      return
    } catch (e1) {
      // Fallback 1: single read high accuracy
      try {
        const loc2 = await viaOnce({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
        resolve(loc2)
        return
      } catch (e2) {
        // Fallback 2: low accuracy with longer timeout (desktop/IP based)
        try {
          const loc3 = await viaOnce({ enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 })
          resolve(loc3)
          return
        } catch (e3) {
          if (e3 && e3.code === 2) {
            reject(new Error('Location unavailable. Ensure device location is ON, disable VPN, and connect to Wi‑Fi for better accuracy.'))
          } else if (e3 && e3.code === 3) {
            reject(new Error('Location request timed out. Move to an open area and retry.'))
          } else if (e3 && e3.code === 1) {
            reject(new Error('Please allow the location prompt to continue.'))
          } else {
            reject(new Error('Location access is required to submit a report.'))
          }
        }
      }
    }
  })
}

// -------- EXIF reading --------
function readExif(file) {
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

// -------- Auth guard (Firebase Auth) --------
function ensureSignedIn() {
  const user = auth.currentUser
  if (!user) {
    alert('Please sign in before uploading.')
    return null
  }
  return user
}

// -------- UI Rendering --------
function renderUI(mount) {
  const authBox = document.createElement('div')
  authBox.className = 'uploader-card'
  const status = document.createElement('div')
  status.className = 'uploader-status'
  status.textContent = 'Upload a JPEG with EXIF GPS. Your live location must match.'
  authBox.appendChild(status)
  mount.appendChild(authBox)

  const form = document.createElement('form')
  form.style.display = 'grid'
  form.style.gap = '12px'
  form.style.maxWidth = '800px'

  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'image/*'
  fileInput.className = 'uploader-file'

  const submitBtn = document.createElement('button')
  submitBtn.type = 'submit'
  submitBtn.textContent = 'Submit Report'
  submitBtn.className = 'btn btn-primary'

  form.appendChild(fileInput)
  form.appendChild(submitBtn)
  mount.appendChild(form)

  let selectedFile = null
  fileInput.addEventListener('change', (e) => {
    selectedFile = e.target.files && e.target.files[0] ? e.target.files[0] : null
    if (!selectedFile) return
    // --- Image submission criteria ---
    const ALLOWED_MIME = ['image/jpeg', 'image/jpg']
    const MAX_SIZE_MB = 10
    const sizeMb = selectedFile.size / (1024 * 1024)
    if (!ALLOWED_MIME.includes((selectedFile.type || '').toLowerCase())) {
      alert('Only JPEG images with EXIF GPS are allowed.')
      fileInput.value = ''
      selectedFile = null
      return
    }
    if (sizeMb > MAX_SIZE_MB) {
      alert(`Image too large. Max size is ${MAX_SIZE_MB} MB.`)
      fileInput.value = ''
      selectedFile = null
      return
    }
  })

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedFile) {
      alert('Please select an image file.')
      return
    }
    // Re-validate criteria before submit
    const ALLOWED_MIME = ['image/jpeg', 'image/jpg']
    const MAX_SIZE_MB = 10
    const sizeMb = selectedFile.size / (1024 * 1024)
    if (!ALLOWED_MIME.includes((selectedFile.type || '').toLowerCase())) {
      alert('Only JPEG images with EXIF GPS are allowed.')
      return
    }
    if (sizeMb > MAX_SIZE_MB) {
      alert(`Image too large. Max size is ${MAX_SIZE_MB} MB.`)
      return
    }

    submitBtn.disabled = true
    submitBtn.textContent = 'Uploading...'
    try {
      const live = await getLiveLocation().catch((err) => { throw new Error(err?.message || 'Location access is required to submit a report.') })
      const exif = await readExif(selectedFile).catch(() => ({}))
      const check = compareGeoTags(live, exif)
      if (!check.ok) throw new Error(check.reason || 'Image location validation failed.')

      // Upload to backend (Mongo GridFS)
      const fd = new FormData()
      fd.append('image', selectedFile, selectedFile.name)
      const resp = await fetch('/api/uploads', { method: 'POST', body: fd, credentials: 'include' })
      if (!resp.ok) throw new Error(`Upload failed (${resp.status})`)
      const data = await resp.json()
      if (!data || !data.success) throw new Error(data?.message || 'Upload failed')

      alert('Report submitted successfully.')
      fileInput.value = ''
      selectedFile = null
    } catch (err) {
      alert(err?.message || 'Failed to submit report.')
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = 'Submit Report'
    }
  }

  form.addEventListener('submit', handleSubmit)

}

// Mount when DOM is ready
// Removed auto-mounting from landing page per request

// Export compare function for testing if needed
export { compareGeoTags }

// -------- Proactive location prompt helper --------
let __promptedOnce = false
function tryTriggerLocationPromptOnce() {
  if (__promptedOnce) return
  __promptedOnce = true
  if (!navigator.geolocation) return
  // Use watchPosition to encourage the browser to show the permission UI
  const id = navigator.geolocation.watchPosition(
    () => navigator.geolocation.clearWatch(id),
    () => navigator.geolocation.clearWatch(id),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  )
}


