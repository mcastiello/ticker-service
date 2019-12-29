/*
 * Copyright (c) 2019
 * Author: Marco Castiello
 * E-mail: marco.castiello@gmail.com
 * Project: Ticker.js
 */

/**
 * Define a service used to keep all the timing functions in sync by replacing the
 * internal JavaScript timer with one based on a frame animation loop.
 * All the timing functions will be overridden with the service once and some other
 * will be added to make animator lives easier.
 * @class
 */
class TickerService {

    /**
     * Reference to the original 'setTimeout' function.
     * @type {Function}
     * @private
     */
    #originalSetTimeout = null;

    /**
     * Reference to the original 'clearTimeout' function.
     * @type {Function}
     * @private
     */
    #originalClearTimeout = null;

    /**
     * Reference to the original 'setInterval' function.
     * @type {Function}
     * @private
     */
    #originalSetInterval = null;

    /**
     * Reference to the original 'clearInterval' function.
     * @type {Function}
     * @private
     */
    #originalClearInterval = null;

    /**
     * Reference to the original 'requestAnimationFrame' function.
     * @type {Function}
     * @private
     */
    #originalRequestAnimationFrame = null;

    /**
     * Reference to the original 'cancelAnimationFrame' function.
     * @type {Function}
     * @private
     */
    #originalCancelAnimationFrame = null;

    /**
     * Current index generated for a ticker method.
     * @type {Number}
     * @private
     */
    #currentIndex = 10000;

    /**
     * Current running time of the ticker since it was last started.
     * @type {Number}
     * @private
     */
    #currentTime = 0;

    /**
     * Delta time since the last tick.
     * @type {Number}
     * @private
     */
    #delta = 0;

    /**
     * Flag used to toggle the window functions with the ticker ones.
     * @type {Boolean}
     * @private
     */
    #useWindowFunctions = true;

    /**
     * Running status of the ticker.
     * @type {Boolean}
     * @private
     */
    #running = false;

    /**
     * List of the latest frames registered.
     * @type {Array}
     * @private
     */
    #frameRateHistory = null;

    /**
     * List of all the ticker callbacks.
     * @type {Object}
     * @private
     */
    #tickerCallbacks = null;

    /**
     * Initialise the ticker.
     * @constructor
     */
    constructor() {

        // Extracting the original timing functions from the Window object.
        this.#originalSetTimeout = window.setTimeout;
        this.#originalClearTimeout = window.clearTimeout;
        this.#originalSetInterval = window.setInterval;
        this.#originalClearInterval = window.clearInterval;
        this.#originalRequestAnimationFrame = window.requestAnimationFrame;
        this.#originalCancelAnimationFrame = window.cancelAnimationFrame;

        // Force the service to replace the JavaScript timing functions with the service ones.
        this.useWindowFunctions = false;

        // Export new timing functions along side the usual ones.
        window.setAnimationLoop = this.setAnimationLoop;
        window.clearAnimationLoop = this.clearAnimationLoop;
        window.setCounter = this.setCounter;
        window.clearCounter = this.clearCounter;
        window.sleep = this.sleep;
        window.frame = this.frame;

        // Initialising the internal properties.
        this.#frameRateHistory = [];
        this.#tickerCallbacks = {};

        // Start the service.
        this.start();
    }

    /**
     * Get the current application frame rate.
     * @returns {Number}
     */
    get frameRate() {
        return this.#delta ? Math.min(1000/this.#delta, this.maxFrameRate) : this.maxFrameRate;
    }

    /**
     * Get the maximum frame rate supported by the browser.
     * @returns {Number}
     */
    get maxFrameRate() {
        return this.#delta ? Math.round((1000/this.#delta)/30)*30 : 60;
    }

    /**
     * Get the average frame rate recorded during the last couple of seconds.
     * @returns {Number}
     */
    get averageFrameRate() {
        return this.#frameRateHistory.length ?
            this.#frameRateHistory.reduce((value, total) => value + total) / this.#frameRateHistory.length :
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
        return this.#running;
    }

    /**
     * Check if the service is using the window timing function.
     * @returns {Boolean}
     */
    get useWindowFunctions() {
        return this.#useWindowFunctions;
    }

