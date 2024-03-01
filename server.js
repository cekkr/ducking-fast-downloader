import dgram from 'dgram'
import fs from 'fs';
import { pipeline } from 'stream';
import { createReadStream } from 'fs';

import Settings from './settings';

const PORT = Settings.defaultPort;
const HOST = '0.0.0.0';
//const server = dgram.createSocket('udp4');
const CHUNK_SIZE = 1024; // Adjust based on your network environment

class FileSender {
    constructor(session) {
        this.session = session
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