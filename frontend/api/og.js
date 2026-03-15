export default async function handler(req, res) {
  const code = req.query.code || 'unknown';

  let ogTitle = 'Certificate of Authenticity | TrueCOA';
  let ogDesc = 'Blockchain-verified Certificate of Authenticity. Transparent Authenticity.';
  let ogImage = `https://${req.headers.host}/logo.png`;

  try {
    const apiRes = await fetch(
      `https://coa.up.railway.app/api/verify/${encodeURIComponent(code)}`
    );
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.coa) {
        const title = data.coa.title || 'Untitled';
        const artist = data.coa.artist || '';
        ogTitle = artist
          ? `${title} by ${artist} — TrueCOA`
          : `${title} — TrueCOA`;
        ogDesc = artist
          ? `Certificate of Authenticity for "${title}" by ${artist}. Blockchain-verified on Polygon.`
          : 'Certificate of Authenticity. Blockchain-verified on Polygon.';
        if (data.coa.imageUrl) ogImage = data.coa.imageUrl;
      }
    }
  } catch (e) {
    // use defaults
  }

  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const userAgent = req.headers['user-agent'] || '';
  const isBot =
    /facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|googlebot|bingbot|applebot/i.test(
      userAgent
    );

  if (isBot) {
    const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8" />
<title>${esc(ogTitle)}</title>
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(ogTitle)}" />
<meta property="og:description" content="${esc(ogDesc)}" />
<meta property="og:url" content="https://${req.headers.host}/AUTHENTICATE/${code}" />
<meta property="og:image" content="${esc(ogImage)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(ogTitle)}" />
<meta name="twitter:description" content="${esc(ogDesc)}" />
<meta name="twitter:image" content="${esc(ogImage)}" />
</head><body></body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  // Non-bots: fetch and serve the SPA index.html
  try {
    const spaRes = await fetch(`https://${req.headers.host}/index.html`);
    const spaHtml = await spaRes.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(spaHtml);
  } catch (e) {
    res.writeHead(302, { Location: `/?code=${code}` });
    return res.end();
  }
}

export const config = {
  runtime: 'nodejs',
};