    /**
     * Toggle the timing function from the default JavaScript once to the service once and vice-versa.
     * @param {Boolean} value
     */
    set useWindowFunctions(value) {
        value = Boolean(value);

        if (value !== this.#useWindowFunctions)
        {
            window.setTimeout = value ? this.#originalSetTimeout : (...params) => this.setTimeout(...params);
            window.clearTimeout = value ? this.#originalClearTimeout : (index) => this.clearTimeout(index);
            window.setInterval = value ? this.#originalSetInterval : (...params) => this.setInterval(...params);
            window.clearInterval = value ? this.#originalClearInterval : (index) => this.clearInterval(index);
            window.requestAnimationFrame = value ? this.#originalRequestAnimationFrame : (...params) => this.requestAnimationFrame(...params);
            window.cancelAnimationFrame = value ? this.#originalCancelAnimationFrame : (index) => this.cancelAnimationFrame(index);

            this.#useWindowFunctions = value;
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
        return this.#createTickerCallback(callback, params, 1, time);
    }

    /**
     * Clear a registered timeout.
     * @param {Number} index
     */
    clearTimeout(index) {
        this.#clearTickerCallback(index);
    }

    /**
     * Register a callback that will be executed at regular intervals.
     * @param {Function} callback
     * @param {Number} time
     * @param {Array} params
     * @returns {Number}
     */
    setInterval(callback, time, ...params) {
        return this.#createTickerCallback(callback, params, Infinity, time);
    }

    /**
     * Clear a registered interval.
     * @param {Number} index
     */
    clearInterval(index) {
        this.#clearTickerCallback(index);
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
        return this.#createTickerCallback(callback, params, repeats, time);
    }

    /**
     * Clear a registered counter.
     * @param {Number} index
     */
    clearCounter(index) {
        this.#clearTickerCallback(index);
    }

    /**
     * Execute a callback on the next available frame.
     * @param {Function} callback
     * @returns {Number}
     */
    requestAnimationFrame(callback) {
        return this.#createTickerCallback(callback, [], 1, 1);
    }

    /**
     * Cancel a request to execute a callback on the next available frame.
     * @param {Number} index
     */
    cancelAnimationFrame(index) {
        this.#clearTickerCallback(index);
    }

    /**
     * Create an animation loop where the callback will be executed at every frame.
     * It is possible to specify a frame rate different from the browser one.
     * @param {Function} callback
     * @param {Number} [frameRate]
     * @returns {Number}
     */
    setAnimationLoop(callback, frameRate) {
        return this.#createTickerCallback(callback, [], Infinity, frameRate ? 1000/frameRate : 1);
    }

    /**
     * Clear a registered animation loop.
     * @param {Number} index
     */
    clearAnimationLoop(index) {
        this.#clearTickerCallback(index);
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
        if (!this.#running) {
            this.#running = true;
            this.#currentTime = this.#getTime();
            this.#playAnimationFrame(this);
        }

        return this;
    }

    /**
     * Stop the service.
     * @returns {TickerService}
     */
    stop() {
        this.#running = false;
        return this;
    }

    /*******************/
    /* PRIVATE METHODS */
    /*******************/


    /**
     * Get the current timestamp.
     * @returns {Number}
     */
    #getTime() {
        if (window.performance) {
            return performance.now();
        } else {
            return Date.now();
        }
    }

    /**
     * Clear one of the ticker callbacks.
     * @param {Number} index
     * @private
     */
    #clearTickerCallback(index) {
        delete this.#tickerCallbacks[index];
    }

    /**
     * Register a ticker callback.
     * @param {Function} callback
     * @param {Array} params
     * @param {Number} repeats
     * @param {Number} delay
     * @returns {Number}
     * @private
     */
    #createTickerCallback(callback, params, repeats, delay) {
        if (typeof delay !== "number" || delay <= 0) {
            throw new Error("Delay must be a positive number.");
        }
        if (typeof repeats !== "number" || repeats <= 0) {
            throw new Error("A callback must be executed at least once.");
        }

        const index = this.#currentIndex++;

        this.#tickerCallbacks[index] = {
            "callback": callback,
            "params": params,
            "repeats": repeats,
            "delay": delay,
            "count": 0,
            "executionTime": 0,
            "totalTime": this.#currentTime - this.#getTime()
        };

        return index;
    }

    /**
     * Execute all the callbacks that have requested to be run at the current frame.
     * @param {Number} delta
     * @private
     */
    #tick(delta) {
        const tickers = Object.keys(this.#tickerCallbacks);
        let i, ii;

        for (i=0, ii=tickers.length; i<ii; i++) {
            const tickerId = Number(tickers[i]);
            const ticker = this.#tickerCallbacks[tickerId];

            ticker.totalTime += this.#delta;

            const tickerTime = ticker.totalTime - ticker.executionTime;

            if (tickerTime >= ticker.delay) {
                ticker.callback(...ticker.params, tickerTime, ticker.count);

                ticker.count++;
                ticker.executionTime = ticker.totalTime;

                if (ticker.count >= ticker.repeats) {
                    this.#clearTickerCallback(tickerId);
                }
            }
        }
    }

    /**
     * Create the main animation loop.
     * @private
     */
    #playAnimationFrame() {
        this.#originalRequestAnimationFrame(() => {
            if (this.#running) {
                const time = this.#getTime();
                this.#delta = this.#currentTime ? time - this.#currentTime : 0;

                if (this.#delta) {
                    this.#tick(this.#delta);
                }
                this.#currentTime = time;

                this.#storeFrameRateHistory();

                this.#playAnimationFrame();
            }
        });
    }

    /**
     * Store a frame into the history.
     * @private
     */
    #storeFrameRateHistory() {
        if (this.#delta > 0) {
            const frameRate = Math.min(1000 / this.#delta, this.maxFrameRate);

            this.#frameRateHistory.unshift(frameRate);

            if (this.#frameRateHistory.length > 120) {
                this.#frameRateHistory.length = 120;
            }
        }
    }
}

export default new TickerService();