/**
 * VELORA - Pincode Delivery Availability Engine (Demo / College Storefront)
 * 
 * Validates 6-digit Indian Postal PIN codes. For any valid Indian 6-digit PIN,
 * delivery is confirmed as AVAILABLE with 100% FREE DELIVERY.
 * Computes dynamic delivery ETA, manages shopping session persistence,
 * and seamlessly synchronizes with the checkout address flow.
 * No external serviceability database/table is required.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'velora_checked_pincode';

  // Major Indian cities and postal circles for authentic location display
  const KNOWN_PINCODES = {
    // Delhi NCR
    '110001': { city: 'New Delhi', state: 'Delhi' },
    '110006': { city: 'Old Delhi', state: 'Delhi' },
    '110020': { city: 'South Delhi', state: 'Delhi' },
    '122001': { city: 'Gurugram', state: 'Haryana' },
    '201301': { city: 'Noida', state: 'Uttar Pradesh' },
    '201001': { city: 'Ghaziabad', state: 'Uttar Pradesh' },

    // Maharashtra
    '400001': { city: 'Mumbai', state: 'Maharashtra' },
    '400050': { city: 'Bandra (Mumbai)', state: 'Maharashtra' },
    '400076': { city: 'Powai (Mumbai)', state: 'Maharashtra' },
    '411001': { city: 'Pune', state: 'Maharashtra' },
    '440001': { city: 'Nagpur', state: 'Maharashtra' },
    '431001': { city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra' },

    // Karnataka
    '560001': { city: 'Bengaluru', state: 'Karnataka' },
    '560034': { city: 'Koramangala (Bengaluru)', state: 'Karnataka' },
    '560100': { city: 'Electronic City (Bengaluru)', state: 'Karnataka' },
    '570001': { city: 'Mysuru', state: 'Karnataka' },
    '575001': { city: 'Mangaluru', state: 'Karnataka' },

    // Bihar & Jharkhand
    '800001': { city: 'Patna', state: 'Bihar' },
    '800020': { city: 'Kankarbagh (Patna)', state: 'Bihar' },
    '842001': { city: 'Muzaffarpur', state: 'Bihar' },
    '834001': { city: 'Ranchi', state: 'Jharkhand' },
    '831001': { city: 'Jamshedpur', state: 'Jharkhand' },

    // West Bengal
    '700001': { city: 'Kolkata', state: 'West Bengal' },
    '700091': { city: 'Salt Lake (Kolkata)', state: 'West Bengal' },
    '734001': { city: 'Siliguri', state: 'West Bengal' },

    // Tamil Nadu
    '600001': { city: 'Chennai', state: 'Tamil Nadu' },
    '600028': { city: 'R.A. Puram (Chennai)', state: 'Tamil Nadu' },
    '641001': { city: 'Coimbatore', state: 'Tamil Nadu' },
    '625001': { city: 'Madurai', state: 'Tamil Nadu' },

    // Telangana & Andhra Pradesh
    '500001': { city: 'Hyderabad', state: 'Telangana' },
    '500081': { city: 'Hitec City (Hyderabad)', state: 'Telangana' },
    '530001': { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
    '520001': { city: 'Vijayawada', state: 'Andhra Pradesh' },

    // Gujarat
    '380001': { city: 'Ahmedabad', state: 'Gujarat' },
    '395001': { city: 'Surat', state: 'Gujarat' },
    '390001': { city: 'Vadodara', state: 'Gujarat' },

    // Rajasthan
    '302001': { city: 'Jaipur', state: 'Rajasthan' },
    '342001': { city: 'Jodhpur', state: 'Rajasthan' },
    '313001': { city: 'Udaipur', state: 'Rajasthan' },

    // Uttar Pradesh & Punjab
    '226001': { city: 'Lucknow', state: 'Uttar Pradesh' },
    '208001': { city: 'Kanpur', state: 'Uttar Pradesh' },
    '221001': { city: 'Varanasi', state: 'Uttar Pradesh' },
    '282001': { city: 'Agra', state: 'Uttar Pradesh' },
    '160017': { city: 'Chandigarh', state: 'Chandigarh' },
    '141001': { city: 'Ludhiana', state: 'Punjab' },
    '143001': { city: 'Amritsar', state: 'Punjab' },

    // Kerala, MP, Goa & Others
    '682001': { city: 'Kochi', state: 'Kerala' },
    '695001': { city: 'Thiruvananthapuram', state: 'Kerala' },
    '462001': { city: 'Bhopal', state: 'Madhya Pradesh' },
    '452001': { city: 'Indore', state: 'Madhya Pradesh' },
    '403001': { city: 'Panaji', state: 'Goa' },
    '781001': { city: 'Guwahati', state: 'Assam' },
    '751001': { city: 'Bhubaneswar', state: 'Odisha' },
    '492001': { city: 'Raipur', state: 'Chhattisgarh' },
    '190001': { city: 'Srinagar', state: 'Jammu & Kashmir' },
    '171001': { city: 'Shimla', state: 'Himachal Pradesh' },
    '248001': { city: 'Dehradun', state: 'Uttarakhand' }
  };

  /**
   * Resolve state and region from Indian postal circle prefixes (1st and 2nd digits)
   */
  function resolvePostalRegion(pin) {
    if (KNOWN_PINCODES[pin]) {
      return { ...KNOWN_PINCODES[pin] };
    }

    const prefix2 = pin.slice(0, 2);
    const prefix1 = pin.charAt(0);

    let state = 'India';
    let city = `PIN Zone ${pin.slice(0, 3)}`;

    switch (prefix2) {
      case '11': state = 'Delhi'; city = 'Delhi Region'; break;
      case '12': case '13': state = 'Haryana'; city = 'Haryana Circle'; break;
      case '14': case '15': state = 'Punjab'; city = 'Punjab Circle'; break;
      case '16': state = 'Chandigarh'; city = 'Chandigarh Circle'; break;
      case '17': state = 'Himachal Pradesh'; city = 'Himachal Circle'; break;
      case '18': case '19': state = 'Jammu & Kashmir'; city = 'J&K Circle'; break;
      case '20': case '21': case '22': case '23': case '26': case '27': case '28':
        state = 'Uttar Pradesh'; city = 'UP Circle'; break;
      case '24': case '25': state = 'Uttarakhand'; city = 'Uttarakhand Circle'; break;
      case '30': case '31': case '32': case '33': case '34':
        state = 'Rajasthan'; city = 'Rajasthan Circle'; break;
      case '36': case '37': case '38': case '39':
        state = 'Gujarat'; city = 'Gujarat Circle'; break;
      case '40': case '41': case '42': case '43': case '44':
        state = 'Maharashtra'; city = 'Maharashtra Circle'; break;
      case '45': case '46': case '47': case '48':
        state = 'Madhya Pradesh'; city = 'MP Circle'; break;
      case '49': state = 'Chhattisgarh'; city = 'Chhattisgarh Circle'; break;
      case '50': state = 'Telangana'; city = 'Telangana Circle'; break;
      case '51': case '52': case '53':
        state = 'Andhra Pradesh'; city = 'Andhra Pradesh Circle'; break;
      case '56': case '57': case '58': case '59':
        state = 'Karnataka'; city = 'Karnataka Circle'; break;
      case '60': case '61': case '62': case '63': case '64':
        state = 'Tamil Nadu'; city = 'Tamil Nadu Circle'; break;
      case '67': case '68': case '69':
        state = 'Kerala'; city = 'Kerala Circle'; break;
      case '70': case '71': case '72': case '73': case '74':
        state = 'West Bengal'; city = 'West Bengal Circle'; break;
      case '75': case '76': case '77':
        state = 'Odisha'; city = 'Odisha Circle'; break;
      case '78': state = 'Assam'; city = 'Assam Circle'; break;
      case '79': state = 'North East'; city = 'North Eastern Circle'; break;
      case '80': case '81': case '82': case '83': case '84': case '85':
        state = 'Bihar / Jharkhand'; city = 'Eastern Circle'; break;
      default:
        if (prefix1 === '9') {
          state = 'Field Postal Zone';
          city = 'Indian Postal Service';
        } else {
          state = 'India';
          city = `Zone ${prefix1}`;
        }
        break;
    }

    return { city, state };
  }

  /**
   * Validate Indian Postal PIN Code
   * Rule: Exactly 6 digits, first digit 1-9 (no leading zero, no letters, no symbols, non-empty)
   */
  function validatePincode(pincode) {
    if (!pincode || typeof pincode !== 'string') {
      return { valid: false, error: 'Please enter a 6-digit PIN code.' };
    }
    const clean = pincode.trim();
    if (clean.length === 0) {
      return { valid: false, error: 'PIN code cannot be empty.' };
    }
    if (!/^\d+$/.test(clean)) {
      return { valid: false, error: 'PIN code must contain digits only.' };
    }
    if (clean.length !== 6) {
      return { valid: false, error: `PIN code must be exactly 6 digits (currently ${clean.length}).` };
    }
    if (clean.startsWith('0')) {
      return { valid: false, error: 'Invalid PIN code. Indian PIN codes cannot start with 0.' };
    }
    return { valid: true, pincode: clean };
  }

  /**
   * Calculate realistic estimated delivery date
   * e.g. "Friday, 18 Sep"
   */
  function formatEstimatedDeliveryDate(minDays = 2, maxDays = 4) {
    const today = new Date();
    
    // Add business days (skip Sunday)
    function addDays(d, count) {
      const result = new Date(d);
      let added = 0;
      while (added < count) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 0) {
          added++;
        }
      }
      return result;
    }

    const minDate = addDays(today, minDays);
    const maxDate = addDays(today, maxDays);

    const dayName = maxDate.toLocaleDateString('en-IN', { weekday: 'long' });
    const dayNum = maxDate.getDate();
    const monthName = maxDate.toLocaleDateString('en-IN', { month: 'short' });

    return {
      formatted: `${dayName}, ${dayNum} ${monthName}`,
      rangeFormatted: `${minDate.getDate()} ${minDate.toLocaleDateString('en-IN', { month: 'short' })} – ${dayNum} ${monthName}`,
      minDate,
      maxDate
    };
  }

  /**
   * Check delivery availability:
   * For any valid 6-digit Indian PIN code format, delivery is ALWAYS AVAILABLE with FREE DELIVERY.
   * No restricted database or table required.
   */
  async function checkServiceability(pincode) {
    const val = validatePincode(pincode);
    if (!val.valid) {
      return {
        serviceable: false,
        invalidInput: true,
        error: val.error
      };
    }

    const pin = val.pincode;

    // Simulate a smooth check animation (250ms)
    await new Promise(resolve => setTimeout(resolve, 250));

    // Resolve location (City, State)
    const loc = resolvePostalRegion(pin);

    // Compute dynamic ETA
    const minDays = 2;
    const maxDays = 4;
    const eta = formatEstimatedDeliveryDate(minDays, maxDays);

    const result = {
      serviceable: true,
      pincode: pin,
      city: loc.city,
      state: loc.state,
      minDays,
      maxDays,
      estimatedDate: eta.formatted,
      estimatedRange: eta.rangeFormatted,
      courier: 'Express Delivery Partner',
      codAvailable: true,
      openBoxAvailable: true,
      isFreeDelivery: true,
      checkedAt: Date.now()
    };

    savePincode(result);
    return result;
  }

  /**
   * Session persistence
   */
  function savePincode(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.dispatchEvent(new CustomEvent('velora:pincode-checked', { detail: data }));
    } catch (e) {
      console.warn('Unable to persist pincode to localStorage:', e);
    }
  }

  function getSavedPincode() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.pincode && parsed.serviceable) {
        return parsed;
      }
    } catch (e) {}
    return null;
  }

  function clearSavedPincode() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('velora:pincode-cleared'));
    } catch (e) {}
  }

  // Export globally
  window.VeloraPincodeEngine = {
    validate: validatePincode,
    check: checkServiceability,
    getSaved: getSavedPincode,
    save: savePincode,
    clear: clearSavedPincode,
    formatEta: formatEstimatedDeliveryDate,
    resolveRegion: resolvePostalRegion,
    BUILTIN_PINCODES: KNOWN_PINCODES
  };

  // Deprecated shorthand alias
  window.PincodeEngine = window.VeloraPincodeEngine;
})();
