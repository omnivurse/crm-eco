/** True when the rich-area draft has no visible text (empty, `<p><br></p>`, whitespace). */
export function isBlankNoteHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
}
