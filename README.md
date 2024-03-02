# ducking fast downloader
A ducking fast downloader where you can download something (like using GIT LFS) on a server and then move it locally using an UDP connection with a sort of long-term acknowledge system without compromise performances.

## How to use it
Install it both on client and server as global package

```
$ npm install git+https://github.com/cekkr/ducking-fast-downloader.git --global
```

Go in the shell to the interested directory on the server and run:

```
$ ducking server
```

And on the client:

```
$ ducking myserver.com myfile.zip
```

This is an experimental file transfer protocol based on UDP connection. No one will use it, but it exists. Maybe is necessary to use an IP client-side, if the name server doesn't work.