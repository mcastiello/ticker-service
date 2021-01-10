/*
 * Copyright (c) 2021
 * Author: Marco Castiello
 * E-mail: marco.castiello@gmail.com
 * Project: Ticker Service
 */

/**
 * Extend the Window interface
 */
declare global {
  interface Window {
    setAnimationLoop: (callback: TimerHandler, frameRate: number) => number;
    clearAnimationLoop: (loopId: number) => void;
    setCounter: (callback: TimerHandler, time: number, repeats: number, ...params: any[]) => number;
    clearCounter: (counterId: number) => void;
    sleep: (time: number) => Promise<unknown>;
    frame: () => Promise<unknown>;
  }
}

type TickerCallback = {
  callback: TimerHandler;
  params: any[];
  repeats: number;
  delay: number;
  count: number;
  executionTime: number;
  totalTime: number;
};

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
 * Define a service used to keep all the timing functions in sync by replacing the
 * internal JavaScript timer with one based on a frame animation loop.
 * All the timing functions will be overridden with the service once and some other
 * will be added to make animator lives easier.
 * @class
 */
export default class TickerService {
  /**
   * Current index generated for a ticker method.
   * @type {Number}
   * @private
   */
  private currentIndex: number = 10000;

  /**
   * Current running time of the ticker since it was last started.
   * @type {Number}
   * @private
   */
  private currentTime: number = 0;

  /**
   * Delta time since the last tick.
   * @type {Number}
   * @private
   */
  private delta: number = 0;

  /**
   * Reference to the latest frame request.
   * @type {Number}
   * @private
   */
  private animationFrameRequest: number | null = null;

  /**
   * Flag used to toggle the scope functions with the ticker ones.
   * @type {Boolean}
   * @private
   */
  private useScopeFunctionsFlag: boolean = true;

  /**
   * Running status of the ticker.
   * @type {Boolean}
   * @private
   */
  private running: boolean = false;

  /**
   * List of the latest frames registered.
   * @type {Array}
   * @private
   */
  private frameRateHistory: number[] = [];

  /**
   * List of all the ticker callbacks.
   * @type {Object}
   * @private
   */
  private tickerCallbacks: Map<number, TickerCallback> = new Map();

  constructor() {
    // Export new timing functions along side the usual ones.
    self.setAnimationLoop = (callback: TimerHandler, frameRate: number) => this.setAnimationLoop(callback, frameRate);
    self.clearAnimationLoop = (index: number) => this.clearAnimationLoop(index);
    self.setCounter = (callback: TimerHandler, time: number, repeats: number, ...params: any[]) =>
      this.setCounter(callback, time, repeats, ...params);
    self.clearCounter = (index: number) => this.clearCounter(index);
    self.sleep = (time: number) => this.sleep(time);
    self.frame = () => this.frame();

    // Start the service.
    this.start();
  }

  /**
   * Get the current application frame rate.
   * @returns {Number}
   */
  get frameRate(): number {
    return this.delta ? Math.min(1000 / this.delta, this.maxFrameRate) : this.maxFrameRate;
  }

  /**
   * Get the maximum frame rate supported by the browser.
   * @returns {Number}
   */
  get maxFrameRate(): number {
    return this.delta ? Math.round(1000 / this.delta / 30) * 30 : 60;
  }

  /**
   * Get the average frame rate recorded during the last couple of seconds.
   * @returns {Number}
   */
  get averageFrameRate(): number {
    return this.frameRateHistory.length
      ? this.frameRateHistory.reduce((value, total) => value + total) / this.frameRateHistory.length
      : this.frameRate;
  }

  /**
   * The score is a number that can be used to assess the device performance.
   * It is a value between 0 to 100, if the value goes below a certain threshold
   * it means that the device is struggling executing the animation loop and some
   * action should be taken to ease the load from the CPU/GPU.
   * @returns {Number}
   */
  get score(): number {
    return Math.round((this.averageFrameRate / this.maxFrameRate) * 100);
  }

  /**
   * Check if the service is running.
   * @returns {Boolean}
   */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if the service is using the scope timing function.
   * @returns {Boolean}
   */
  get useScopeFunctions(): boolean {
    return this.useScopeFunctionsFlag;
  }

  /**
   * Toggle the timing function from the default JavaScript once to the service once and vice-versa.
   * @param {Boolean} value
   */
  set useScopeFunctions(value) {
    value = Boolean(value);

    if (value !== this.useScopeFunctionsFlag) {
      self.setTimeout = value
        ? originalSetTimeout
        : (((callback: TimerHandler, time?: number, ...params: any[]) =>
            this.setTimeout(callback, time, ...params)) as typeof self.setTimeout);
      self.clearTimeout = value ? originalClearTimeout : (((index: number) => this.clearTimeout(index)) as typeof self.clearTimeout);
      self.setInterval = value
        ? originalSetInterval
        : (((callback: TimerHandler, time?: number, ...params: any[]) =>
            this.setInterval(callback, time, ...params)) as typeof self.setInterval);
      self.clearInterval = value ? originalClearInterval : (((index: number) => this.clearInterval(index)) as typeof self.clearInterval);
      self.requestAnimationFrame = value ? originalRequestAnimationFrame : (callback: TimerHandler) => this.requestAnimationFrame(callback);
      self.cancelAnimationFrame = value ? originalCancelAnimationFrame : (index: number) => this.cancelAnimationFrame(index);

      this.useScopeFunctionsFlag = value;
    }
  }

  /**
   * Register a callback that will be executed after a specific amount of time.
   * @param {Function} callback
   * @param {Number} time
   * @param {Array} params
   * @returns {Number}
   */
  setTimeout(callback: TimerHandler, time?: number, ...params: any[]): number {
    time = time || 1;
    return this.createTickerCallback(callback, params, 1, time);
  }

