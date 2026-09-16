import { useState } from 'react'

type EditorProps = {
  documentName: string
}

type BlockType = 'paragraph' | 'heading' | 'code'

type Block = {
  id: number
  type: BlockType
  content: string
}

function Editor({ documentName }: EditorProps) {
  const [blocks, setBlocks] = useState<Block[]>([
    {
      id: 1,
      type: 'heading',
      content: documentName,
    },
    {
      id: 2,
      type: 'paragraph',
      content:
        'Welcome to SyncDoc. This is a collaborative document editor.',
    },
  ])

  const updateBlock = (id: number, content: string) => {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.id === id ? { ...block, content } : block,
      ),
    )
  }

  const addBlock = (type: BlockType) => {
    const newBlock: Block = {
      id: Date.now(),
      type,
      content: '',
    }

    setBlocks((currentBlocks) => [...currentBlocks, newBlock])
  }

  return (
    <section className="editor">
      <div className="editor-toolbar">
        <span>Editing: {documentName}</span>

        <span className="saved-status">Saved</span>
      </div>

      <div className="block-toolbar">
        <button onClick={() => addBlock('paragraph')}>
          + Paragraph
        </button>

        <button onClick={() => addBlock('heading')}>
          + Heading
        </button>

        <button onClick={() => addBlock('code')}>
          + Code
        </button>
      </div>

      <div className="editor-content">
        {blocks.map((block) => (
          <div className="editor-block" key={block.id}>
            {block.type === 'heading' && (
              <input
                className="block-heading"
                value={block.content}
                placeholder="Heading"
                onChange={(event) =>
                  updateBlock(block.id, event.target.value)
                }
              />
            )}

            {block.type === 'paragraph' && (
              <textarea
                className="block-paragraph"
                value={block.content}
                placeholder="Write something..."
                rows={3}
                onChange={(event) =>
                  updateBlock(block.id, event.target.value)
                }
              />
            )}

            {block.type === 'code' && (
              <textarea
                className="block-code"
                value={block.content}
                placeholder="// Write code..."
                rows={5}
                onChange={(event) =>
                  updateBlock(block.id, event.target.value)
                }
              />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default Editor