/**
 * @fileoverview Police Station Database & Cascade Alert Module
 * Contains a mock database of 15 Delhi NCR police stations,
 * distance calculations, and a batched alerting system with
 * cascading response probabilities for the SOS Emergency Response App.
 */

class PoliceManager {
  constructor() {
    /**
     * Mock database of 15 police stations in the Delhi NCR region.
     * Each station has realistic coordinates, names, and contact info.
     * @type {Array<{id: number, name: string, lat: number, lng: number, phone: string, address: string}>}
     */
    this.STATIONS = [
      {
        id: 1,
        name: 'Connaught Place Police Station',
        lat: 28.6315,
        lng: 77.2167,
        phone: '+91-11-23741000',
        address: 'Block A, Connaught Place, New Delhi 110001'
      },
      {
        id: 2,
        name: 'Parliament Street Police Station',
        lat: 28.6200,
        lng: 77.2120,
        phone: '+91-11-23741100',
        address: 'Parliament Street, New Delhi 110001'
      },
      {
        id: 3,
        name: 'Chanakyapuri Police Station',
        lat: 28.5976,
        lng: 77.1855,
        phone: '+91-11-26115000',
        address: 'Chanakyapuri, New Delhi 110021'
      },
      {
        id: 4,
        name: 'Hauz Khas Police Station',
        lat: 28.5494,
        lng: 77.2001,
        phone: '+91-11-26851700',
        address: 'Hauz Khas, New Delhi 110016'
      },
      {
        id: 5,
        name: 'Sarojini Nagar Police Station',
        lat: 28.5744,
        lng: 77.1996,
        phone: '+91-11-24100032',
        address: 'Sarojini Nagar, New Delhi 110023'
      },
      {
        id: 6,
        name: 'Mehrauli Police Station',
        lat: 28.5185,
        lng: 77.1855,
        phone: '+91-11-26644100',
        address: 'Mehrauli, New Delhi 110030'
      },
      {
        id: 7,
        name: 'Vasant Kunj Police Station',
        lat: 28.5198,
        lng: 77.1564,
        phone: '+91-11-26134500',
        address: 'Vasant Kunj, New Delhi 110070'
      },
      {
        id: 8,
        name: 'Dwarka Sector 23 Police Station',
        lat: 28.5729,
        lng: 77.0423,
        phone: '+91-11-28044100',
        address: 'Sector 23, Dwarka, New Delhi 110077'
      },
      {
        id: 9,
        name: 'Rohini Sector 5 Police Station',
        lat: 28.7167,
        lng: 77.1187,
        phone: '+91-11-27941000',
        address: 'Sector 5, Rohini, New Delhi 110085'
      },
      {
        id: 10,
        name: 'Pitampura Police Station',
        lat: 28.7017,
        lng: 77.1316,
        phone: '+91-11-27018300',
        address: 'Pitampura, New Delhi 110034'
      },
      {
        id: 11,
        name: 'Lajpat Nagar Police Station',
        lat: 28.5700,
        lng: 77.2397,
        phone: '+91-11-26814100',
        address: 'Lajpat Nagar, New Delhi 110024'
      },
      {
        id: 12,
        name: 'Mayur Vihar Police Station',
        lat: 28.6077,
        lng: 77.2935,
        phone: '+91-11-22751000',
        address: 'Mayur Vihar Phase-I, New Delhi 110091'
      },
      {
        id: 13,
        name: 'Noida Sector 20 Police Station',
        lat: 28.5815,
        lng: 77.3133,
        phone: '+91-120-2522200',
        address: 'Sector 20, Noida, Uttar Pradesh 201301'
      },
      {
        id: 14,
        name: 'Gurgaon Sector 29 Police Station',
        lat: 28.4595,
        lng: 77.0266,
        phone: '+91-124-2302200',
        address: 'Sector 29, Gurugram, Haryana 122001'
      },
      {
        id: 15,
        name: 'Faridabad NIT Police Station',
        lat: 28.3710,
        lng: 77.3178,
        phone: '+91-129-2430100',
        address: 'NIT, Faridabad, Haryana 121001'
      }
    ];

    /** @private {Array|null} Stations sorted by distance from a reference point */
    this._sortedStations = null;

    /** @private {Map<number, string>} Station ID → current status */
    this._stationStatuses = new Map();

    /** @private {number} Current batch index in the cascade */
    this._currentBatchIndex = 0;
  }

