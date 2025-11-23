const { v4: uuidv4 } = require('uuid');
console.log('UUID Test:', uuidv4());

const eduService = require('./src/services/eduService');
console.log('Edu Service loaded');
