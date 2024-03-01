import dgram from 'dgram'
import fs from 'fs';
import { pipeline } from 'stream';
import { createReadStream } from 'fs';

import { Settings, Status } from './settings';
import * as DataStructure from './dataStructure.js'

const PORT = Settings.defaultPort;
const HOST = '0.0.0.0';
//const server = dgram.createSocket('udp4');
const CHUNK_SIZE = 1024; // Adjust based on your network environment

const VERIFIED_CHUCKS = Math.pow(10, 2) // 1024

class FileSender {
    constructor(session) {
        this.session = session

        // Begin to create the chuck base
        this.createChucksBase()

        // Start read stream
        let filePath = session.server.basePath + session.reqPath
        let readStream = this.readStream = createReadStream(filePath, { highWaterMark: CHUNK_SIZE, start: (session.offset * CHUNK_SIZE) });

        this.chunkNum = 0

        this.statusSent = false
        this.EOF = false

        readStream.on('readable', readStreamChunk);

        readStream.on('end', () => {
            this.EOF = true

            if (this.chucksBaseNum > 0)
                this.chucksBaseReady()

            console.log('Finished reading the file.');
        });

        readStream.on('error', (error) => {
            this.sendInfo(Status.ERR)
            console.error('An error occurred:', error.message);
        });

        //this.sendInfo(Status.CHUCK_OFFSET)        
    }

    sendInfo(info, data = null) {
        if (!data)
            data = Buffer.alloc(0)

        info = DataStructure.writeSchema(DataStructure.SCHEMA_RESPONSE_INFO, { info, data })

        this.session.server.send(this.session, info)
    }

    infoResponse(msg) {

    }

    createChucksBase() {
        this.chucksBase = {}
        this.chucksBaseNum = 0

        this.processChunk()
    }

    async chucksBaseReady() {

    }

    readStreamChunk() {
        this.processChunk();
    }

    // call it to resume the stream
    processChunk() {
        let chunk;
        while (null === (chunk = readStream.read())) {
            // loop
        }

        console.log('Read a chunk of size:', chunk.length);

        this.chucksBase[this.chunkNum] = chunk
        this.chunkNum++

        if (this.chunkNum >= CHUNK_SIZE) {
            this.readStream.pause();
            this.chucksBaseReady()
        }
        else {
            this.processChunk()
        }
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

        this.server.on('message', (data, rinfo) => {
            let msg = DataStructure.readSchema(DataStructure.SCHEMA, data)

            let session = msg.session

            if (session == 0) {
                console.log(`Received new session request from ${rinfo.address}:${rinfo.port}`);

                let s = this.newSession()
                let session = this.sessions[s] = { num: s }
                session.server = this
                session.rinfo = rinfo
                session.status = DataStructure.SESSION_STATUS.WAIT_FOR_REQUEST

                let infoSession = DataStructure.writeSchema(DataStructure.SCHEMA_RESPONSE_INFO_SESSION, { session: s })
                let info = { info: DataStructure.RESPONSE_INFO.SET_SESSION, data: infoSession }

                this.send(session, info)
            }
            else {
                let session = this.sessions[s]

                if (!session) {
                    console.error("Not existing session:", s)
                    return;
                }

                switch (session.status) {
                    case DataStructure.SESSION_STATUS.WAIT_FOR_REQUEST:
                        let msg = DataStructure.readSchema(DataStructure.SCHEMA_REQUEST, data)

                        switch (msg.type) {
                            case DataStructure.REQUEST_TYPE.REQUEST_FILE:
                                let reqFile = DataStructure.readSchema(DataStructure.SCHEMA_REQUEST_FILE, msg.data)
                                session.offset = reqFile.chunkOffset
                                session.reqPath = reqFile.path
                                session.fileSender = new FileSender(session)
                                break;
                        }

                        break;
                }
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
        return new Promise((res) => {
            // for the moment is not necessary specify client session every time
            // msg = DataStructure.writeSchema(DataStructure.SCHEMA, { session: session.num, data: msg })

            this.server.send(msg, 0, msg.length, session.rinfo.port, session.rinfo.address, (error) => {
                if (error) {
                    console.error('Error sending packet:', error);
                    this.server.close();
                }

                res()
            });
        })
    }
}