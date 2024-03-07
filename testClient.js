import { Client } from './client.js'

async function main() {
    let client = new Client("eswayer.com")

    await client.startSession()
    console.log("session started")

    client.requestFile("europe-latest.osrm.cell_metrics")
}

main()