// Generates sample hazard points around a center
function generateHazards(centerLat, centerLng, count = 25) {
  const hazards = []
  function rand(delta) { return (Math.random() - 0.5) * delta }
  const types = ['Rip Current', 'High Waves', 'Marine Debris', 'Oil Spill']
  const severities = ['low', 'medium', 'high']
  for (let i = 0; i < count; i++) {
    const lat = centerLat + rand(0.3)
    const lng = centerLng + rand(0.3)
    hazards.push({
      id: Date.now() + i,
      type: types[Math.floor(Math.random() * types.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      lat, lng,
      description: 'Auto-generated sample hazard',
      timestamp: new Date().toISOString(),
    })
  }
  return hazards
}

// Intentionally left empty: demo data generator removed for production-like behavior


