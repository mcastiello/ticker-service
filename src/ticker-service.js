/*
 * Copyright (c) 2019
 * Author: Marco Castiello
 * E-mail: marco.castiello@gmail.com
 * Project: Ticker.js
 */

/**
 * Reference to the original 'setTimeout' function.
 * @type {Function}
 * @private
 */
const originalSetTimeout = self.setTimeout;

/**
 * Reference to the original 'clearTimeout' function.
 * @type {Function}
 * @private
 */
const originalClearTimeout = self.clearTimeout;

/**
 * Reference to the original 'setInterval' function.
 * @type {Function}
 * @private
 */
const originalSetInterval = self.setInterval;

/**
 * Reference to the original 'clearInterval' function.
 * @type {Function}
 * @private
 */
const originalClearInterval = self.clearInterval;

/**
 * Reference to the original 'requestAnimationFrame' function.
 * @type {Function}
 * @private
 */
const originalRequestAnimationFrame = self.requestAnimationFrame;

/**
 * Reference to the original 'cancelAnimationFrame' function.
 * @type {Function}
 * @private
 */
const originalCancelAnimationFrame = self.cancelAnimationFrame;

/**
 * Current index generated for a ticker method.
 * @type {Number}
 * @private
 */
let currentIndex = 10000;

/**
 * Current running time of the ticker since it was last started.
 * @type {Number}
 * @private
 */
let currentTime = 0;

/**
 * Delta time since the last tick.
 * @type {Number}
 * @private
 */
let delta = 0;

/**
 * Flag used to toggle the scope functions with the ticker ones.
 * @type {Boolean}
 * @private
 */
let useScopeFunctions = true;

/**
 * Running status of the ticker.
 * @type {Boolean}
 * @private
 */
let running = false;

/**
 * List of the latest frames registered.
 * @type {Array}
 * @private
 */
const frameRateHistory = [];

/**
 * List of all the ticker callbacks.
 * @type {Object}
 * @private
 */
const tickerCallbacks = {};

/**
 * Get the current timestamp.
 * @returns {Number}
 */
const getTime = () => {
    if (self.performance) {
        return performance.now();
    } else {
        return Date.now();
    }
};

/**
 * Clear one of the ticker callbacks.
 * @param {Number} index
 * @private
 */
const clearTickerCallback = index => {
    delete tickerCallbacks[index];
};

/**
 * Register a ticker callback.
 * @param {Function} callback
 * @param {Array} params
 * @param {Number} repeats
 * @param {Number} delay
 * @returns {Number}
 * @private
 */
const createTickerCallback = (callback, params, repeats, delay) => {
    if (typeof delay !== "number" || delay <= 0) {
        throw new Error("Delay must be a positive number.");
    }
    if (typeof repeats !== "number" || repeats <= 0) {
        throw new Error("A callback must be executed at least once.");
    }

    const index = currentIndex++;

    tickerCallbacks[index] = {
        "callback": callback,
        "params": params,
        "repeats": repeats,
        "delay": delay,
        "count": 0,
        "executionTime": 0,
        "totalTime": currentTime - getTime()
    };

    return index;
};

/**
 * Execute all the callbacks that have requested to be run at the current frame.
 * @param {Number} delta
 * @private
 */
const tick = delta => {
    const tickers = Object.keys(tickerCallbacks);
    let i, ii;

    for (i=0, ii=tickers.length; i<ii; i++) {
        const tickerId = Number(tickers[i]);
        const ticker = tickerCallbacks[tickerId];

        ticker.totalTime += delta;

        const tickerTime = ticker.totalTime - ticker.executionTime;

        if (tickerTime >= ticker.delay) {
            ticker.callback(...ticker.params, tickerTime, ticker.count);

            ticker.count++;
            ticker.executionTime = ticker.totalTime;

            if (ticker.count >= ticker.repeats) {
                clearTickerCallback(tickerId);
            }
        }
    }
};

/**
 * Create the main animation loop.
 * @private
 */
const playAnimationFrame = () => {
    originalRequestAnimationFrame(() => {
        if (running) {
            const time = getTime();
            delta = currentTime ? time - currentTime : 0;

            if (delta) {
                tick(delta);
            }
            currentTime = time;

            storeFrameRateHistory();

            playAnimationFrame();
        }
    });
};

/**
 * Store a frame into the history.
 * @private
 */
const storeFrameRateHistory = () => {
    if (delta > 0) {
        const frameRate = Math.min(1000 / delta, ticker.maxFrameRate);

        frameRateHistory.unshift(frameRate);

        if (frameRateHistory.length > 120) {
            frameRateHistory.length = 120;
        }
    }
};

/**
 * Define a service used to keep all the timing functions in sync by replacing the
 * internal JavaScript timer with one based on a frame animation loop.
 * All the timing functions will be overridden with the service once and some other
 * will be added to make animator lives easier.
 * @class
 */
class TickerService {

    constructor() {
        // Force the service to replace the JavaScript timing functions with the service ones.
        this.useScopeFunctions = false;

        // Export new timing functions along side the usual ones.
        self.setAnimationLoop = (...params) => this.setAnimationLoop(...params);
        self.clearAnimationLoop = (index) => this.clearAnimationLoop(index);
        self.setCounter = (...params) => this.setCounter(...params);
        self.clearCounter = (index) => this.clearCounter(index);
        self.sleep = (time) => this.sleep(time);
        self.frame = () => this.frame();

        // Start the service.
        this.start();
    }

