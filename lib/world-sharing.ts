export function worldShareUrl(href: string, title?: string) {
  const url = new URL(href);
  // Share only the public story identifier, never unrelated session parameters.
  url.search = '';
  url.hash = '';
  if (title) url.searchParams.set('world', title);
  return url.toString();
}

export async function copyShareText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const input = document.createElement('textarea');
    input.value = text;
    input.readOnly = true;
    input.setAttribute('aria-label', '待复制的分享内容');
    input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    (previous?.closest('[role="dialog"]') ?? document.body).appendChild(input);
    try {
      input.focus(); input.select();
      // oxlint-disable-next-line typescript/no-deprecated -- Fallback for browsers without an available Clipboard API; its result is checked.
      return document.execCommand('copy');
    } catch { return false; }
    finally { input.remove(); previous?.focus({ preventScroll: true }); }
  }
}
