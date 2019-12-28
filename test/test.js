/*
 * Copyright (c) 2019
 * Author: Marco Castiello
 * E-mail: marco.castiello@gmail.com
 * Project: Ticker.js
 */

const TickerService = require('../src/ticker').default;

const ticker = new TickerService();

describe('Ticker Initialisation', () => {
    it("should replace timing functions with internal ones", () => {
        expect(ticker.useWindowFunctions).toBeFalsy();

        expect(setTimeout === ticker.setTimeout).toBeTruthy();
        expect(clearTimeout === ticker.clearTimeout).toBeTruthy();
        expect(setInterval === ticker.setInterval).toBeTruthy();
        expect(clearInterval === ticker.clearInterval).toBeTruthy();
        expect(requestAnimationFrame === ticker.requestAnimationFrame).toBeTruthy();
        expect(cancelAnimationFrame === ticker.cancelAnimationFrame).toBeTruthy();

        expect(ticker.isRunning).toBeTruthy();
    });
    it("should be able to restore the original timing functions", () => {
        ticker.useWindowFunctions = true;

        expect(ticker.useWindowFunctions).toBeTruthy();

        expect(setTimeout === ticker.setTimeout).toBeFalsy();
        expect(clearTimeout === ticker.clearTimeout).toBeFalsy();
        expect(setInterval === ticker.setInterval).toBeFalsy();
        expect(clearInterval === ticker.clearInterval).toBeFalsy();
        expect(requestAnimationFrame === ticker.requestAnimationFrame).toBeFalsy();
        expect(cancelAnimationFrame === ticker.cancelAnimationFrame).toBeFalsy();

        ticker.useWindowFunctions = false;
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

        const delta = await sleep(timeout);

        const final = Date.now();

        expect(final - initial >= timeout).toBeTruthy();
    });
    it("should execute in the next frame", async () => {
        const initial = Date.now();

        await frame();

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

        await sleep(1000);

        expect(counter).toBe(5);
        expect(time >= 500).toBeTruthy();
    });
});