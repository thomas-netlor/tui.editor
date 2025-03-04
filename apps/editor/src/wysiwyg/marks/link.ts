import { Mark as ProsemirrorMark, DOMOutputSpecArray } from 'prosemirror-model';
import { toggleMark } from 'prosemirror-commands';

import Mark from '@/spec/mark';
import { decodeURIGraceful, encodeMarkdownText } from '@/utils/encoder';
import { sanitizeXSSAttributeValue } from '@/sanitizer/htmlSanitizer';
import { createTextNode } from '@/helper/manipulation';
import { getCustomAttrs, getDefaultCustomAttrs } from '@/wysiwyg/helper/node';

import { EditorCommand } from '@t/spec';
import { LinkAttributes } from '@t/editor';

export class Link extends Mark {
  private linkAttributes: LinkAttributes;

  constructor(linkAttributes: LinkAttributes) {
    super();
    this.linkAttributes = linkAttributes;
  }

  get name() {
    return 'link';
  }

  get schema() {
    return {
      attrs: {
        linkUrl: { default: '' },
        linkText: { default: null },
        rawHTML: { default: null },
        ...getDefaultCustomAttrs(),
      },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs(dom: Node | string) {
            const href = (dom as HTMLElement).getAttribute('href') || '';
            const rawHTML = (dom as HTMLElement).getAttribute('data-raw-html');

            return {
              linkUrl: sanitizeXSSAttributeValue(href),
              linkText: (dom as HTMLElement).textContent,
              ...(rawHTML && { rawHTML }),
            };
          },
        },
      ],
      toDOM: ({ attrs }: ProsemirrorMark): DOMOutputSpecArray => [
        attrs.rawHTML || 'a',
        {
          href: attrs.linkUrl,
          ...(this.linkAttributes as DOMOutputSpecArray),
          ...getCustomAttrs(attrs),
        },
      ],
    };
  }

  private addLink(): EditorCommand {
    return (payload) => (state, dispatch) => {
      const { linkUrl, linkText = '' } = payload!;
      const { schema, tr, selection } = state;
      const { empty, from, to } = selection;

      if (from && to && linkUrl) {
        const attrs = {
          linkUrl: encodeMarkdownText(decodeURIGraceful(linkUrl), true),
          linkText: encodeMarkdownText(linkText, false),
        };
        const mark = schema.mark('link', attrs);

        if (empty && linkText) {
          const node = createTextNode(schema, linkText, mark);

          tr.replaceRangeWith(from, to, node);
        } else {
          tr.addMark(from, to, mark);
        }

        dispatch!(tr.scrollIntoView());

        return true;
      }

      return false;
    };
  }

  private toggleLink(): EditorCommand {
    return (payload) => (state, dispatch) =>
      toggleMark(state.schema.marks.link, payload)(state, dispatch);
  }

  commands() {
    return {
      addLink: this.addLink(),
      toggleLink: this.toggleLink(),
    };
  }
}
