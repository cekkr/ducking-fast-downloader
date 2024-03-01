import dgram from 'dgram'
import fs from 'fs';
import { pipeline } from 'stream';
import { createReadStream } from 'fs';

import Settings from './settings';

const PORT = Settings.defaultPort;
const HOST = '0.0.0.0';
//const server = dgram.createSocket('udp4');
const CHUNK_SIZE = 1024; // Adjust based on your network environment

export class Server {
    constructor() {
        this.server = dgram.createSocket('udp4');

        this.server.on('message', (msg, rinfo) => {
            console.log(`Received request for file: ${msg} from ${rinfo.address}:${rinfo.port}`);

            const filePath = msg.toString();
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
        });

        this.server.on('listening', () => {
            const address = server.address();
            console.log(`Server listening on ${address.address}:${address.port}`);
        });

        this.server.bind(PORT, HOST);
    }
}