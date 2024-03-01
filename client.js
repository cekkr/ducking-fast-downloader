import dgram from 'dgram';
import fs from 'fs';

import * as Settings from './settings';
import * as DataStructure from './dataStructure.js'

const PORT = Settings.Settings.defaultPort;
const HOST = '127.0.0.1';
//const client = dgram.createSocket('udp4');
const fileName = 'example.txt'; // Change to the requested file name
const outputFile = 'received_file.txt'; // Change to the desired output file name

export class Client {
    constructor(address) {
        this.address = address

        this.offset = 0

        this.sessionNum = 0

        this.initUdp()
    }

    initUdp() {
        this.client = dgram.createSocket('udp4')

        this.status = DataStructure.CLIENT_STATUS.WAIT_SESSION
        this.client.on('message', (data, rinfo) => {
            let msg = null
            switch (this.status) {
                case DataStructure.CLIENT_STATUS.WAIT_SESSION:
                    msg = DataStructure.readSchema(DataStructure.SCHEMA_RESPONSE_INFO, data)
                    let msgSession = DataStructure.readSchema(DataStructure.SCHEMA_RESPONSE_INFO_SESSION, msg.data)
                    this.sessionNum = msgSession.session

                    this.waitSessionStarted()
                    this.waitSessionStarted = null

                    this.requestFile()
                    break;

                case DataStructure.CLIENT_STATUS.WAIT_CHUNKS:
                    msg = DataStructure.readSchema(DataStructure.SCHEMA_RESPONSE_CHUNK, data)

                    if (msg.chunkNum == Settings.MAX_VERIFIED_CHUCKS) {
                        // ChucksBase size
                        let msgSize = DataStructure.readSchema(DataStructure.SCHEMA_RESPONSE_INFO_CHUCKSBASE, msg.data)
                        this.chucksBaseSize = msgSize.chucksBaseSize
                    }
                    else {
                        this.chucksBase[msg.chunkNum] = msg.data
                        this.chucksBaseCount++
                    }

                    break;
            }
        });
    }

    createChucksBase() {
        this.chucksBase = {}
        this.chucksBaseCount = 0
        this.chucksBaseSize = -1
    }

    close() {
        this.client.close()
    }

    send(msg) {
        msg = DataStructure.writeSchema(DataStructure.SCHEMA, { session, data: msg })

        this.client.send(msg, this.address, HOST, (error) => {
            if (error) {
                console.error('Error sending request:', error);
                this.client.close();
            } else {
                //console.log(`Requested file: ${fileName}`);
            }
        });
    }

    startSession() {
        return new Promise((res) => {
            this.waitSessionStarted = res
            this.send(Buffer.alloc(0)) // send empty message
        })
    }

    requestFile(file, chuckOffset = 0) {
        let data = DataStructure.writeSchema(DataStructure.SCHEMA_REQUEST_FILE, { chuckOffset, path: file })
        data = DataStructure.writeSchema(DataStructure.SCHEMA_REQUEST, { type: DataStructure.REQUEST_TYPE.REQUEST_FILE, data })
        this.send(data)

        this.status = DataStructure.CLIENT_STATUS.WAIT_CHUNKS
        this.createChucksBase()
    }
}