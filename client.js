import dgram from 'dgram';
import fs from 'fs';

const PORT = 41234;
const HOST = '127.0.0.1';
const client = dgram.createSocket('udp4');
const fileName = 'example.txt'; // Change to the requested file name
const outputFile = 'received_file.txt'; // Change to the desired output file name

client.send(fileName, PORT, HOST, (error) => {
  if (error) {
    console.error('Error sending request:', error);
    client.close();
  } else {
    console.log(`Requested file: ${fileName}`);
  }
});

const writeStream = fs.createWriteStream(outputFile);
client.on('message', (msg, rinfo) => {
  if (msg.toString() === 'EOF') {
    console.log('File transfer complete.');
    writeStream.end();
    client.close();
  } else {
    console.log(`Received chunk from ${rinfo.address}:${rinfo.port}`);
    writeStream.write(msg);
  }
});
