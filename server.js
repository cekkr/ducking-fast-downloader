import dgram from 'dgram'
import fs from 'fs';
import { pipeline } from 'stream';
import { createReadStream } from 'fs';

const PORT = 41234;
const HOST = '0.0.0.0';
const server = dgram.createSocket('udp4');
const CHUNK_SIZE = 1024; // Adjust based on your network environment

server.on('message', (msg, rinfo) => {
  console.log(`Received request for file: ${msg} from ${rinfo.address}:${rinfo.port}`);

  const filePath = msg.toString();
  const readStream = createReadStream(filePath, { highWaterMark: CHUNK_SIZE });

  readStream.on('data', (chunk) => {
    server.send(chunk, 0, chunk.length, rinfo.port, rinfo.address, (error) => {
      if (error) {
        console.error('Error sending chunk:', error);
        server.close();
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

server.on('listening', () => {
  const address = server.address();
  console.log(`Server listening on ${address.address}:${address.port}`);
});

server.bind(PORT, HOST);