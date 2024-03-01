import dgram from 'dgram';
import fs from 'fs';
import path from 'path';

import * as Settings from './settings.js';
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

        // time
        this.packetsTime = {}
        this.avgReceivedPackets = 0
        this.avgChuckSize = 0
    }

    addPacketsTime(size) {
        let now = Math.floor((new Date()).getTime / 1000)
        if (!this.packetsTime[now]) {
            let prev = this.packetsTime[now - 1]
            if (prev) {
                this.avgReceivedPackets = (this.avgReceivedPackets + prev) / 2
                delete this.packetsTime[now - 1]
            }

            this.packetsTime[now] = 0
        }

        this.packetsTime[now] += size
    }

    initUdp() {
        this.client = dgram.createSocket('udp4')

        this.status = DataStructure.CLIENT_STATUS.WAIT_SESSION
        this.client.on('message', (data, rinfo) => {
            console.log("received msg")
            this.addPacketsTime(data.length)

            let msg = null
            switch (this.status) {
                case DataStructure.CLIENT_STATUS.WAIT_SESSION:
                    msg = DataStructure.readSchema(DataStructure.SCHEMA_RESPONSE_INFO, data)
                    let msgSession = DataStructure.readSchema(DataStructure.SCHEMA_RESPONSE_INFO_SESSION, msg.data)
                    this.sessionNum = msgSession.session

                    console.log("Session number: ", this.sessionNum)

                    this.waitSessionStarted()
                    this.waitSessionStarted = null

                    break;

                case DataStructure.CLIENT_STATUS.WAIT_CHUNKS:
                    msg = DataStructure.readSchema(DataStructure.SCHEMA_RESPONSE_CHUNK, data)

                    if (msg.chunkNum == Settings.MAX_VERIFIED_CHUCKS) {
                        let msgInfo = DataStructure.readSchema(DataStructure.SCHEMA_RESPONSE_INFO, msg.chunk)

                        switch (msgInfo.info) {
                            case DataStructure.RESPONSE_INFO.CHUCKSBASE_SIZE:
                                // ChucksBase size
                                let msgSize = DataStructure.readSchema(DataStructure.SCHEMA_RESPONSE_INFO_CHUCKSBASE, msgInfo.data)
                                this.chucksBaseSize = msgSize.chucksBaseSize

                                if (this.chucksBaseCount > 0) {
                                    this.checkChucksBase()
                                }
                                break;

                            case DataStructure.RESPONSE_INFO.END_OF_FILE:

                                setTimeout(() => {
                                    this.writeStream.end()
                                }, 500)

                                break;
                        }
                    }
                    else {
                        this.chucksBase[msg.chunkNum] = msg.chunk
                        this.chucksBaseCount++

                        this.lastChuckTime = new Date().getTime()
                        this.avgChuckSize = (this.avgChuckSize + data.length) / 2

                        if (this.chucksBaseSize >= 0) {
                            if (this.checkChucksSizeTimeout) {
                                clearTimeout(this.checkChucksSizeTimeout)
                                this.checkChucksSizeTimeout = null
                            }

                            if (this.chucksBaseSize == this.chucksBaseCount) {
                                this.flushChucksBase()
                            }
                            else {
                                let diffTime = this.lastChuckTime - this.firstChuckTime
                                let chucksPerSecond = this.avgReceivedPackets / this.avgChuckSize
                                let forecastChucks = (diffTime / 1000) * chucksPerSecond

                                if ((forecastChucks * 2) > this.chucksBaseSize) {
                                    this.checkChucksBase()
                                }
                            }
                        }
                        else {
                            this.checkChucksSize()
                        }
                    }

                    break;
            }
        });
    }

    checkChucksSize() {
        if (this.checkChucksSizeTimeout || this.chucksBaseSize == this.chucksBaseCount)
            return;

        this.checkChucksSizeTimeout = setTimeout(() => {
            if (this.chucksBaseSize == this.chucksBaseCount)
                return;

            let data = DataStructure.writeSchema(DataStructure.SCHEMA_REQUEST, { type: DataStructure.REQUEST_TYPE.REQUEST_CHUCKSBASE_TYPE, data: Buffer.alloc(0) })
            this.send(data)
        }, 250)
    }

    createChucksBase() {
        this.chucksBase = {}
        this.chucksBaseCount = 0
        this.chucksBaseSize = -1

        this.firstChuckTime = new Date().getTime()
    }

    flushChucksBase() {
        for (let c in this.chucksBase) {
            let chuck = this.chucksBase[c]
            this.writeStream.write(chuck, (error) => {
                if (error) {
                    console.error('Error writing data to the file:', error);
                } else {
                    console.log('Data written successfully');
                }
            });
        }
    }

    checkChucksBase() {
        let chucksToRequest = []

        const FLUSH_AT = 512
        const flush = () => {
            let buffers = []
            for (let chuck of chucksToRequest) {
                let buffer = Buffer.alloc(2)
                buffer.writeUInt16LE(chuck, 0);
                buffers.push(buffer)
            }

            let data = Buffer.concat(buffers)
            data = DataStructure.writeSchema(DataStructure.SCHEMA_REQUEST_CHUCKS, { numChucks: buffers.length, data: data })
            this.send(data)

            chucksToRequest = []
        }

        for (let c = 0; c < this.chucksBaseSize; c++) {
            if (!this.chucksBase[c]) {
                chucksToRequest.push(c)

                if (chucksToRequest.length >= FLUSH_AT)
                    flush()
            }
        }

        if (chucksToRequest.length > 0)
            flush()
    }

    close() {
        this.client.close()
    }

    send(msg) {
        msg = DataStructure.writeSchema(DataStructure.SCHEMA, { session: this.sessionNum, data: msg })

        this.client.send(msg, PORT, this.address, (error) => {
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

        ////
        ////

        this.writeStream = fs.createWriteStream(process.cwd() + '/' + path.basename(file), {
            flags: 'w+', // Open file for reading and writing. The file is created if not existing.
            start: (chuckOffset * Settings.CHUNK_SIZE),
        });

        // Listen for the 'finish' event to know when writing is complete
        this.writeStream.on('finish', () => {
            console.log('Finished writing to the file.');
        });

        // Handle any errors that occur during the write process
        this.writeStream.on('error', (error) => {
            console.error('An error occurred:', error.message);
        });

        ////
        ////

        this.status = DataStructure.CLIENT_STATUS.WAIT_CHUNKS
        this.createChucksBase()
    }
}