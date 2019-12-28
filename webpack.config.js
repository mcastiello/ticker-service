/*
 * Copyright (c) 2019
 * Author: Marco Castiello
 * E-mail: marco.castiello@gmail.com
 * Project: Ticker.js
 */

const path = require('path');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'ticker.js',
        path: path.resolve(__dirname, 'dist'),
    },
};