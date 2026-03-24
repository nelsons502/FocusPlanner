const pad = (n) => String(n).padStart(2, '0')

// Format Date as local-time ISO string (no Z, no UTC conversion)
// so it round-trips cleanly through PGlite TIMESTAMP columns.
export function toLocalISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function toLocalDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
