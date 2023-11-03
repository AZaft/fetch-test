const puppeteer = require('puppeteer');
require('dotenv').config();

/**
 * Clicks weigh button on the page.
 * @param {Object} page - loaded browser page.
 */
async function clickWeighButton(page) {
    await page.click("#weigh");
}

/**
 * Clicks reset button on the page. Selecting with just id here wasn't working
 * @param {Object} page - loaded browser page.
 */
async function clickResetButton(page) {
    await page.evaluate(() => {
        [...document.querySelectorAll('button')].find(element => element.textContent === 'Reset').click();
    });
}

/**
 * Scrapes the measurement results from the webpage
 * @param {Object} page - loaded browser page.
 * @param {Number} measurementCount - keeps track of how many weighings in current session.
 * @returns {Array} - Equality from the result of string on web page 
 */
async function getMeasurementResults(page, measurementCount) {
    let retries = 0;
    while(true){
        if(retries >= 60){
            throw new Error('Timeout: Measurement result took too long');
        }

        try{ 
            await page.waitForSelector('.game-info ol li');
        } catch(e){
            console.log(`Test failed waiting for measurement: \n ${e}`);
        }
        
        let weighings = await page.$$eval("div.game-info ol li", list => {
            return list.map(item => item.textContent);
        });

        if(measurementCount > weighings.length){
            await delay(500);
            retries++;
            continue;
        }

        let measurement = weighings[measurementCount-1];
        let parts = measurement.split(" ");
        return parts[1];
    }
}

/**
 * Fills left bowl at a specified position with number (bar)
 * @param {Object} page - loaded browser page
 * @param {Number} position - position in bowl
 * @param {Number} number - which number bar
 */
async function fillLeftBowl(page, position, number) {
    await page.type(`.game-board #left_${position}`, number.toString())
}

/**
 * Fills right bowl at a specified position with number (bar)
 * @param {Object} page - loaded browser page
 * @param {Number} position - position in bowl
 * @param {Number} number - which number bar
 */
async function fillRightBowl(page, position, number) {
    await page.type(`.game-board #right_${position}`, number.toString())
}

/**
 * Selects and clicks bar is the fake
 * @param {Object} page - loaded browser page
 * @param {Number} number - which number bar
 */
async function clickGoldBar(page, number){
    await page.click(`#coin_${number}`);
}

/**
 * Utility function to wait
 * @param {Number} number - which number bar
 * @param {Number} time - time in ms
 */
function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
}

/**
 * Use above functions to apply algorithm to find fake bar in minimum weighings similar to binary search
 * @param {Object} page - loaded browser page.
 * @param {Number} measurementCount - keeps track of how many weighings in current session.
 * @returns {Number} - the number of the fake bar
 */ 
async function minimumWeighingsAlgorithm(page, measurementCount){
    bars = [0, 1, 2, 3, 4, 5, 6, 7, 8];
   
    while(bars.length > 1){
        let mid = Math.floor(bars.length/2);
        let isOdd = bars.length % 2 != 0;

        for(let i = 0; i < mid; i++){
            await fillLeftBowl(page, bars[i], bars[i]);
        }
       
        for(let i = (isOdd) ? mid + 1 : mid; i < bars.length; i++){
            await fillRightBowl(page, bars[i], bars[i]);
        }
        
        await clickWeighButton(page);
        let result = await getMeasurementResults(page, ++measurementCount);
        console.log(`Weigh #${measurementCount}: ${result}`);

        if(result === ">"){
            if(bars.length <= 2) return bars[bars.length-1];
            bars = bars.slice((isOdd) ? mid + 1 : mid);
        } else if(result === "<"){
            if(bars.length <= 2) return bars[0];
            bars = bars.slice(0, mid);
        } else {
            return bars[mid];
        }
        await clickResetButton(page);
    }

    return bars.pop();
}

/**
 * Main function to initialize puppeteer and call and verify test cases
 */ 
(async () => {
    const defaultTimeout = 10000;
    const browser = await puppeteer.launch( {headless: false});
    const page = await browser.newPage();
    const successPrompt = "Yay! You find it!";
    let result = "";
    let measurementCount = 0;
    page.setDefaultTimeout(defaultTimeout);
    await page.goto(process.env.WEBSITE_URL);
    await page.waitForSelector('.game-board');
    console.log("Browser initialized");

    // Run algorithm and check results
    console.log("Running minimum weighs algorithm...")
    let answer = await minimumWeighingsAlgorithm(page, measurementCount);
    console.log(`Alogorithm result: ${answer}`);

    page.on('dialog', async dialog => {
        result = dialog.message();
        await delay(1000);
        await dialog.dismiss();
    });
    await clickGoldBar(page, answer);
    await page.screenshot({
        path: `./results/result-${Math.floor(Math.random()*10000)}.png`,
    });
    if(result === successPrompt)
        console.log("Algorithm test passed")
    console.log(`RESULT: ${result}`);

    await browser.close();
})();