    /**
     * Get the current application frame rate.
     * @returns {Number}
     */
    get frameRate() {
        return delta ? Math.min(1000/delta, this.maxFrameRate) : this.maxFrameRate;
    }

    /**
     * Get the maximum frame rate supported by the browser.
     * @returns {Number}
     */
    get maxFrameRate() {
        return delta ? Math.round((1000/delta)/30)*30 : 60;
    }

    /**
     * Get the average frame rate recorded during the last couple of seconds.
     * @returns {Number}
     */
    get averageFrameRate() {
        return frameRateHistory.length ?
            frameRateHistory.reduce((value, total) => value + total) / frameRateHistory.length :
            this.frameRate;
    }

    /**
     * The score is a number that can be used to assess the device performance.
     * It is a value between 0 to 100, if the value goes below a certain threshold
     * it means that the device is struggling executing the animation loop and some
     * action should be taken to ease the load from the CPU/GPU.
     * @returns {Number}
     */
    get score() {
        return Math.round(this.averageFrameRate/this.maxFrameRate*100);
    }

    /**
     * Check if the service is running.
     * @returns {Boolean}
     */
    get isRunning() {
        return running;
    }

    /**
     * Check if the service is using the scope timing function.
     * @returns {Boolean}
     */
    get useScopeFunctions() {
        return useScopeFunctions;
    }

    /**
     * Toggle the timing function from the default JavaScript once to the service once and vice-versa.
     * @param {Boolean} value
     */
    set useScopeFunctions(value) {
        value = Boolean(value);

        if (value !== useScopeFunctions)
        {
            self.setTimeout = value ? originalSetTimeout : (...params) => this.setTimeout(...params);
            self.clearTimeout = value ? originalClearTimeout : (index) => this.clearTimeout(index);
            self.setInterval = value ? originalSetInterval : (...params) => this.setInterval(...params);
            self.clearInterval = value ? originalClearInterval : (index) => this.clearInterval(index);
            self.requestAnimationFrame = value ? originalRequestAnimationFrame : (...params) => this.requestAnimationFrame(...params);
            self.cancelAnimationFrame = value ? originalCancelAnimationFrame : (index) => this.cancelAnimationFrame(index);

            useScopeFunctions = value;
        }
    }

    /**
     * Register a callback that will be executed after a specific amount of time.
     * @param {Function} callback
     * @param {Number} time
     * @param {Array} params
     * @returns {Number}
     */
    setTimeout(callback, time, ...params) {
        time = time || 1;
        return createTickerCallback(callback, params, 1, time);
    }

    /**
     * Clear a registered timeout.
     * @param {Number} index
     */
    clearTimeout(index) {
        clearTickerCallback(index);
    }

    /**
     * Register a callback that will be executed at regular intervals.
     * @param {Function} callback
     * @param {Number} time
     * @param {Array} params
     * @returns {Number}
     */
    setInterval(callback, time, ...params) {
        return createTickerCallback(callback, params, Infinity, time);
    }

    /**
     * Clear a registered interval.
     * @param {Number} index
     */
    clearInterval(index) {
        clearTickerCallback(index);
    }

    /**
     * Register a callback that will be executed for a specific amount of times over regular intervals.
     * @param {Function} callback
     * @param {Number} time
     * @param {Number} repeats
     * @param {Array} params
     * @returns {Number}
     */
    setCounter(callback, time, repeats, ...params) {
        return createTickerCallback(callback, params, repeats, time);
    }

    /**
     * Clear a registered counter.
     * @param {Number} index
     */
    clearCounter(index) {
        clearTickerCallback(index);
    }

    /**
     * Execute a callback on the next available frame.
     * @param {Function} callback
     * @returns {Number}
     */
    requestAnimationFrame(callback) {
        return createTickerCallback(callback, [], 1, 1);
    }

    /**
     * Cancel a request to execute a callback on the next available frame.
     * @param {Number} index
     */
    cancelAnimationFrame(index) {
        clearTickerCallback(index);
    }

    /**
     * Create an animation loop where the callback will be executed at every frame.
     * It is possible to specify a frame rate different from the browser one.
     * @param {Function} callback
     * @param {Number} frameRate
     * @returns {Number}
     */
    setAnimationLoop(callback, frameRate) {
        return createTickerCallback(callback, [], Infinity, frameRate ? 1000/frameRate : 1);
    }

    /**
     * Clear a registered animation loop.
     * @param {Number} index
     */
    clearAnimationLoop(index) {
        clearTickerCallback(index);
    }

    /**
     * Return a promise that will be automatically resolved after a certain amount of time.
     * @param {Number} time
     * @returns {Promise}
     */
    sleep(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    /**
     * Return a promise that will be automatically resolved on the next available frame.
     * @returns {Promise}
     */
    frame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

    /**
     * Start the service.
     * @returns {TickerService}
     */
    start() {
        if (!running) {
            running = true;
            currentTime = getTime();
            playAnimationFrame(this);
        }

        return this;
    }

    /**
     * Stop the service.
     * @returns {TickerService}
     */
    stop() {
        running = false;
        return this;
    }
}

// Create unique instance of the service.
const ticker = new TickerService();

export default ticker;
