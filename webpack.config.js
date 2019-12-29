/*
 * Copyright (c) 2019
 * Author: Marco Castiello
 * E-mail: marco.castiello@gmail.com
 * Project: Ticker.js
 */

const path = require('path');

module.exports = {
    entry: './src/ticker-service.js',
    output: {
        filename: 'ticker-service.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.m?js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        plugins: [
                            ['@babel/proposal-class-properties', {loose: true}],
                            ['@babel/proposal-private-methods', {loose: true}]
                        ],
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    stats: {
        colors: true
    },
    devtool: 'source-map'
};