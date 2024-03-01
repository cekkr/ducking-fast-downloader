
export const SCHEMA = ['session:UInt:8', 'data:Data']

export const SCHEMA_REQUEST = ['type:UInt:8', 'data:Data']
export const SCHEMA_REQUEST_FILE = ['chuckOffset:UInt:32', 'path:String']
export const SCHEMA_REQUEST_CHUCKS = ['numChucks:UInt:16', 'data:Data']

export const SCHEMA_RESPONSE_INFO = ['info:UInt:16', 'data:Data']
export const SCHEMA_RESPONSE_INFO_SESSION = ['session:UInt:8']
export const SCHEMA_RESPONSE_INFO_CHUCKSBASE = ['chucksBaseSize:UInt16']

export const SCHEMA_RESPONSE_CHUNK = ['chunkNum:UInt:16', 'chunk:Data']

export const RESPONSE_INFO = {
    SET_SESSION: 1,
    CHUCKSBASE_SIZE: 2,
    END_OF_FILE: 3
}

export const REQUEST_TYPE = {
    REQUEST_FILE: 1,
    REQUEST_CHUCKSBASE_TYPE: 2
}

export const CLIENT_STATUS = {
    WAIT_SESSION: 0,
    WAIT_CHUNKS: 1
}

export const SESSION_STATUS = {
    WAIT_FOR_REQUEST: 0
}

export function readSchema(schema, data) {
    let obj = {}

    for (let part of schema) {
        let parts = part.split(':')
        let name = parts[0]
        let type = parts[1]
        let size = parts[2]
        if (size) size = parseInt(size)

        switch (type) {
            case 'UInt':
                let bytes = size / 8
                let val = 0
                switch (bytes) {
                    case 1:
                        val = data.readUInt8LE(0, bytes);
                        break;
                    case 2:
                        val = data.readUInt16LE(0, bytes);
                        break;
                    case 4:
                        val = data.readUInt32LE(0, bytes);
                        break;
                }

                obj[name] = val

                data = data.slice(bytes)
                break;

            case 'Data':
                obj[name] = data
                break;

            case 'String':
                obj[name] = data.toString('utf-8')
                break;
        }
    }

    return obj
}

export function writeSchema(schema, obj) {
    let buffers = []

    for (let part of schema) {
        let parts = part.split(':')
        let name = parts[0]
        let type = parts[1]
        let size = parts[2]
        if (size) size = parseInt(size)

        let val = obj[name]

        let buffer = null
        switch (type) {
            case 'UInt':
                let bytes = size / 8
                buffer = Buffer.alloc(bytes);
                switch (bytes) {
                    case 1:
                        buffer.writeUInt8LE(val, 0);
                        break;
                    case 2:
                        buffer.writeUInt16LE(val, 0);
                        break;
                    case 4:
                        buffer.writeUInt32LE(val, 0);
                        break;
                }
                buffers.push(buffer)
                break;

            case 'Data':
                buffers.push(val)
                break;

            case 'String':
                buffer = Buffer.from(val, 'utf-8')
                buffers.push(buffer)
                break;
        }
    }

    return Buffer.concat(buffers)
}