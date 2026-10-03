import type { TripPlanRequest, TripPlanResponse } from '../types/trip';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : 'http://localhost:8000');

export async function planTrip(requestData: TripPlanRequest): Promise<TripPlanResponse> {
  const url = `${API_BASE_URL}/api/v1/trips/plan/`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(requestData),
  });

  if (!response.ok) {
    let errorMessage = `Server error (${response.status})`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) {
        errorMessage = errorJson.error;
      } else if (errorJson.details) {
        const details = Object.entries(errorJson.details)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
          .join('; ');
        errorMessage = `Validation error: ${details}`;
      }
    } catch {
      // response wasn't JSON
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
