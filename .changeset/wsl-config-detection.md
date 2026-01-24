add wsl path detection

when server runs on windows, it now checks wsl distributions and adds wsl home paths to config candidates. this fixes issue where configs stored in wsl filesystems weren't being detected.
