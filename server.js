import dgram from 'dgram'
import fs from 'fs';
import { pipeline } from 'stream';
import { createReadStream } from 'fs';

import * as Settings from './settings.js';
import * as DataStructure from './dataStructure.js'

const PORT = Settings.Settings.defaultPort;
const HOST = '0.0.0.0';
//const server = dgram.createSocket('udp4');

class FileSender {
    constructor(session) {
        this.session = session

        // Start read stream
        let filePath = session.server.basePath + '/' + session.reqPath
        let readStream = this.readStream = createReadStream(filePath, { highWaterMark: Settings.CHUNK_SIZE, start: (session.offset * Settings.CHUNK_SIZE) });

        this.chunkNum = 0

        this.statusSent = false
        this.EOF = false

        readStream.on('readable', () => { this.processChunk(); });

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

        // Begin to create the chuck base
        this.createChucksBase()
    }

    sendInfo(info, data = null) {
        if (!data)
            data = Buffer.alloc(0)

        info = DataStructure.writeSchema(DataStructure.SCHEMA_RESPONSE_INFO, { info, data })
        this.session.server.send(this.session, info)
    }


    createChucksBase() {
        this.chucksBase = {}
        this.chucksBaseNum = 0

        this.streamPause = false
        this.processChunk()
    }

    endSession() {
        this.sendEnfOfFile()
        delete this.session.server.sessions[this.session.num]
        console.log("End of session ", this.session.num)
    }

    async requestChucks(chucks) {
        if (chucks.length == 0) {
            if (this.EOF) {
                this.endSession()
            }
            else {
                //console.log("next chucksbase")
                this.createChucksBase()
            }
        }
        else {
            for (let n of chucks) {
                await this.sendChuckNum(n)
            }
        }
    }

    async sendChuckNum(n) {
        //console.log("sending chuck num ", n)
        let data = DataStructure.writeSchema(DataStructure.SCHEMA_RESPONSE_CHUNK, { chunkNum: n, chunk: this.chucksBase[n] })
        this.session.server.send(this.session, data) // remove await
    }

    async sendCurrentChucksBaseSize() {
        let data = DataStructure.writeSchema(DataStructure.SCHEMA_RESPONSE_INFO_CHUCKSBASE, { chucksBaseSize: this.chucksBaseNum })
        data = DataStructure.writeSchema(DataStructure.SCHEMA_RESPONSE_INFO, { info: DataStructure.RESPONSE_INFO.CHUCKSBASE_SIZE, data })
        data = DataStructure.writeSchema(DataStructure.SCHEMA_RESPONSE_CHUNK, { chunkNum: Settings.MAX_VERIFIED_CHUCKS, chunk: data })
        await this.session.server.send(this.session, data)
    }

    async chucksBaseReady() {
        //console.log("processing chucksbase")

        // Inform about chucks base size
        await this.sendCurrentChucksBaseSize()

        for (let n = 0; n < this.chucksBaseNum; n++) {
            await this.sendChuckNum(n)
        }
    }

    sendEnfOfFile() {
        let data = DataStructure.writeSchema(DataStructure.SCHEMA_RESPONSE_INFO, { info: DataStructure.RESPONSE_INFO.END_OF_FILE, data: Buffer.alloc(0) })
        data = DataStructure.writeSchema(DataStructure.SCHEMA_RESPONSE_CHUNK, { chunkNum: Settings.MAX_VERIFIED_CHUCKS, chunk: data })
        this.session.server.send(this.session, data)
    }

    // call it to resume the stream
    processChunk() {
        if (this.streamPause)
            return

        let chunk;
        if (null === (chunk = this.readStream.read())) {
            return
        }

        //console.log('Read a chunk of size:', chunk.length);

        this.chucksBase[this.chucksBaseNum] = chunk
        this.chucksBaseNum++
        this.chunkNum++

        if (this.chucksBaseNum >= Settings.VERIFIED_CHUCKS) {
            this.readStream.pause();
            this.streamPause = true
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

        this.ttlInterval = setInterval(() => {
            let now = Settings.now()
            for (let s in this.sessions) {
                let session = this.sessions[s]
                if (session) {
                    let diff = now - session.lastReply
                    if (diff > 30) {
                        session.fileSender.endSession()
                    }
                }
            }
        }, 1000)

        this.server.on('message', (data, rinfo) => {
            let msg = DataStructure.readSchema(DataStructure.SCHEMA, data)

            let session = msg.session

            if (session == 0) {
                console.log(`Received new session request from ${rinfo.address}:${rinfo.port}`);

                let s = this.newSession()
                let session = this.sessions[s] = { num: s, lastReply: Settings.now() }
                session.server = this
                session.rinfo = rinfo
                session.status = DataStructure.SESSION_STATUS.WAIT_FOR_REQUEST

                let infoSession = DataStructure.writeSchema(DataStructure.SCHEMA_RESPONSE_INFO_SESSION, { session: s })
                let info = { info: DataStructure.RESPONSE_INFO.SET_SESSION, data: infoSession }
                info = DataStructure.writeSchema(DataStructure.SCHEMA_RESPONSE_INFO, info)

                this.send(session, info)
            }
            else {
                let session = this.sessions[msg.session]

                session.lastReply = Settings.now()

                if (!session) {
                    console.error("Not existing session:", s)
                    return;
                }

                msg = DataStructure.readSchema(DataStructure.SCHEMA_REQUEST, msg.data)
                switch (session.status) {
                    case DataStructure.SESSION_STATUS.WAIT_FOR_REQUEST:
                        switch (msg.type) {
                            case DataStructure.REQUEST_TYPE.REQUEST_FILE:
                                let reqFile = DataStructure.readSchema(DataStructure.SCHEMA_REQUEST_FILE, msg.data)
                                session.offset = reqFile.chuckOffset
                                session.reqPath = reqFile.path
                                session.fileSender = new FileSender(session)

                                session.status = DataStructure.SESSION_STATUS.IN_TRANSFER
                                break;
                        }

                        break;

                    case DataStructure.SESSION_STATUS.IN_TRANSFER:
                        switch (msg.type) {
                            case DataStructure.REQUEST_TYPE.REQUEST_CHUCKSBASE_SIZE:
                                session.fileSender.sendCurrentChucksBaseSize()
                                break;

                            case DataStructure.REQUEST_TYPE.REQUEST_CHUCKS:
                                let reqChucks = DataStructure.readSchema(DataStructure.SCHEMA_REQUEST_CHUCKS, msg.data)

                                let chucks = []
                                for (let c = 0; c < reqChucks.numChucks; c++) {
                                    let val = reqChucks.data.readUInt16LE((c * 2), 2);
                                    chucks.push(val)
                                }

                                session.fileSender.requestChucks(chucks)
                                break;
                        }

                        break;
                }
            }

        });

        this.server.on('listening', () => {
            const address = this.server.address();
            console.log(`Server listening on ${address.address}:${address.port}`);
        });

        this.server.bind(PORT, HOST);
    }

    newSession() {
        for (let s = 1; s < 256; s++) {
            if (!this.sessions[s])
                return s
        }
    }

    send(session, msg) {
        return new Promise((res, err) => {
            // for the moment is not necessary specify client session every time
            // msg = DataStructure.writeSchema(DataStructure.SCHEMA, { session: session.num, data: msg })

            this.server.send(msg, 0, msg.length, session.rinfo.port, session.rinfo.address, (error) => {
                if (error) {
                    console.error('Error sending packet:', error);
                    this.server.close();
                    err()
                }
                else {
                    res()
                }
            });
        })
    }
}