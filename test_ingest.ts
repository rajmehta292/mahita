import { ingestionService } from './app/services/market-data/ingestion'

async function main() {
    console.log("Starting ingestion sweep...")
    try {
        const result = await ingestionService.runSweep({ symbols: ['AAPL'] }, (payload, level) => {
            console.log(`[${level}]`, payload)
        })
        console.log("Sweep complete:", result)
    } catch (e) {
        console.error("Fatal:", e)
    }
}

main()
