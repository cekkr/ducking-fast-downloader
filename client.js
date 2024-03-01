import dgram from 'dgram'
const client = dgram.createSocket('udp4');

const PORT = 41234;
const HOST = '127.0.0.1';
const message = Buffer.from('Hello from client');

client.send(message, PORT, HOST, (err) => {
  if (err) throw err;
  console.log('UDP message sent');
});

client.on('message', (msg, rinfo) => {
  console.log(`server replied: ${msg}`, rinfo);
  client.close();
});
