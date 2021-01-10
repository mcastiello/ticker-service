/*
 * Copyright (c) 2019
 * Author: Marco Castiello
 * E-mail: marco.castiello@gmail.com
 * Project: Ticker Service
 */

// Extracting the original timing functions from the Window object.
const originalSetTimeout = self.setTimeout;
const originalClearTimeout = self.clearTimeout;
const originalSetInterval = self.setInterval;
const originalClearInterval = self.clearInterval;
const originalRequestAnimationFrame = self.requestAnimationFrame;
const originalCancelAnimationFrame = self.cancelAnimationFrame;

const TickerService = require('../src/TickerService').default;
const ticker = new TickerService();

describe('Ticker Initialisation', () => {
    it("should replace timing functions with internal ones", () => {
        expect(ticker.useScopeFunctions).toBeFalsy();

        expect(setTimeout === originalSetTimeout).toBeFalsy();
        expect(clearTimeout === originalClearTimeout).toBeFalsy();
        expect(setInterval === originalSetInterval).toBeFalsy();
        expect(clearInterval === originalClearInterval).toBeFalsy();
        expect(requestAnimationFrame === originalRequestAnimationFrame).toBeFalsy();
        expect(cancelAnimationFrame === originalCancelAnimationFrame).toBeFalsy();

        expect(ticker.isRunning).toBeTruthy();
    });
    it("should be able to restore the original timing functions", () => {
        ticker.useScopeFunctions = true;

        expect(ticker.useScopeFunctions).toBeTruthy();

        expect(setTimeout === originalSetTimeout).toBeTruthy();
        expect(clearTimeout === originalClearTimeout).toBeTruthy();
        expect(setInterval === originalSetInterval).toBeTruthy();
        expect(clearInterval === originalClearInterval).toBeTruthy();
        expect(requestAnimationFrame === originalRequestAnimationFrame).toBeTruthy();
        expect(cancelAnimationFrame === originalCancelAnimationFrame).toBeTruthy();

        ticker.useScopeFunctions = false;
    });
});

describe("Ticker Timing Functions", () => {
    it("should execute the timeout callback", async () => {
        const initial = Date.now();
        const input = "Input Test";
        const timeout = 1000;

        const output = await new Promise(resolve => ticker.setTimeout(resolve, timeout, input));
        const final = Date.now();

        expect(final - initial >= timeout).toBeTruthy();
        expect(output).toBe(input);
    });
    it("should wait for the sleep to wake up", async () => {
        const initial = Date.now();
        const timeout = 1000;

        await ticker.sleep(timeout);

        const final = Date.now();

        expect(final - initial >= timeout).toBeTruthy();
    });
    it("should execute in the next frame", async () => {
        const initial = Date.now();

        await ticker.frame();

        const final = Date.now();

        expect(final - initial > 0 && final - initial <= 1000 / ticker.frameRate).toBeTruthy();
    });
    it("should execute the counter callback a specific number of times", async () => {
        let counter = 0;
        let time = 0;

        ticker.setCounter((delta) => {
            counter++;
            time += delta;
        }, 100, 5);

        await ticker.sleep(1000);

        expect(counter).toBe(5);
        expect(time >= 500).toBeTruthy();
    });
});
