console.log("ok");

const { chromium } = require('playwright');

const URL = 'https://www.google.com/maps/search/Coffee/@44.8050099,20.431683,14z/data=!4m2!2m1!6e5?authuser=0&hl=en&entry=ttu'; // ex. 'https://www.google.com/maps/search/coffee/@36.3388078,-87.1570715,11z/data=!3m1!4b1?authuser=0&hl=en&entry=ttu'
const OUTPUT_FILE = 'Beograd.csv'

;(async () => {
    // your code here

    console.time("Execution Time");

    const browser = await chromium.launch({ headless:true });
    // const context = await browser.newContext(); // dont need cuz no random user agent, to add: https://youtu.be/nOQxJtfTUTM?t=969
    const page  = await browser.newPage({ bypassCSP: true });

    page.setDefaultTimeout(30000);
    await page.goto(URL);

    // This is the section I need
    await page.waitForSelector('[jstcache="3"]');

    // This is the scrollable element in it
    const scrollable = await page.$('xpath=/html/body/div[2]/div[3]/div[8]/div[9]/div/div/div[1]/div[2]/div/div[1]/div/div/div[1]/div[1]');
    if( !scrollable )
    {
        console.log('Scrollable element not found.');
        await browser.close();
        return;
    }

    let endOfList = false;
    while( !endOfList )
    {
        await scrollable.evaluate( node => node.scrollBy(0,1000) );
        endOfList = await page.evaluate( () => document.body.innerText.includes("You've reached the end of the list") );
    }

    const urls = await page.$$eval('a', links => links.map(link => link.href).filter( href=>href.startsWith('https://www.google.com/maps/place/') ));

    // console.log(urls);
    setTimeout(() => console.log("A Second"), 1000)

    const scrapePageData = async (url) => {

        const newPage=await browser.newPage();
        await newPage.goto(url);
        await newPage.waitForSelector('[jstcache="3"]');

        const nameElement=await newPage.$('xpath=/html/body/div[2]/div[3]/div[8]/div[9]/div/div/div[1]/div[2]/div/div[1]/div/div/div[2]/div/div[1]/div[1]/h1');
        let name=nameElement?await newPage.evaluate(element=>element.textContent,nameElement):'';
        name=`"${name}"`;

        const ratingElement=await newPage.$('xpath=/html/body/div[2]/div[3]/div[8]/div[9]/div/div/div[1]/div[2]/div/div[1]/div/div/div[2]/div/div[1]/div[2]/div/div[1]/div[2]/span[1]/span[1]');
        let rating=ratingElement?await newPage.evaluate(element=>element.textContent,ratingElement):'';
        rating=`"${rating}"`;

        const reviewsElement=await newPage.$('xpath=/html/body/div[2]/div[3]/div[8]/div[9]/div/div/div[1]/div[2]/div/div[1]/div/div/div[2]/div/div[1]/div[2]/div/div[1]/div[2]/span[2]/span/span');
        let reviews=reviewsElement?await newPage.evaluate(element=>element.textContent,reviewsElement):'';
        reviews=reviews.replace(/\(|\)/g,'');
        reviews=`"${reviews}"`;

        const addressElement=await newPage.$('button[data-tooltip="Copy address"]');
        let address=addressElement?await newPage.evaluate(element=>element.textContent,addressElement):'';
        address=`"${address}"`;

        const websiteElement=await newPage.$('a[data-tooltip="Open website"]')||await newPage.$('a[data-tooltip="Open menu link"]');
        let website=websiteElement?await newPage.evaluate(element=>element.getAttribute('href'),websiteElement):'';
        website=`"${website}"`;

        const phoneElement=await newPage.$('button[data-tooltip="Copy phone number"]');
        let phone=phoneElement?await newPage.evaluate(element=>element.textContent,phoneElement):'';
        phone=`"${phone}"`;
        url=`"${url}"`;
    
        await newPage.close();
        return{name,rating,reviews,address,website,phone,url};
    };

    console.log(await scrapePageData( urls.at(0) ));

    const batchSize = 2;
    const results = [];
    
    for( let i = 0; i < urls.length; i += batchSize )
    {
        const batchUrls = urls.slice(i, i + batchSize);
        const batchResults = await Promise.all( batchUrls.map( url => scrapePageData(url) ));
        results.push(...batchResults);
        console.log(`Batch ${i/batchSize+1} completed.`);
    }	

    await browser.close();

    // Ok this works now:
    // - go to websites that dont start with www.instagram
    // - on those websites, find links that start with instagram or facebook
    // Export to sheets and all done, categorize also

    console.log(results);

})().catch((err) => {
    console.log(err);
    process.exit(1);
})