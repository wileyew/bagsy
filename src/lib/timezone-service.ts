import { createComponentDebugger } from "./debug-utils";

const debug = createComponentDebugger('TimezoneService');

export interface TimezoneData {
  timezone: string;
  displayName: string;
  offset: string;
}

class TimezoneService {
  /**
   * Get timezone from coordinates using a more reliable approach
   */
  async getTimezoneFromCoordinates(latitude: number, longitude: number): Promise<TimezoneData> {
    debug.info('Getting timezone from coordinates', { latitude, longitude });

    try {
      // Use a more reliable approach with approximate timezone mapping
      // This approach is more accurate for US locations
      return this.estimateTimezoneFromCoordinates(latitude, longitude);
    } catch (error) {
      debug.error('Timezone detection failed', error);
      
      // Fallback: estimate timezone based on longitude
      return this.estimateTimezoneFromLongitude(longitude);
    }
  }

  /**
   * Get timezone from address using geocoding + timezone detection
   */
  async getTimezoneFromAddress(address: string): Promise<TimezoneData> {
    debug.info('Getting timezone from address', { address });

    try {
      // First geocode the address to get coordinates
      const coordinates = await this.geocodeAddress(address);
      
      // Then get timezone from coordinates
      return await this.getTimezoneFromCoordinates(coordinates.latitude, coordinates.longitude);
    } catch (error) {
      debug.error('Failed to get timezone from address', error);
      
      // Fallback: try to estimate from address components
      return this.estimateTimezoneFromAddress(address);
    }
  }

  /**
   * Format timezone for display
   */
  formatTimezoneDisplay(timezone: string): string {
    const timezoneMap: { [key: string]: string } = {
      'America/Los_Angeles': 'Pacific Time (PT)',
      'America/Denver': 'Mountain Time (MT)',
      'America/Chicago': 'Central Time (CT)',
      'America/New_York': 'Eastern Time (ET)',
      'America/Phoenix': 'Arizona Time',
      'America/Anchorage': 'Alaska Time (AKT)',
      'Pacific/Honolulu': 'Hawaii Time (HST)',
      'America/Toronto': 'Eastern Time (ET)',
      'America/Vancouver': 'Pacific Time (PT)',
      'America/Edmonton': 'Mountain Time (MT)',
      'America/Winnipeg': 'Central Time (CT)',
      'America/Halifax': 'Atlantic Time (AT)',
      'America/St_Johns': 'Newfoundland Time (NT)'
    };

    return timezoneMap[timezone] || timezone;
  }