  /**
   * Clear a registered timeout.
   * @param {Number} index
   */
  clearTimeout(index: number) {
    this.clearTickerCallback(index);
  }

  /**
   * Register a callback that will be executed at regular intervals.
   * @param {Function} callback
   * @param {Number} time
   * @param {Array} params
   * @returns {Number}
   */
  setInterval(callback: TimerHandler, time?: number, ...params: any[]): number {
    return this.createTickerCallback(callback, params, Infinity, time);
  }

  /**
   * Clear a registered interval.
   * @param {Number} index
   */
  clearInterval(index: number) {
    this.clearTickerCallback(index);
  }

  /**
   * Register a callback that will be executed for a specific amount of times over regular intervals.
   * @param {Function} callback
   * @param {Number} time
   * @param {Number} repeats
   * @param {Array} params
   * @returns {Number}
   */
  setCounter(callback: TimerHandler, time: number, repeats: number, ...params: any[]): number {
    return this.createTickerCallback(callback, params, repeats, time);
  }

  /**
   * Clear a registered counter.
   * @param {Number} index
   */
  clearCounter(index: number) {
    this.clearTickerCallback(index);
  }

  /**
   * Execute a callback on the next available frame.
   * @param {Function} callback
   * @returns {Number}
   */
  requestAnimationFrame(callback: TimerHandler): number {
    return this.createTickerCallback(callback, [], 1, 1);
  }

  /**
   * Cancel a request to execute a callback on the next available frame.
   * @param {Number} index
   */
  cancelAnimationFrame(index: number) {
    this.clearTickerCallback(index);
  }

  /**
   * Create an animation loop where the callback will be executed at every frame.
   * It is possible to specify a frame rate different from the browser one.
   * @param {Function} callback
   * @param {Number} frameRate
   * @returns {Number}
   */
  setAnimationLoop(callback: TimerHandler, frameRate: number): number {
    return this.createTickerCallback(callback, [], Infinity, frameRate ? 1000 / frameRate : 1);
  }

  /**
   * Clear a registered animation loop.
   * @param {Number} index
   */
  clearAnimationLoop(index: number) {
    this.clearTickerCallback(index);
  }

  /**
   * Return a promise that will be automatically resolved after a certain amount of time.
   * @param {Number} time
   * @returns {Promise}
   */
  sleep(time: number): Promise<any> {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

  /**
   * Return a promise that will be automatically resolved on the next available frame.
   * @returns {Promise}
   */
  frame(): Promise<any> {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  /**
   * Start the service.
   * @returns {TickerService}
   */
  start(): TickerService {
    if (!this.running) {
      // Force the service to replace the JavaScript timing functions with the service ones.
      this.useScopeFunctions = false;

      // Initialise the properties.
      this.running = true;
      this.currentTime = this.getTime();

      // Kick-off the animation loop
      this.playAnimationFrame();
    }

    return this;
  }

  /**
   * Stop the service.
   * @returns {TickerService}
   */
  stop(): TickerService {
    // Update the state of the service.
    this.running = false;

    // Stop the execution of the latest frame.
    originalCancelAnimationFrame(this.animationFrameRequest);

    // Restore the original timing functions.
    this.useScopeFunctions = true;

    return this;
  }

  /**
   * Get the current timestamp.
   * @returns {Number}
   */
  private getTime = (): number => {
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
  private clearTickerCallback = (index: number) => {
    this.tickerCallbacks.delete(index);
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
  private createTickerCallback = (callback: TimerHandler, params: any[], repeats: number, delay: number): number => {
    if (typeof delay !== 'number' || delay <= 0) {
      throw new Error('Delay must be a positive number.');
    }
    if (typeof repeats !== 'number' || repeats <= 0) {
      throw new Error('A callback must be executed at least once.');
    }

    const index = this.currentIndex++;

    this.tickerCallbacks.set(index, {
      callback: callback,
      params: params,
      repeats: repeats,
      delay: delay,
      count: 0,
      executionTime: 0,
      totalTime: this.currentTime - this.getTime()
    });

    return index;
  };

  /**
   * Execute all the callbacks that have requested to be run at the current frame.
   * @param {Number} delta
   * @private
   */
  private tick = (delta: number) => {
    this.tickerCallbacks.forEach((ticker, tickerId) => {
      ticker.totalTime += delta;

      const tickerTime = ticker.totalTime - ticker.executionTime;

      if (tickerTime >= ticker.delay && typeof ticker.callback === 'function') {
        ticker.callback(...ticker.params, tickerTime, ticker.count);

        ticker.count++;
        ticker.executionTime = ticker.totalTime;

        if (ticker.count >= ticker.repeats) {
          this.clearTickerCallback(tickerId);
        }
      }
    });
  };

  /**
   * Create the main animation loop.
   * @private
   */
  private playAnimationFrame = () => {
    this.animationFrameRequest = originalRequestAnimationFrame(() => {
      if (this.running) {
        const time = this.getTime();
        this.delta = this.currentTime ? time - this.currentTime : 0;

        if (this.delta) {
          this.tick(this.delta);
        }
        this.currentTime = time;

        this.storeFrameRateHistory();

        this.playAnimationFrame();
      }
    });
  };

  /**
   * Store a frame into the history.
   * @private
   */
  private storeFrameRateHistory = () => {
    if (this.delta > 0) {
      const frameRate = Math.min(1000 / this.delta, this.maxFrameRate);

      this.frameRateHistory.unshift(frameRate);

      if (this.frameRateHistory.length > 120) {
        this.frameRateHistory.length = 120;
      }
    }
  };
}
