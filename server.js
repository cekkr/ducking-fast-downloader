import dgram from 'dgram'
import fs from 'fs';
import { pipeline } from 'stream';
import { createReadStream } from 'fs';

import Settings from './settings';

const PORT = Settings.defaultPort;
const HOST = '0.0.0.0';
//const server = dgram.createSocket('udp4');
const CHUNK_SIZE = 1024; // Adjust based on your network environment

const VERIFIED_CHUCKS = Math.pow(10, 2) // 1024

const STATUS_OK = 1
const STATUS_ERR = 2
const STATUS_CHUCK_OFFSET = 2

class FileSender {
    constructor(session) {
        this.session = session

        let filePath = session.server.basePath + session.reqPath
        let readStream = this.readStream = createReadStream(filePath, { highWaterMark: CHUNK_SIZE });

        this.chunkNum = 0

        this.statusSent = false
        this.EOF = false

        readStream.on('readable', readStreamChunk);

        readStream.on('end', () => {
            this.EOF = true
            console.log('Finished reading the file.');
        });

        readStream.on('error', (error) => {
            this.sendInfo(STATUS_ERR)
            console.error('An error occurred:', error.message);
        });

        this.sendInfo(STATUS_CHUCK_OFFSET)
    }

    sendInfo(info) {
        const bufferInfo = Buffer.alloc(2);
        bufferInfo.writeUInt16LE(info, 0);

        this.session.server.send(this.session, bufferInfo)
    }

    infoResponse(msg) {

    }

    createChucksBase() {
        this.chucksBase = {}
        this.chucksBaseNum = 0
    }

    readStreamChunk() {
        this.processChunk();
    }

    // call it to resume the stream
    processChunk() {
        let chunk;
        while (null === (chunk = readStream.read())) {
            return; // Exit the loop and wait for the timeout before continuing
        }

        if (!this.statusSent) {
            this.sendInfo(STATUS_OK)
            this.statusSent = true
        }

        console.log('Received a chunk of size:', chunk.length);
        this.readStream.pause();

        this.lastChunk = chunk
        this.chunkNum++
    }

    sendChunk(chunk) {
        let chunkBaseNum = this.chucksBaseNum++
        const bufferChunkNum = Buffer.alloc(2);
        bufferChunkNum.writeUInt16LE(chunkBaseNum, 0);
        const msg = Buffer.concat([bufferChunkNum, chunk]);

        this.chucksBase[chunkBaseNum] = msg
        this.session.server.send(this.session, msg)
    }
}

export class Server {
    constructor(basePath) {
        this.basePath = basePath

        this.sessions = {}

        this.initUdp()
    }

    initUdp() {
        this.server = dgram.createSocket('udp4');

        this.server.on('message', (msg, rinfo) => {
            let session = msg.readUIntLE(0, 1);

            if (session == 0) {
                let path = msg.slice(1).toString('utf-8')
                console.log(`Received request for file: ${path} from ${rinfo.address}:${rinfo.port}`);

                let s = this.newSession()
                let session = this.sessions[s] = {}
                session.server = this
                session.rinfo = rinfo
                session.reqPath = path
                session.fileSender = new FileSender(session)
            }
            else {
                let session = this.sessions[s]
            }

        });

        this.server.on('listening', () => {
            const address = server.address();
            console.log(`Server listening on ${address.address}:${address.port}`);
        });

        this.server.bind(PORT, HOST);
    }

    newSession() {
        for (let s = 1; s < 256; s++) {
            if (!this.session[s])
                return s
        }
    }

    send(session, msg) {
        this.server.send(msg, 0, msg.length, session.rinfo.port, session.rinfo.address, (error) => {
            if (error) {
                console.error('Error sending packet:', error);
                this.server.close();
            }
        });
    }

    sendFile(filePath) {
        const readStream = createReadStream(filePath, { highWaterMark: CHUNK_SIZE });

        readStream.on('data', (chunk) => {
            this.server.send(chunk, 0, chunk.length, rinfo.port, rinfo.address, (error) => {
                if (error) {
                    console.error('Error sending chunk:', error);
                    this.server.close();
                }
            });
        });

        readStream.on('end', () => {
            console.log('File has been sent successfully.');
            // Signal the client that the file transfer is complete
            server.send('EOF', rinfo.port, rinfo.address);
        });

        readStream.on('error', (err) => {
            console.error('Stream error:', err);
        });
    }
}