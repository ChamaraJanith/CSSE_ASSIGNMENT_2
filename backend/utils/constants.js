module.exports = {
  STAGING_OUTPOSTS: {
    'katagamuwa': { lat: 6.4150, lng: 81.4720 },
    'palatupana': { lat: 6.3685, lng: 81.5190 },
    'kumbukkan': { lat: 6.5200, lng: 81.6800 },
    'sithulpawwa': { lat: 6.4350, lng: 81.4500 },
    'galgamuwa': { lat: 6.4600, lng: 81.5400 },
    'camp east': { lat: 6.3980, lng: 81.5100 },
    'camp west': { lat: 6.3845, lng: 81.5050 },
    'hunuwilgama': { lat: 8.4350, lng: 80.0600 },
    'maradanmaduwa': { lat: 8.4800, lng: 80.0200 },
    'kala oya': { lat: 8.3500, lng: 79.8500 },
    'thanamalwila': { lat: 6.4700, lng: 80.8900 },
    'reservoir dam': { lat: 6.4400, lng: 80.8400 }
  },
  PARK_CENTERS: {
    1: { lat: 6.3845, lng: 81.5050 }, // Yala
    2: { lat: 8.4500, lng: 80.0500 }, // Wilpattu
    3: { lat: 6.4700, lng: 80.8800 }  // Udawalawe
  },
  SEVERITY_WEIGHT_MAP: { 
    'CRITICAL': 10.0, 
    'HIGH': 7.5, 
    'MEDIUM': 5.0, 
    'LOW': 2.0 
  },
  DEADLINE_MINUTES_MAP: { 
    'CRITICAL': 15, 
    'HIGH': 30, 
    'MEDIUM': 60, 
    'LOW': 120 
  }
};
