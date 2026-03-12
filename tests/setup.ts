import '@testing-library/jest-dom/vitest'

const storage = new Map<string, string>()

const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
        storage.set(key, value)
    },
    removeItem: (key: string) => {
        storage.delete(key)
    },
    clear: () => {
        storage.clear()
    }
}

if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true
    })
}
