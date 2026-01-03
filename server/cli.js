#!/usr/bin/env node

const path = require('path');

const args = process.argv.slice(2);

if (args.includes('--register')) {
    require('./register-protocol');
} else {
    require('./index.js');
}
