import { Client } from './client.js'

async function main() {
    let client = new Client("127.0.0.1")

    await client.startSession()
    console.log("session started")

    client.requestFile("big.dmg")
}

main()