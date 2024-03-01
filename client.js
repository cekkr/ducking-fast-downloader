import dgram from 'dgram';
import fs from 'fs';

import Settings from './settings';

const PORT = Settings.defaultPort;
const HOST = '127.0.0.1';
//const client = dgram.createSocket('udp4');
const fileName = 'example.txt'; // Change to the requested file name
const outputFile = 'received_file.txt'; // Change to the desired output file name

export class Client {
    constructor(address) {
        this.address = address
        this.initUdp()
    }

    initUdp() {
        this.client = dgram.createSocket('udp4')

        this.client.on('message', (msg, rinfo) => {
            if (msg.toString() === 'EOF') {
                console.log('File transfer complete.');
                writeStream.end();
                this.close();
            } else {
                console.log(`Received chunk from ${rinfo.address}:${rinfo.port}`);
                writeStream.write(msg);
            }
        });
    }

    close() {
        this.client.close()
    }

    send(msg) {
        this.client.send(msg, PORT, HOST, (error) => {
            if (error) {
                console.error('Error sending request:', error);
                this.client.close();
            } else {
                //console.log(`Requested file: ${fileName}`);
            }
        });
    }

    requestFile(file) {
        const bufferOp = Buffer.alloc(1);
        bufferOp.writeUInt8LE(0, 0);
        const msg = Buffer.concat([bufferOp, Buffer.from(file, 'utf-8')]);
    }
}