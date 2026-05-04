const withBaseTarget = (html) => {
  if (!html) {
    return '';
  }

  if (/<base\s/i.test(html)) {
    return html;
  }

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, '<head$1><base target="_blank" rel="noopener noreferrer">');
  }

  return html;
};

const buildHtmlDocument = (html) => {
  const normalizedHtml = withBaseTarget(String(html || ''));

  if (/<html[\s>]/i.test(normalizedHtml)) {
    return normalizedHtml;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" rel="noopener noreferrer" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #111827;
        font-family: Arial, sans-serif;
      }

      body {
        padding: 16px;
        overflow-wrap: anywhere;
      }

      img, table {
        max-width: 100% !important;
      }
    </style>
  </head>
  <body>
    ${normalizedHtml}
  </body>
</html>`;
};

function EmailHtmlFrame({ html, title = 'Email preview', className = '' }) {
  return (
    <div className={`overflow-hidden rounded-[1.75rem] border border-border/70 bg-muted/20 ${className}`.trim()}>
      <div className="flex items-center justify-between border-b border-border/70 bg-card/90 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">Bản xem trước HTML</span>
        </div>

        <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Email Preview
        </span>
      </div>

      <div className="bg-[linear-gradient(180deg,rgba(148,163,184,0.08),transparent)] p-4 md:p-5">
        <div className="mx-auto max-w-[880px] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_28px_80px_-48px_rgba(15,23,42,0.55)]">
          <iframe
            title={title}
            srcDoc={buildHtmlDocument(html)}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            className="block h-[740px] w-full bg-white"
          />
        </div>
      </div>
    </div>
  );
}

export default EmailHtmlFrame;
