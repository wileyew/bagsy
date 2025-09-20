import { createComponentDebugger } from "./debug-utils";

const debug = createComponentDebugger('GeolocationService');

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  accuracy: number;
}

export interface SearchLocation {
  latitude: number;
  longitude: number;
  radius: number; // in miles
  address?: string;
}

export interface NearbySpace {
  spaceId: string;
  distance: number; // in miles
  spaceType: string;
  price: number;
  address: string;
}

class GeolocationService {
  private currentLocation: LocationData | null = null;
  private watchId: number | null = null;

  /**
   * Get user's current location
   */
  async getCurrentLocation(): Promise<LocationData> {
    debug.info('Requesting current location');

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = new Error('Geolocation is not supported by this browser');
        debug.error('Geolocation not supported', error);
        reject(error);
        return;
      }

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const locationData = await this.reverseGeocode(
              position.coords.latitude,
              position.coords.longitude
            );
            
            this.currentLocation = {
              ...locationData,
              accuracy: position.coords.accuracy
            };

            debug.info('Location obtained successfully', {
              latitude: this.currentLocation.latitude,
              longitude: this.currentLocation.longitude,
              address: this.currentLocation.address,
              accuracy: this.currentLocation.accuracy
            });

            resolve(this.currentLocation);
          } catch (error) {
            debug.error('Reverse geocoding failed', error);
            reject(error);
          }
        },
        (error) => {
          debug.error('Geolocation error', error);
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        options
      );
    });
  }

  /**
   * Watch user's location changes
   */
  startLocationWatch(callback: (location: LocationData) => void): void {
    debug.info('Starting location watch');

    if (!navigator.geolocation) {
      debug.error('Geolocation not supported');
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000 // 1 minute
    };

    this.watchId = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const locationData = await this.reverseGeocode(
            position.coords.latitude,
            position.coords.longitude
          );
          
          const location: LocationData = {
            ...locationData,
            accuracy: position.coords.accuracy
          };

          this.currentLocation = location;
          callback(location);

          debug.info('Location updated', {
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address
          });
        } catch (error) {
          debug.error('Location watch error', error);
        }
      },
      (error) => {
        debug.error('Location watch error', error);
      },
      options
    );
  }

  /**
   * Stop watching location changes
   */
  stopLocationWatch(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      debug.info('Location watch stopped');
    }
  }

  /**
   * Get current cached location
   */
  getCachedLocation(): LocationData | null {
    return this.currentLocation;
  }

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    debug.debug('Distance calculated', { lat1, lon1, lat2, lon2, distance });
    return distance;
  }

  /**
   * Find spaces within radius of a location
   */
  async findNearbySpaces(
    searchLocation: SearchLocation,
    spaceType?: string,
    maxResults: number = 20
  ): Promise<NearbySpace[]> {
    debug.info('Finding nearby spaces', { 
      searchLocation, 
      spaceType, 
      maxResults 
    });

    try {
      // This would typically query your database
      // For now, we'll return a mock implementation
      const mockSpaces: NearbySpace[] = [
        {
          spaceId: 'space-1',
          distance: 0.5,
          spaceType: 'garage',
          price: 8,
          address: '123 Main St, San Francisco, CA 94110'
        },
        {
          spaceId: 'space-2',
          distance: 1.2,
          spaceType: 'driveway',
          price: 5,
          address: '456 Oak Ave, San Francisco, CA 94110'
        }
      ];

      // Filter by space type if specified
      const filteredSpaces = spaceType 
        ? mockSpaces.filter(space => space.spaceType === spaceType)
        : mockSpaces;

      // Sort by distance
      const sortedSpaces = filteredSpaces
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxResults);

      debug.info('Nearby spaces found', { 
        count: sortedSpaces.length,
        searchRadius: searchLocation.radius 
      });

      return sortedSpaces;
    } catch (error) {
      debug.error('Failed to find nearby spaces', error);
      throw error;
    }
  }

  /**
   * Get location-based search suggestions
   */
  async getLocationSuggestions(query: string, userLocation?: LocationData): Promise<string[]> {
    debug.info('Getting location suggestions', { query, hasUserLocation: !!userLocation });

    try {
      // Mock implementation - in production, this would use a geocoding API
      const suggestions = [
        `${query}, San Francisco, CA`,
        `${query}, Oakland, CA`,
        `${query}, Berkeley, CA`,
        `${query}, San Jose, CA`
      ];

      // If user has location, prioritize nearby areas
      if (userLocation) {
        const nearbySuggestions = [
          `${query}, ${userLocation.city}, ${userLocation.state}`,
          `${query}, ${userLocation.zipCode}`
        ];
        return [...nearbySuggestions, ...suggestions].slice(0, 5);
      }

      return suggestions.slice(0, 5);
    } catch (error) {
      debug.error('Failed to get location suggestions', error);
      return [];
    }
  }

  /**
   * Check if location is within radius
   */
  isWithinRadius(
    centerLat: number,
    centerLon: number,
    targetLat: number,
    targetLon: number,
    radiusMiles: number
  ): boolean {
    const distance = this.calculateDistance(centerLat, centerLon, targetLat, targetLon);
    return distance <= radiusMiles;
  }

  /**
   * Get location-based pricing insights
   */
  async getLocationPricingInsights(
    location: LocationData,
    spaceType: string,
    radiusMiles: number = 5
  ): Promise<{
    averagePrice: number;
    priceRange: { min: number; max: number };
    competitorCount: number;
    locationFactor: number; // 0-1 scale
  }> {
    debug.info('Getting location pricing insights', { 
      location: location.address, 
      spaceType, 
      radiusMiles 
    });

    try {
      // Mock implementation - in production, this would analyze nearby spaces
      const insights = {
        averagePrice: 8.5,
        priceRange: { min: 5, max: 15 },
        competitorCount: 12,
        locationFactor: 0.8 // High demand area
      };

      debug.info('Location pricing insights generated', insights);
      return insights;
    } catch (error) {
      debug.error('Failed to get location pricing insights', error);
      throw error;
    }
  }

  // Private helper methods

  private async reverseGeocode(latitude: number, longitude: number): Promise<Omit<LocationData, 'accuracy'>> {
    debug.debug('Reverse geocoding coordinates', { latitude, longitude });

    try {
      // Using a free geocoding service (you might want to use Google Maps API or similar)
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      const locationData: Omit<LocationData, 'accuracy'> = {
        latitude,
        longitude,
        address: `${data.locality || ''}, ${data.principalSubdivision || ''} ${data.postcode || ''}`.trim(),
        city: data.locality || '',
        state: data.principalSubdivision || '',
        zipCode: data.postcode || '',
        country: data.countryName || ''
      };

      debug.debug('Reverse geocoding successful', locationData);
      return locationData;
    } catch (error) {
      debug.error('Reverse geocoding failed', error);
      
      // Fallback to coordinates-only data
      return {
        latitude,
        longitude,
        address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        city: '',
        state: '',
        zipCode: '',
        country: ''
      };
    }
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export const geolocationService = new GeolocationService();
