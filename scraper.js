const { chromium } = require('playwright');
const fs = require('fs');

const URL = 'https://www.google.com/maps/search/Coffee/@53.3444544,-6.2772724,14z/data=!3m1!4b1?authuser=0&hl=en&entry=ttu';
const OUTPUT_FILE = 'Dublin2.csv'
const IS_HEADLESS = false;

;(async () => {

    console.time("Execution Time");

    const browser = await chromium.launch({ headless:IS_HEADLESS });
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

    console.log(`${urls.length} URLs found`);

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

        const phoneElement=await newPage.$('button[data-tooltip="Copy phone number"]');
        let phone=phoneElement?await newPage.evaluate(element=>element.textContent,phoneElement):'';
        phone=`"${phone}"`;
        url=`"${url}"`;

        const websiteElement=await newPage.$('a[data-tooltip="Open website"]')||await newPage.$('a[data-tooltip="Open menu link"]');
        let website=websiteElement?await newPage.evaluate(element=>element.getAttribute('href'),websiteElement):'';
        website=`"${website}"`;

        let ig = `""`;
        if (website != '""' && !website.includes("instagram.com"))
        {
            let websiteURL = website.substring(1, website.length-1); 
            try {
                await newPage.goto(websiteURL);
                // await newPage.evaluate(() => {
                //     window.scrollTo(0, document.body.scrollHeight);
                //   });

                await newPage.keyboard.down('End');
                await newPage.keyboard.up('End');

                const instagramElement = await newPage.$('a[href*="https://www.instagram.com"]');
                let instagram = instagramElement ? await newPage.evaluate( element => element.getAttribute('href'), instagramElement) : '';
                ig = `"${instagram}"`;    
            } catch (error) {
                console.log(error);
            }
        } else if (website.includes("instagram.com"))
        {
            ig = website;
            website = `""`;
        }

        await newPage.close();
        return{name,rating,reviews,address,website, ig, phone,url};
    };

    const batchSize = 3;
    const results = [];
    
    for( let i = 0; i < urls.length; i += batchSize )
    {
        const batchUrls = urls.slice(i, i + batchSize);
        const batchResults = await Promise.all( batchUrls.map( url => scrapePageData(url) ));
        results.push(...batchResults);
        console.log(`Batch ${i/batchSize+1} completed.`);
    }	

    await browser.close();

    const csvHeader='Name,ig,Website,Rating,Reviews,Address,Phone,Url\n';

    const csvRows = results.map(r => `${r.name},${r.ig},${r.website},${r.rating},${r.reviews},${r.address},${r.phone},${r.url}`).join('\n');
    fs.writeFileSync(OUTPUT_FILE, csvHeader + csvRows);
    await browser.close();
    console.timeEnd("Execution Time");

    // console.log(results);

})().catch((err) => {
    console.log(err);
    process.exit(1);
})