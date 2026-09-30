import type { Document } from '../App'

type SidebarProps = {
  documents: Document[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}

function Sidebar({
  documents,
  activeId,
  onSelect,
  onCreate,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <span className="sidebar-title">Documents</span>

        <button
          className="new-button"
          onClick={onCreate}
        >
          + New
        </button>
      </div>

      <div className="documents">
        {documents.map((document) => (
          <div
            key={document.id}
            className={`document ${
              activeId === document.id ? 'active' : ''
            }`}
            onClick={() => onSelect(document.id)}
          >
            <span className="document-icon">📄</span>

            <span className="document-name">
              {document.title}
            </span>
          </div>
        ))}
      </div>
    </aside>
  )
}

export default Sidebar