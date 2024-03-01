import { Server } from './server.js'
import { Client } from './client.js'

let args = [...process.argv]
args.splice(0, 2)

let first = args[0]
if (first == 'server') {

    let dir = args[1] || './'

    if (dir.startsWith('./')) {
        dir = dir.substring(2)
    }

    if (dir[0] != '/')
        dir = process.cwd() + '/' + dir

    let server = new Server(dir)
}
else {
    // client...
    let client = new Client(args[0])
    client.requestFile(args[1])
}