  /**
   * Get timezone offset in hours
   */
  getTimezoneOffset(timezone: string): number {
    const now = new Date();
    const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const targetTime = new Date(utc.toLocaleString("en-US", { timeZone: timezone }));
    return (targetTime.getTime() - utc.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Check if timezone supports daylight saving time
   */
  supportsDST(timezone: string): boolean {
    const january = new Date(2024, 0, 1); // January 1st
    const july = new Date(2024, 6, 1); // July 1st
    
    const janOffset = this.getTimezoneOffset(timezone);
    const julOffset = this.getTimezoneOffset(timezone);
    
    return janOffset !== julOffset;
  }

  // Private helper methods

  private async geocodeAddress(address: string): Promise<{ latitude: number; longitude: number }> {
    debug.debug('Geocoding address', { address });

    try {
      // Using a free geocoding service
      const response = await fetch(
        `https://api.bigdatacloud.net/data/forward-geocode-client?query=${encodeURIComponent(address)}&localityLanguage=en`
      );

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        throw new Error('No results found for address');
      }

      const result = data.results[0];
      const coordinates = {
        latitude: result.latitude,
        longitude: result.longitude
      };

      debug.debug('Geocoding successful', coordinates);
      return coordinates;
    } catch (error) {
      debug.error('Geocoding failed', error);
      throw error;
    }
  }

  private estimateTimezoneFromLongitude(longitude: number): TimezoneData {
    debug.debug('Estimating timezone from longitude', { longitude });

    // Rough estimation based on longitude
    // Each 15 degrees of longitude represents approximately 1 hour of time difference
    const offsetHours = Math.round(longitude / 15);
    
    let timezone: string;
    let displayName: string;

    if (offsetHours >= -8 && offsetHours <= -5) {
      // US timezones
      if (offsetHours === -8) {
        timezone = 'America/Los_Angeles';
        displayName = 'Pacific Time (PT)';
      } else if (offsetHours === -7) {
        timezone = 'America/Denver';
        displayName = 'Mountain Time (MT)';
      } else if (offsetHours === -6) {
        timezone = 'America/Chicago';
        displayName = 'Central Time (CT)';
      } else if (offsetHours === -5) {
        timezone = 'America/New_York';
        displayName = 'Eastern Time (ET)';
      } else {
        timezone = 'America/Los_Angeles';
        displayName = 'Pacific Time (PT)';
      }
    } else {
      // Default to Pacific Time for US addresses
      timezone = 'America/Los_Angeles';
      displayName = 'Pacific Time (PT)';
    }

    const timezoneData: TimezoneData = {
      timezone,
      displayName,
      offset: offsetHours.toString()
    };

    debug.debug('Timezone estimated', timezoneData);
    return timezoneData;
  }

  private estimateTimezoneFromAddress(address: string): TimezoneData {
    debug.debug('Estimating timezone from address', { address });

    const addressLower = address.toLowerCase();
    
    // State-based estimation for US addresses
    if (addressLower.includes('california') || addressLower.includes('ca')) {
      return { timezone: 'America/Los_Angeles', displayName: 'Pacific Time (PT)', offset: '-8' };
    } else if (addressLower.includes('nevada') || addressLower.includes('nv')) {
      return { timezone: 'America/Los_Angeles', displayName: 'Pacific Time (PT)', offset: '-8' };
    } else if (addressLower.includes('washington') || addressLower.includes('wa')) {
      return { timezone: 'America/Los_Angeles', displayName: 'Pacific Time (PT)', offset: '-8' };
    } else if (addressLower.includes('oregon') || addressLower.includes('or')) {
      return { timezone: 'America/Los_Angeles', displayName: 'Pacific Time (PT)', offset: '-8' };
    } else if (addressLower.includes('colorado') || addressLower.includes('co')) {
      return { timezone: 'America/Denver', displayName: 'Mountain Time (MT)', offset: '-7' };
    } else if (addressLower.includes('utah') || addressLower.includes('ut')) {
      return { timezone: 'America/Denver', displayName: 'Mountain Time (MT)', offset: '-7' };
    } else if (addressLower.includes('arizona') || addressLower.includes('az')) {
      return { timezone: 'America/Phoenix', displayName: 'Arizona Time', offset: '-7' };
    } else if (addressLower.includes('texas') || addressLower.includes('tx')) {
      return { timezone: 'America/Chicago', displayName: 'Central Time (CT)', offset: '-6' };
    } else if (addressLower.includes('illinois') || addressLower.includes('il')) {
      return { timezone: 'America/Chicago', displayName: 'Central Time (CT)', offset: '-6' };
    } else if (addressLower.includes('new york') || addressLower.includes('ny')) {
      return { timezone: 'America/New_York', displayName: 'Eastern Time (ET)', offset: '-5' };
    } else if (addressLower.includes('florida') || addressLower.includes('fl')) {
      return { timezone: 'America/New_York', displayName: 'Eastern Time (ET)', offset: '-5' };
    } else if (addressLower.includes('alaska') || addressLower.includes('ak')) {
      return { timezone: 'America/Anchorage', displayName: 'Alaska Time (AKT)', offset: '-9' };
    } else if (addressLower.includes('hawaii') || addressLower.includes('hi')) {
      return { timezone: 'Pacific/Honolulu', displayName: 'Hawaii Time (HST)', offset: '-10' };
    }

    // Default to Pacific Time
    return { timezone: 'America/Los_Angeles', displayName: 'Pacific Time (PT)', offset: '-8' };
  }

  /**
   * Estimate timezone from coordinates using geographical boundaries
   * This method is more accurate than simple longitude-based estimation
   */
  private estimateTimezoneFromCoordinates(latitude: number, longitude: number): TimezoneData {
    debug.debug('Estimating timezone from coordinates', { latitude, longitude });

    // US timezone boundaries (approximate)
    // Pacific Time: roughly west of -120° longitude
    // Mountain Time: roughly -120° to -104° longitude  
    // Central Time: roughly -104° to -90° longitude
    // Eastern Time: roughly east of -90° longitude

    // Alaska: latitude > 51° or specific Alaska coordinates
    if (latitude > 51 && (longitude >= -180 && longitude <= -130)) {
      return {
        timezone: 'America/Anchorage',
        displayName: 'Alaska Time (AKT)',
        offset: '-9'
      };
    }

    // Hawaii: roughly latitude 18-22°, longitude -160° to -154°
    if (latitude >= 18 && latitude <= 23 && longitude >= -161 && longitude <= -154) {
      return {
        timezone: 'Pacific/Honolulu',
        displayName: 'Hawaii Time (HST)',
        offset: '-10'
      };
    }

    // Arizona (Phoenix Time, no DST) - approximate boundaries
    // Arizona is roughly latitude 31-37°, longitude -109° to -115°
    if (latitude >= 31 && latitude <= 37 && longitude >= -115 && longitude <= -109) {
      return {
        timezone: 'America/Phoenix',
        displayName: 'Arizona Time',
        offset: '-7'
      };
    }

    // Continental US timezones based on longitude
    if (longitude <= -120) {
      // Pacific Time
      return {
        timezone: 'America/Los_Angeles',
        displayName: 'Pacific Time (PT)',
        offset: '-8'
      };
    } else if (longitude > -120 && longitude <= -104) {
      // Mountain Time
      return {
        timezone: 'America/Denver',
        displayName: 'Mountain Time (MT)',
        offset: '-7'
      };
    } else if (longitude > -104 && longitude <= -90) {
      // Central Time
      return {
        timezone: 'America/Chicago',
        displayName: 'Central Time (CT)',
        offset: '-6'
      };
    } else {
      // Eastern Time
      return {
        timezone: 'America/New_York',
        displayName: 'Eastern Time (ET)',
        offset: '-5'
      };
    }
  }
}

export const timezoneService = new TimezoneService();
