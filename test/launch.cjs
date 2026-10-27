'use strict';
const {app} = require('electron');
if (!process.env.SKILLFORGE_TEST_DATA) throw Error('Test data folder required.');
app.setPath('userData', process.env.SKILLFORGE_TEST_DATA);
require('../src/main.cjs');
