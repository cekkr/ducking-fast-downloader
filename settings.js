export const Settings = {
    defaultPort: 41294
}

export const Status = {
    OK: 1,
    ERR: 2,
    CHUCK_OFFSET: 3
}

export const VERIFIED_CHUCKS = Math.pow(2, 9) // Maximumum allowed: 15
export const MAX_VERIFIED_CHUCKS = Math.pow(2, 16) - 1
export const CHUNK_SIZE = 1024; // Adjust based on your network environment

export function now() {
    return (new Date().getTime()) / 1000
}