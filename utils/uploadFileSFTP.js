const SFTPClient = require('ssh2-sftp-client')
const path = require('path')
require('dotenv').config()


function uploadFileSFTP(localFileName, localPath, remotePath) {
    const sftp = new SFTPClient()
    
    sftp.connect({
        host: process.env.SFTP_HOST,
        port: 22,
        username: process.env.SFTP_USERNAME,
        password: process.env.SFTP_PASSWORD
    })
    .then(() => {
        return sftp.put(`${localPath}${localFileName}`, `${remotePath}${localFileName}`)
    })
    .then(() => {
        sftp.end()
    })
    .catch(error => {
        console.error(error);
    })
}

module.exports = {
    uploadFileSFTP
}