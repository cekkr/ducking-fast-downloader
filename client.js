import dgram from 'dgram';
import fs from 'fs';

import { Settings, Status } from './settings';

const PORT = Settings.defaultPort;
const HOST = '127.0.0.1';
//const client = dgram.createSocket('udp4');
const fileName = 'example.txt'; // Change to the requested file name
const outputFile = 'received_file.txt'; // Change to the desired output file name

export class Client {
    constructor(address, opts = {}) {
        this.address = address

        this.offset = opts.offset || 0

        this.initUdp()
    }

    initUdp() {
        this.client = dgram.createSocket('udp4')

        let waitInfo = true
        this.client.on('message', (msg, rinfo) => {

            if (waitInfo) {
                let info = msg.readUInt16LE(0, 2);

                switch (info) {
                    case Status.CHUCK_OFFSET:
                        const bufferOffset = Buffer.alloc(4);
                        bufferOffset.writeUInt16LE(this.offset, 0);
                        this.send(bufferOffset)
                        break;
                }
            }
            else {
                if (msg.toString() === 'EOF') {
                    console.log('File transfer complete.');
                    writeStream.end();
                    this.close();
                } else {
                    console.log(`Received chunk from ${rinfo.address}:${rinfo.port}`);
                    writeStream.write(msg);
                }
            }
        });
    }

    close() {
        this.client.close()
    }

    send(msg) {
        this.client.send(msg, this.address, HOST, (error) => {
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
        this.send(msg)
    }
}