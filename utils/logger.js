const { json } = require('express');
const fs = require('fs');

function logger(input, meta = '{"call": "default"}') {
    const parsedInput = JSON.stringify(input)
    const output = `${parsedInput} - ${meta}`
    const filePath = './log.txt';
    fs.appendFileSync(filePath, output + '\n');
}

module.exports = {
    logger
}