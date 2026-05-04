const { v4: uuidv4 } = require('uuid');
console.log('UUID Test:', uuidv4());

const eduProvider = require('./src/providers/edu.provider');
console.log('Edu Provider loaded:', eduProvider.key);
