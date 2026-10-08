/**
 * Prints a document in an isolated hidden iframe so the rest of the app (docks, queues, modals)
 * never leaks onto the paper and the page's own print CSS cannot hide it.
 * The page's stylesheets are copied in, so Tailwind classes and inline styles both work.
 */
export const printHtml = (bodyHtml: string, title: string): Promise<void> =>
  new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      window.print();
      resolve();
      return;
    }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${window.location.origin}/"><title>${title.replace(/</g, '&lt;')}</title>${styles}
<style>
  @page { margin: 10mm; }
  html, body { background: #fff !important; color: #0f172a !important; margin: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
</style></head><body>${bodyHtml}</body></html>`);
    doc.close();

    let printed = false;
    const cleanup = () => {
      setTimeout(() => iframe.remove(), 500);
      resolve();
    };
    const doPrint = () => {
      if (printed) return;
      printed = true;
      try {
        win.focus();
        win.addEventListener('afterprint', cleanup, { once: true });
        win.print();
        // Some browsers do not fire afterprint for iframes.
        setTimeout(cleanup, 60_000);
      } catch {
        cleanup();
      }
    };

    // Wait for images (emblem, QR codes) so they are not missing from the printout.
    const images = Array.from(doc.images);
    if (images.length === 0) {
      setTimeout(doPrint, 150);
      return;
    }
    let pending = images.length;
    const done = () => { pending -= 1; if (pending <= 0) setTimeout(doPrint, 100); };
    images.forEach(img => {
      if (img.complete) done();
      else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
    });
    setTimeout(doPrint, 2500);
  });

export const printElement = (element: HTMLElement | null, title: string) =>
  element ? printHtml(element.outerHTML, title) : Promise.resolve();
