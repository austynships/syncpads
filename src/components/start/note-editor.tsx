"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/** Rich-text editor for notes (SP-11). Produces HTML; the server sanitizes it on save. */
export function NoteEditor({ initialHtml, onDone }: { initialHtml: string; onDone: (html: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    autofocus: "end",
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
      }),
      Placeholder.configure({ placeholder: "Write a note…" }),
    ],
    content: initialHtml,
    editorProps: { attributes: { class: "note-content min-h-24 px-2 py-1.5 outline-none" } },
  });

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="flex justify-end border-t border-zinc-200 p-1.5 dark:border-zinc-700">
        <button type="button" className="btn-primary" onClick={() => onDone(editor.isEmpty ? "" : editor.getHTML())}>
          Done
        </button>
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (label: string, active: boolean, run: () => void, title: string) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // keep the editor focused
      onClick={run}
      className={`h-7 min-w-7 rounded px-1.5 text-sm ${active ? "bg-zinc-200 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
    >
      {label}
    </button>
  );
  const chain = () => editor.chain().focus();

  return (
    <div className="flex flex-wrap gap-0.5 border-b border-zinc-200 p-1 dark:border-zinc-700">
      {btn("B", editor.isActive("bold"), () => chain().toggleBold().run(), "Bold")}
      {btn("I", editor.isActive("italic"), () => chain().toggleItalic().run(), "Italic")}
      {btn("S", editor.isActive("strike"), () => chain().toggleStrike().run(), "Strikethrough")}
      {btn("H", editor.isActive("heading", { level: 2 }), () => chain().toggleHeading({ level: 2 }).run(), "Heading")}
      {btn("•", editor.isActive("bulletList"), () => chain().toggleBulletList().run(), "Bulleted list")}
      {btn("1.", editor.isActive("orderedList"), () => chain().toggleOrderedList().run(), "Numbered list")}
      {btn("❝", editor.isActive("blockquote"), () => chain().toggleBlockquote().run(), "Quote")}
      {btn("</>", editor.isActive("code"), () => chain().toggleCode().run(), "Code")}
      {btn("🔗", editor.isActive("link"), () => {
        if (editor.isActive("link")) {
          chain().unsetLink().run();
          return;
        }
        const href = window.prompt("Link URL");
        if (href) chain().extendMarkRange("link").setLink({ href }).run();
      }, "Link")}
    </div>
  );
}

