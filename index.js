let args = [... process.argv]
args.splice(0, 2)

let first = args[0]
if(first == 'server'){

    let dir = args[1] || './'

    if(dir.startsWith('./')){
        dir = dir.substring(2)
    }

    if(dir[0] != '/')
        dir = process.cwd() + '/' + dir 
}
else {
    // client...
}