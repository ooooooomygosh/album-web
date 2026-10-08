// Time-of-day tint and window weather for the cabin scene.
export const WEATHERS = Object.freeze(['snow', 'clear', 'rain', 'starry']);

export function timeOfDay(hour) {
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}
export function normalizeWeather(value) { return WEATHERS.includes(value) ? value : 'snow'; }
