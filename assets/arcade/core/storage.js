// localStorage can be missing or throw (private windows, blocked storage).
// Every game still works without it; it just forgets between visits.
export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is optional.
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage is optional.
  }
}
