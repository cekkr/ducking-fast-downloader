import dgram from 'dgram'
const server = dgram.createSocket('udp4');

const PORT = 41234;
const HOST = '0.0.0.0';

server.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  server.close();
});

server.on('message', (msg, rinfo) => {
  console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
  
  // Send a reply to the client
  const reply = 'Hello from server';
  server.send(reply, rinfo.port, rinfo.address, (err) => {
    if (err) server.close();
    else console.log('Reply sent');
  });
});

server.on('listening', () => {
  const address = server.address();
  console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(PORT, HOST);
