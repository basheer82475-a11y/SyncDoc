import { useState } from "react";

export type Document = {
  id: number;
  title: string;
  content: string;
};

function App() {
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: 1,
      title: "Project Requirements",
      content:
        "Welcome to SyncDoc. This is a collaborative document editor.\n\nStart writing your document here. Multiple users can edit this document together in real time.",
    },
    {
      id: 2,
      title: "Meeting Notes",
      content: "Add your meeting notes here...",
    },
    {
      id: 3,
      title: "Ideas",
      content: "Write your project ideas here...",
    },
  ]);

  const [activeId, setActiveId] = useState(1);
  const [saved, setSaved] = useState(true);

  const activeDocument = documents.find(
    (doc) => doc.id === activeId
  );

  const updateContent = (content: string) => {
    setDocuments((docs) =>
      docs.map((doc) =>
        doc.id === activeId
          ? { ...doc, content }
          : doc
      )
    );

    setSaved(false);

    setTimeout(() => {
      setSaved(true);
    }, 700);
  };

  const updateTitle = (title: string) => {
    setDocuments((docs) =>
      docs.map((doc) =>
        doc.id === activeId
          ? { ...doc, title }
          : doc
      )
    );

    setSaved(false);

    setTimeout(() => {
      setSaved(true);
    }, 700);
  };

  const createDocument = () => {
    const newDocument: Document = {
      id: Date.now(),
      title: `Untitled Document ${documents.length + 1}`,
      content: "Start writing your document here...",
    };

    setDocuments((docs) => [
      ...docs,
      newDocument,
    ]);

    setActiveId(newDocument.id);
  };

  const deleteDocument = (id: number) => {
    if (documents.length === 1) {
      return;
    }

    const remainingDocuments = documents.filter(
      (doc) => doc.id !== id
    );

    setDocuments(remainingDocuments);

    if (id === activeId) {
      setActiveId(remainingDocuments[0].id);
    }
  };

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: Inter, Arial, sans-serif;
          background: #f6f7fb;
          color: #172033;
        }

        button,
        input,
        textarea {
          font-family: inherit;
        }

        button {
          border: none;
        }

        .app {
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* HEADER */

        .header {
          height: 68px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 26px;
          background: white;
          border-bottom: 1px solid #e7e9ef;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: linear-gradient(
            135deg,
            #4f46e5,
            #7c3aed
          );
          color: white;
          font-size: 18px;
          font-weight: 800;
          box-shadow:
            0 7px 18px rgba(79, 70, 229, 0.24);
        }

        .brand-info h1 {
          font-size: 18px;
          line-height: 20px;
          font-weight: 750;
          color: #111827;
        }

        .brand-info p {
          margin-top: 2px;
          font-size: 11px;
          color: #9299a8;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .connection {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 11px;
          border-radius: 20px;
          background: #f0fdf4;
          color: #15803d;
          font-size: 12px;
          font-weight: 650;
        }

        .connection-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 3px #dcfce7;
        }

        .avatar {
          width: 35px;
          height: 35px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ede9fe;
          color: #5b21b6;
          font-size: 12px;
          font-weight: 750;
        }

        /* WORKSPACE */

        .workspace {
          flex: 1;
          min-height: 0;
          display: flex;
        }

        /* SIDEBAR */

        .sidebar {
          width: 265px;
          flex-shrink: 0;
          padding: 22px 14px;
          background: white;
          border-right: 1px solid #e7e9ef;
        }

        .sidebar-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 7px;
          margin-bottom: 18px;
        }

        .sidebar-title {
          font-size: 12px;
          font-weight: 750;
          color: #667085;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .new-button {
          padding: 8px 12px;
          border-radius: 8px;
          background: #4f46e5;
          color: white;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s;
        }

        .new-button:hover {
          background: #4338ca;
          transform: translateY(-1px);
        }

        .documents {
          display: flex;
          flex-direction: column;
          gap: 5px;
          overflow-y: auto;
        }

        .document {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 8px 10px 10px;
          border-radius: 9px;
          background: transparent;
          color: #667085;
          text-align: left;
          cursor: pointer;
          transition: 0.18s;
        }

        .document:hover {
          background: #f7f7ff;
          color: #4f46e5;
        }

        .document.active {
          background: #eef2ff;
          color: #4338ca;
        }

        .document-icon {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: #f3f4f6;
          font-size: 12px;
        }

        .document.active .document-icon {
          background: #e0e7ff;
        }

        .document-name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 13px;
          font-weight: 550;
        }

        .document.active .document-name {
          font-weight: 700;
        }

        .delete-button {
          width: 25px;
          height: 25px;
          flex-shrink: 0;
          display: none;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          font-size: 13px;
        }

        .document:hover .delete-button {
          display: flex;
        }

        .delete-button:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        /* EDITOR */

        .editor-area {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #f6f7fb;
        }

        .editor-topbar {
          height: 52px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          background: white;
          border-bottom: 1px solid #e7e9ef;
        }

        .editing-label {
          display: flex;
          gap: 6px;
          font-size: 12px;
          color: #98a0ae;
        }

        .editing-label strong {
          color: #374151;
          font-weight: 650;
        }

        .save-status {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 600;
        }

        .saved {
          color: #16a34a;
        }

        .saving {
          color: #d97706;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .saved-dot {
          background: #22c55e;
        }

        .saving-dot {
          background: #f59e0b;
        }

        /* TOOLBAR */

        .format-toolbar {
          height: 50px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          padding: 0 28px;
          gap: 3px;
          background: white;
          border-bottom: 1px solid #e7e9ef;
        }

        .tool {
          width: 32px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: transparent;
          color: #667085;
          font-size: 12px;
          cursor: pointer;
          transition: 0.15s;
        }

        .tool:hover {
          background: #f2f4f7;
          color: #111827;
        }

        .divider {
          width: 1px;
          height: 20px;
          margin: 0 8px;
          background: #e5e7eb;
        }

        /* DOCUMENT */

        .document-container {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 38px 30px;
        }

        .paper {
          width: 100%;
          max-width: 900px;
          min-height: 650px;
          margin: 0 auto;
          padding: 58px 72px 65px;
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 13px;
          box-shadow:
            0 10px 30px rgba(15, 23, 42, 0.05),
            0 2px 6px rgba(15, 23, 42, 0.025);
        }

        .paper-title {
          width: 100%;
          margin-bottom: 8px;
          border: none;
          outline: none;
          background: transparent;
          color: #111827;
          font-size: 31px;
          line-height: 1.25;
          font-weight: 750;
          letter-spacing: -0.035em;
        }

        .paper-title::placeholder {
          color: #c4c8d0;
        }

        .paper-subtitle {
          margin-bottom: 34px;
          color: #a0a7b4;
          font-size: 11px;
        }

        .editor {
          display: block;
          width: 100%;
          min-height: 430px;
          border: none;
          outline: none;
          resize: vertical;
          background: transparent;
          color: #3f4755;
          font-family: inherit;
          font-size: 15px;
          line-height: 1.9;
        }

        .editor::placeholder {
          color: #b7bdc8;
        }

        /* FOOTER */

        .editor-footer {
          height: 42px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          background: white;
          border-top: 1px solid #e7e9ef;
          color: #a0a7b4;
          font-size: 10px;
        }

        .collaborators {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .mini-avatar {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #ede9fe;
          color: #5b21b6;
          font-size: 8px;
          font-weight: 750;
        }

        @media (max-width: 700px) {
          .sidebar {
            width: 210px;
          }

          .paper {
            padding: 35px 30px;
          }

          .header {
            padding: 0 15px;
          }

          .connection {
            display: none;
          }
        }
      `}</style>

      <div className="app">

        {/* HEADER */}
        <header className="header">
          <div className="brand">
            <div className="logo">S</div>

            <div className="brand-info">
              <h1>SyncDoc</h1>
              <p>
                Collaborative Document Editor
              </p>
            </div>
          </div>

          <div className="header-right">
            <div className="connection">
              <span className="connection-dot" />
              Connected
            </div>

            <div className="avatar">SB</div>
          </div>
        </header>

        <div className="workspace">

          {/* SIDEBAR */}
          <aside className="sidebar">
            <div className="sidebar-top">
              <span className="sidebar-title">
                Documents
              </span>

              <button
                className="new-button"
                onClick={createDocument}
              >
                + New
              </button>
            </div>

            <div className="documents">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  className={`document ${
                    activeId === doc.id
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setActiveId(doc.id)
                  }
                >
                  <span className="document-icon">
                    📄
                  </span>

                  <span className="document-name">
                    {doc.title}
                  </span>

                  <span
                    className="delete-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteDocument(doc.id);
                    }}
                    title="Delete document"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {/* EDITOR */}
          <main className="editor-area">

            <div className="editor-topbar">
              <div className="editing-label">
                <span>Editing</span>

                <strong>
                  {activeDocument?.title ||
                    "Untitled"}
                </strong>
              </div>

              <div
                className={`save-status ${
                  saved ? "saved" : "saving"
                }`}
              >
                <span
                  className={`status-dot ${
                    saved
                      ? "saved-dot"
                      : "saving-dot"
                  }`}
                />

                {saved ? "Saved" : "Saving..."}
              </div>
            </div>

            {/* TOOLBAR */}
            <div className="format-toolbar">
              <button className="tool">
                <b>B</b>
              </button>

              <button className="tool">
                <i>I</i>
              </button>

              <button className="tool">
                <u>U</u>
              </button>

              <span className="divider" />

              <button className="tool">
                H1
              </button>

              <button className="tool">
                H2
              </button>

              <span className="divider" />

              <button className="tool">
                ☷
              </button>

              <button className="tool">
                ☰
              </button>

              <span className="divider" />

              <button className="tool">
                ↶
              </button>

              <button className="tool">
                ↷
              </button>
            </div>

            {/* PAPER */}
            <div className="document-container">
              <div className="paper">

                <input
                  className="paper-title"
                  value={
                    activeDocument?.title || ""
                  }
                  onChange={(e) =>
                    updateTitle(
                      e.target.value
                    )
                  }
                  placeholder="Untitled document"
                />

                <div className="paper-subtitle">
                  Collaborative document •
                  Last edited just now
                </div>

                <textarea
                  className="editor"
                  value={
                    activeDocument?.content || ""
                  }
                  onChange={(e) =>
                    updateContent(
                      e.target.value
                    )
                  }
                  placeholder="Start writing your document here..."
                />

              </div>
            </div>

            {/* FOOTER */}
            <footer className="editor-footer">
              <span>
                SyncDoc • Collaborative workspace
              </span>

              <div className="collaborators">
                <span>Collaborators</span>
                <span className="mini-avatar">
                  SB
                </span>
              </div>
            </footer>

          </main>
        </div>
      </div>
    </>
  );
}

export default App;