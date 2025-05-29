const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Scrape articles for a single month, up to maxPages pages
async function scrapeMonth(year, month, maxPages = 100) {
  let url = `https://www.theverge.com/archives/${year}/${month}`;
  let headlines = [];
  let pagesScraped = 0;

  while (pagesScraped < maxPages && url) {
    console.log(`Scraping: ${url}`);
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                      'Chrome/90.0.4430.93 Safari/537.36'
      }
    });

    const $ = cheerio.load(data);

    // Get all article links with titles
    $('a._1lkmsmo1').each((i, el) => {
      const title = $(el).text().trim();
      let link = $(el).attr('href');
      if (link && link.startsWith('/')) {
        link = 'https://www.theverge.com' + link;
      }
      if (title && link) {
        headlines.push({ title, link });
      }
    });

    // Find next page link
    const nextHref = $('link[rel="next"]').attr('href');
    if (nextHref) {
      url = nextHref.startsWith('http') ? nextHref : 'https://www.theverge.com' + nextHref;
    } else {
      console.log('No next page found, stopping.');
      break;
    }

    pagesScraped++;
  }

  return headlines;
}

// Helper to get next month and year
function nextMonthYear(year, month) {
  month++;
  if (month > 12) {
    month = 1;
    year++;
  }
  return { year, month };
}

// Calculate how many months between two year-month pairs (inclusive)
function monthsBetween(startYear, startMonth, endYear, endMonth) {
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
}

// Scrape multiple months sequentially
async function scrapeMonths(startYear, startMonth, numMonths, maxPagesPerMonth) {
  let allHeadlines = [];
  let year = startYear;
  let month = startMonth;

  for (let i = 0; i < numMonths; i++) {
    console.log(`Scraping articles from ${year}-${month.toString().padStart(2, '0')}`);
    const monthHeadlines = await scrapeMonth(year, month, maxPagesPerMonth);
    allHeadlines = allHeadlines.concat(monthHeadlines);

    // Move to next month
    ({ year, month } = nextMonthYear(year, month));
  }

  return allHeadlines;
}

app.get('/', async (req, res) => {
  const startYear = 2022;
  const startMonth = 1;
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const numMonths = monthsBetween(startYear, startMonth, currentYear, currentMonth);

  const articles = await scrapeMonths(startYear, startMonth, numMonths, 100);

  let html = `
    <html>
    <head>
      <title>The Verge Headlines - Jan 2022 to Today (Up to 50 Pages Each Month)</title>
      <style>
        body { font-family: Arial, sans-serif; background: #fff; color: #000; padding: 2rem; }
        a { color: black; text-decoration: none; display: block; margin-bottom: 1rem; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>The Verge Headlines - Jan 2022 to ${currentYear}-${currentMonth.toString().padStart(2, '0')}</h1>
      <p>Total articles: ${articles.length}</p>
  `;

  articles.forEach(article => {
    html += `<a href="${article.link}" target="_blank" rel="noopener noreferrer">${article.title}</a>`;
  });

  html += '</body></html>';
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
