import { useState } from "react";

type Document = {
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

  const activeDocument = documents.find((doc) => doc.id === activeId);

  const updateContent = (content: string) => {
    setDocuments((docs) =>
      docs.map((doc) =>
        doc.id === activeId ? { ...doc, content } : doc
      )
    );
    setSaved(false);

    setTimeout(() => setSaved(true), 700);
  };

  const createDocument = () => {
    const newDocument: Document = {
      id: Date.now(),
      title: `Untitled Document ${documents.length + 1}`,
      content: "Start writing your document here...",
    };

    setDocuments([...documents, newDocument]);
    setActiveId(newDocument.id);
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
          background: #f5f7fb;
          color: #172033;
        }

        button {
          font-family: inherit;
        }

        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* HEADER */

        .header {
          height: 72px;
          background: white;
          border-bottom: 1px solid #e6e9ef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
          font-weight: 800;
          box-shadow: 0 6px 18px rgba(79, 70, 229, 0.25);
        }

        .brand h1 {
          font-size: 20px;
          font-weight: 750;
          color: #111827;
        }

        .brand p {
          font-size: 12px;
          color: #8a93a3;
          margin-top: 2px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .connection {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #16a34a;
          font-size: 13px;
          font-weight: 600;
        }

        .connection-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 4px #dcfce7;
        }

        .avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #ede9fe;
          color: #5b21b6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
        }

        /* MAIN */

        .workspace {
          flex: 1;
          display: flex;
          min-height: calc(100vh - 72px);
        }

        /* SIDEBAR */

        .sidebar {
          width: 270px;
          background: white;
          border-right: 1px solid #e6e9ef;
          padding: 24px 16px;
          flex-shrink: 0;
        }

        .sidebar-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 0 5px;
        }

        .sidebar-title {
          font-size: 14px;
          font-weight: 750;
          color: #4b5563;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .new-button {
          border: none;
          background: #4f46e5;
          color: white;
          height: 34px;
          padding: 0 12px;
          border-radius: 8px;
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
        }

        .document {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px;
          border-radius: 9px;
          cursor: pointer;
          color: #596273;
          transition: 0.2s;
        }

        .document:hover {
          background: #f5f3ff;
          color: #4f46e5;
        }

        .document.active {
          background: #eef2ff;
          color: #4338ca;
          font-weight: 650;
        }

        .document-icon {
          font-size: 15px;
        }

        .document-name {
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* EDITOR AREA */

        .editor-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .editor-toolbar {
          height: 58px;
          background: white;
          border-bottom: 1px solid #e6e9ef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
        }

        .editing-label {
          color: #8a93a3;
          font-size: 13px;
        }

        .editing-label strong {
          color: #374151;
          font-weight: 650;
        }

        .saved {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #16a34a;
          font-size: 12px;
          font-weight: 600;
        }

        .saved-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
        }

        /* TOOLBAR */

        .format-toolbar {
          background: white;
          border-bottom: 1px solid #e6e9ef;
          padding: 9px 28px;
          display: flex;
          gap: 5px;
        }

        .tool {
          border: 1px solid transparent;
          background: transparent;
          width: 34px;
          height: 32px;
          border-radius: 6px;
          color: #596273;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }

        .tool:hover {
          background: #f3f4f6;
          border-color: #e5e7eb;
        }

        .divider {
          width: 1px;
          background: #e5e7eb;
          margin: 0 7px;
        }

        /* DOCUMENT */

        .document-container {
          flex: 1;
          padding: 42px 30px;
          overflow-y: auto;
        }

        .paper {
          max-width: 900px;
          min-height: 650px;
          margin: 0 auto;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
          padding: 55px 70px;
        }

        .paper-title {
          font-size: 30px;
          font-weight: 750;
          color: #111827;
          margin-bottom: 14px;
          border: none;
          outline: none;
          width: 100%;
        }

        .paper-subtitle {
          color: #9ca3af;
          font-size: 13px;
          margin-bottom: 32px;
        }

        .editor {
          width: 100%;
          min-height: 430px;
          resize: vertical;
          border: none;
          outline: none;
          font-family: Inter, Arial, sans-serif;
          font-size: 16px;
          line-height: 1.8;
          color: #374151;
          background: transparent;
        }

        .editor::placeholder {
          color: #b5bbc6;
        }

        /* FOOTER */

        .editor-footer {
          height: 45px;
          background: white;
          border-top: 1px solid #e6e9ef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          color: #9ca3af;
          font-size: 11px;
        }

        .collaborators {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .mini-avatar {
          width: 23px;
          height: 23px;
          border-radius: 50%;
          background: #e0e7ff;
          color: #4338ca;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 700;
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

            <div>
              <h1>SyncDoc</h1>
              <p>Collaborative Document Editor</p>
            </div>
          </div>

          <div className="header-right">
            <div className="connection">
              <span className="connection-dot"></span>
              Connected
            </div>

            <div className="avatar">SB</div>
          </div>
        </header>

        <div className="workspace">

          {/* SIDEBAR */}
          <aside className="sidebar">
            <div className="sidebar-top">
              <span className="sidebar-title">Documents</span>

              <button
                className="new-button"
                onClick={createDocument}
              >
                + New
              </button>
            </div>

            <div className="documents">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`document ${
                    activeId === doc.id ? "active" : ""
                  }`}
                  onClick={() => setActiveId(doc.id)}
                >
                  <span className="document-icon">📄</span>

                  <span className="document-name">
                    {doc.title}
                  </span>
                </div>
              ))}
            </div>
          </aside>

          {/* EDITOR */}
          <main className="editor-area">

            <div className="editor-toolbar">
              <div className="editing-label">
                Editing <strong>{activeDocument?.title}</strong>
              </div>

              <div className="saved">
                <span className="saved-dot"></span>
                {saved ? "Saved" : "Saving..."}
              </div>
            </div>

            {/* FORMATTING BAR */}
            <div className="format-toolbar">
              <button className="tool"><b>B</b></button>
              <button className="tool"><i>I</i></button>
              <button className="tool"><u>U</u></button>

              <span className="divider"></span>

              <button className="tool">H1</button>
              <button className="tool">H2</button>

              <span className="divider"></span>

              <button className="tool">☷</button>
              <button className="tool">☰</button>

              <span className="divider"></span>

              <button className="tool">↶</button>
              <button className="tool">↷</button>
            </div>

            {/* PAPER */}
            <div className="document-container">
              <div className="paper">

                <input
                  className="paper-title"
                  value={activeDocument?.title || ""}
                  onChange={(e) => {
                    setDocuments((docs) =>
                      docs.map((doc) =>
                        doc.id === activeId
                          ? { ...doc, title: e.target.value }
                          : doc
                      )
                    );
                  }}
                />

                <div className="paper-subtitle">
                  Collaborative document • Last edited just now
                </div>

                <textarea
                  className="editor"
                  value={activeDocument?.content || ""}
                  onChange={(e) =>
                    updateContent(e.target.value)
                  }
                  placeholder="Start writing your document here..."
                />

              </div>
            </div>

            {/* FOOTER */}
            <footer className="editor-footer">
              <div>
                SyncDoc • Collaborative workspace
              </div>

              <div className="collaborators">
                <span>Collaborators</span>
                <span className="mini-avatar">SB</span>
              </div>
            </footer>

          </main>
        </div>
      </div>
    </>
  );
}

export default App;