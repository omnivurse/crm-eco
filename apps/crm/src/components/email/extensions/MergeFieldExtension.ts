import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

export interface MergeFieldOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mergeField: {
      /**
       * Insert a merge field
       */
      insertMergeField: (fieldKey: string, label: string) => ReturnType;
    };
  }
}

export const MergeFieldExtension = Node.create<MergeFieldOptions>({
  name: 'mergeField',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      fieldKey: {
        default: null,
        parseHTML: element => element.getAttribute('data-field-key'),
        renderHTML: attributes => ({
          'data-field-key': attributes.fieldKey,
        }),
      },
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-label'),
        renderHTML: attributes => ({
          'data-label': attributes.label,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-merge-field]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        {
          'data-merge-field': '',
          class: 'merge-field-pill',
          contenteditable: 'false',
        }
      ),
      `{{${node.attrs.fieldKey}}}`,
    ];
  },

  addCommands() {
    return {
      insertMergeField:
        (fieldKey: string, label: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              fieldKey,
              label,
            },
          });
        },
    };
  },

  // Render as plain merge field syntax for HTML output
  renderText({ node }) {
    return `{{${node.attrs.fieldKey}}}`;
  },
});

export default MergeFieldExtension;
