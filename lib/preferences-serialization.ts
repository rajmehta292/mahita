export function parseStoredStringArray(value?: string | null): string[] {
    if (!value) {
        return []
    }

    try {
        const parsed = JSON.parse(value)
        if (!Array.isArray(parsed)) {
            return []
        }

        return parsed
            .map((entry) => String(entry).trim())
            .filter(Boolean)
    } catch {
        return []
    }
}

export function serializeStringArray(values: string[]): string {
    return JSON.stringify(
        Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    )
}