  /**
   * Calculates the great-circle distance between two GPS coordinates
   * using the Haversine formula.
   * @param {number} lat1 - Latitude of point 1 (degrees).
   * @param {number} lng1 - Longitude of point 1 (degrees).
   * @param {number} lat2 - Latitude of point 2 (degrees).
   * @param {number} lng2 - Longitude of point 2 (degrees).
   * @returns {number} Distance in kilometers.
   */
  haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return parseFloat((R * c).toFixed(2));
  }

  /**
   * Returns all stations sorted by ascending distance from the given coordinates.
   * Each station object includes an additional `distance` property (in km).
   * @param {number} lat - User's latitude.
   * @param {number} lng - User's longitude.
   * @returns {Array<Object>} Sorted array of station objects with distance.
   */
  getNearestStations(lat, lng) {
    this._sortedStations = this.STATIONS.map(station => ({
      ...station,
      distance: this.haversineDistance(lat, lng, station.lat, station.lng)
    })).sort((a, b) => a.distance - b.distance);

    // Initialize all stations as 'queued'
    this._sortedStations.forEach(s => this._stationStatuses.set(s.id, 'queued'));
    this._currentBatchIndex = 0;

    return this._sortedStations;
  }

  /**
   * Returns a batch of 3 stations from the sorted list. Records the batch
   * index so per-station response probability reflects the escalation level.
   * @param {number} batchIndex - Zero-based batch index.
   * @returns {Array<Object>} Up to 3 stations for the requested batch.
   */
  getNextBatch(batchIndex) {
    if (!this._sortedStations) {
      console.warn('[PoliceManager] Call getNearestStations() first.');
      return [];
    }

    this._currentBatchIndex = batchIndex;

    const start = batchIndex * 3;
    const end = start + 3;
    return this._sortedStations.slice(start, end);
  }

  /**
   * Returns the total number of batches (each batch = 3 stations).
   * @returns {number}
   */
  getTotalBatches() {
    if (!this._sortedStations) return 0;
    return Math.ceil(this._sortedStations.length / 3);
  }

  /**
   * Simulates alerting a single police station.
   * Resolves after a random delay with a response result.
   * @param {Object} station - The station object to alert.
   * @returns {Promise<{stationId: number, responded: boolean}>}
   */
  alertStation(station) {
    this._stationStatuses.set(station.id, 'alerting');

    // Capture the batch index now, so a later batch starting before this
    // station resolves can't alter its computed response probability.
    const batchIndex = this._currentBatchIndex;

    return new Promise(resolve => {
      // Test mode: very fast delay (500-1000ms) to show rapid progress
      const delay = window.testMode ? (500 + Math.random() * 500) : (2000 + Math.random() * 6000);

      setTimeout(() => {
        this._stationStatuses.set(station.id, 'awaiting');

        // Test mode: much higher response rate to show success quickly
        let noResponseRate = Math.max(0.1, 0.7 - batchIndex * 0.2);
        if (window.testMode) {
          noResponseRate = Math.max(0.05, 0.3 - batchIndex * 0.1);
        }
        
        const responded = Math.random() > noResponseRate;

        this._stationStatuses.set(station.id, responded ? 'responded' : 'no-response');

        resolve({ stationId: station.id, responded });
      }, delay);
    });
  }

  /**
   * Alerts all stations in a batch simultaneously.
   * Updates the internal batch index after dispatching.
   * @param {Array<Object>} stations - Array of station objects to alert.
   * @returns {Promise<Array<{stationId: number, responded: boolean}>>}
   *   Resolves when all stations in the batch have completed.
   */
  alertBatch(stations) {
    const results = Promise.all(stations.map(s => this.alertStation(s)));
    this._currentBatchIndex++;
    return results;
  }

  /**
   * Returns the current status of a station by its ID.
   * @param {number} stationId - The station's unique ID.
   * @returns {'queued'|'alerting'|'awaiting'|'responded'|'no-response'}
   *   Current status string. Returns 'queued' for unknown stations.
   */
  getStationStatus(stationId) {
    return this._stationStatuses.get(stationId) || 'queued';
  }

  /**
   * Sets the status of a station.
   * @param {number} stationId - The station's unique ID.
   * @param {'queued'|'alerting'|'awaiting'|'responded'|'no-response'} status - The new status.
   */
  setStationStatus(stationId, status) {
    this._stationStatuses.set(stationId, status);
  }

  /**
   * Returns the Map of all station statuses.
   * @returns {Map<number, string>}
   */
  getAllStatuses() {
    return this._stationStatuses;
  }

  /**
   * Returns the number of stations that have been alerted (i.e. not queued).
   * @returns {number}
   */
  getAlertedCount() {
    let count = 0;
    for (const status of this._stationStatuses.values()) {
      if (status !== 'queued') count++;
    }
    return count;
  }

  /**
   * Resets the manager state
   */
  reset() {
    this._sortedStations = null;
    this._stationStatuses.clear();
    this._currentBatchIndex = 0;
  }
}

const policeManager = new PoliceManager();
window.policeManager = policeManager;

