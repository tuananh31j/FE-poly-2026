import {
  BoldOutlined,
  InsertRowLeftOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button, Divider, Space } from 'antd'
import { useEffect, useMemo } from 'react'

interface RichTextEditorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  minHeight?: number
  disabled?: boolean
}

export const RichTextEditor = ({
  value,
  onChange,
  placeholder = 'Nhập nội dung...',
  minHeight = 220,
  disabled = false,
}: RichTextEditorProps) => {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        linkOnPaste: true,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    [placeholder]
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value ?? '',
    editorProps: {
      attributes: {
        class: 'rich-text-editor-content',
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) {
      return
    }

    editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor) {
      return
    }

    const nextValue = value ?? ''
    const currentValue = editor.getHTML()

    if (nextValue !== currentValue) {
      editor.commands.setContent(nextValue, {
        emitUpdate: false,
      })
    }
  }, [editor, value])

  const canUndo = Boolean(editor?.can().chain().focus().undo().run())
  const canRedo = Boolean(editor?.can().chain().focus().redo().run())
  const isDisabled = disabled || !editor

  const handleSetLink = () => {
    if (!editor || disabled) {
      return
    }

    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Nhập URL liên kết', previousUrl ?? 'https://')

    if (url === null) {
      return
    }

    if (!url.trim()) {
      editor.chain().focus().unsetLink().run()
      return
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({
        href: url.trim(),
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      })
      .run()
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 p-2">
        <Space.Compact>
          <Button
            type={editor?.isActive('bold') ? 'primary' : 'default'}
            icon={<BoldOutlined />}
            onClick={() => {
              editor?.chain().focus().toggleBold().run()
            }}
            disabled={isDisabled}
          />
          <Button
            type={editor?.isActive('italic') ? 'primary' : 'default'}
            icon={<ItalicOutlined />}
            onClick={() => {
              editor?.chain().focus().toggleItalic().run()
            }}
            disabled={isDisabled}
          />
          <Button
            type={editor?.isActive('underline') ? 'primary' : 'default'}
            icon={<UnderlineOutlined />}
            onClick={() => {
              editor?.chain().focus().toggleUnderline().run()
            }}
            disabled={isDisabled}
          />
          <Button
            type={editor?.isActive('strike') ? 'primary' : 'default'}
            icon={<StrikethroughOutlined />}
            onClick={() => {
              editor?.chain().focus().toggleStrike().run()
            }}
            disabled={isDisabled}
          />
        </Space.Compact>

        <Divider type="vertical" className="!h-8" />

        <Space.Compact>
          <Button
            type={editor?.isActive('heading', { level: 2 }) ? 'primary' : 'default'}
            onClick={() => {
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }}
            disabled={isDisabled}
          >
            H2
          </Button>

          <Button
            type={editor?.isActive('heading', { level: 3 }) ? 'primary' : 'default'}
            onClick={() => {
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }}
            disabled={isDisabled}
          >
            H3
          </Button>

          <Button
            type={editor?.isActive('paragraph') ? 'primary' : 'default'}
            onClick={() => {
              editor?.chain().focus().setParagraph().run()
            }}
            disabled={isDisabled}
          >
            P
          </Button>
        </Space.Compact>

        <Divider type="vertical" className="!h-8" />

        <Space.Compact>
          <Button
            type={editor?.isActive('bulletList') ? 'primary' : 'default'}
            icon={<UnorderedListOutlined />}
            onClick={() => {
              editor?.chain().focus().toggleBulletList().run()
            }}
            disabled={isDisabled}
          />
          <Button
            type={editor?.isActive('orderedList') ? 'primary' : 'default'}
            icon={<OrderedListOutlined />}
            onClick={() => {
              editor?.chain().focus().toggleOrderedList().run()
            }}
            disabled={isDisabled}
          />
          <Button
            type={editor?.isActive('blockquote') ? 'primary' : 'default'}
            icon={<InsertRowLeftOutlined />}
            onClick={() => {
              editor?.chain().focus().toggleBlockquote().run()
            }}
            disabled={isDisabled}
          />
          <Button
            type={editor?.isActive('link') ? 'primary' : 'default'}
            icon={<LinkOutlined />}
            onClick={handleSetLink}
            disabled={isDisabled}
          />
        </Space.Compact>

        <Divider type="vertical" className="!h-8" />

        <Space.Compact>
          <Button
            icon={<UndoOutlined />}
            onClick={() => {
              editor?.chain().focus().undo().run()
            }}
            disabled={isDisabled || !canUndo}
          />
          <Button
            icon={<RedoOutlined />}
            onClick={() => {
              editor?.chain().focus().redo().run()
            }}
            disabled={isDisabled || !canRedo}
          />
        </Space.Compact>
      </div>

      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
