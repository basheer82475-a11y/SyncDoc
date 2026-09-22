import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  createDocument as createDocumentRequest,
  deleteDocument as deleteDocumentRequest,
  getCollaborators,
  getDocuments,
  getToken,
  login,
  logout,
  me,
  register,
  saveSession,
  shareDocument,
  updateDocument,
} from "./api";
import type { Collaborator, Document, User } from "./api";
export type { Document } from "./api";

function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [loading, setLoading] = useState(() => Boolean(getToken()));
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [search, setSearch] = useState("");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<"editor" | "viewer">("editor");
  const [connected, setConnected] = useState(false);

  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const activeDocument = documents.find(
    (doc) => doc.id === activeId
  );

  const loadDocuments = (query = "") => {
    return getDocuments(query)
      .then((loadedDocuments) => {
        setDocuments(loadedDocuments);
        setActiveId(loadedDocuments[0]?.id ?? null);
      })
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : "Unable to load documents.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!getToken()) return;
    me().then(setUser).catch(() => { localStorage.removeItem("syncdoc-token"); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user) return;
    loadDocuments();
  }, [user]);

  useEffect(() => {
    if (!activeId || !user) return;
    getCollaborators(activeId).then(setCollaborators).catch(() => setCollaborators([]));
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws?documentId=${activeId}`);
    socketRef.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as { type: string; document?: Document; actorId?: string };
      if (message.type === "document-updated" && message.document && message.actorId !== user.id) {
        setDocuments((current) => current.map((document) => document.id === message.document!.id ? message.document! : document));
      }
    };
    return () => socket.close();
  }, [activeId, user]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    socketRef.current?.close();
  }, []);

  const queueSave = (document: Document) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaved(false);
    saveTimerRef.current = setTimeout(() => {
      updateDocument(document)
        .then((savedDocument) => {
          setDocuments((current) => current.map((item) => item.id === savedDocument.id ? savedDocument : item));
          setSaved(true);
          setError(null);
        })
        .catch((requestError: unknown) => {
          setSaved(false);
          setError(requestError instanceof Error ? requestError.message : "Unable to save document.");
        });
    }, 500);
  };

  const updateContent = (content: string) => {
    if (!activeDocument) return;
    const oldContent = activeDocument.content;

    setHistory((prev) => [...prev, oldContent]);
    setFuture([]);

    const updatedDocument = { ...activeDocument, content };
    setDocuments((docs) => docs.map((doc) => doc.id === activeId ? updatedDocument : doc));
    queueSave(updatedDocument);
  };

  const updateTitle = (title: string) => {
    if (!activeDocument) return;
    const updatedDocument = { ...activeDocument, title };
    setDocuments((docs) => docs.map((doc) => doc.id === activeId ? updatedDocument : doc));
    queueSave(updatedDocument);
  };

  const createDocument = async () => {
    try {
      const newDocument = await createDocumentRequest({
        title: `Untitled Document ${documents.length + 1}`,
        content: "Start writing your document here...",
      });
      setDocuments((docs) => [...docs, newDocument]);
      setActiveId(newDocument.id);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create document.");
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      await deleteDocumentRequest(id);
      const remainingDocuments = documents.filter((doc) => doc.id !== id);
      setDocuments(remainingDocuments);
      if (id === activeId) setActiveId(remainingDocuments[0]?.id ?? null);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete document.");
    }
  };

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = authMode === "login"
        ? await login(authEmail, authPassword)
        : await register(authName, authEmail, authPassword);
      setUser(saveSession(response));
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to authenticate.");
    }
  };

  const handleLogout = async () => {
    try { await logout(); } catch { /* local session is still cleared */ }
    localStorage.removeItem("syncdoc-token");
    setUser(null);
    setDocuments([]);
  };

  const handleShare = async () => {
    if (!activeId || !shareEmail.trim()) return;
    try {
      await shareDocument(activeId, shareEmail, sharePermission);
      setShareEmail("");
      setCollaborators(await getCollaborators(activeId));
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to share document.");
    }
  };

  const replaceSelectedText = (
    before: string,
    after = before
  ) => {
    const editor = editorRef.current;

    if (!editor || !activeDocument) {
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    const selectedText =
      activeDocument.content.slice(start, end);

    const newText =
      activeDocument.content.slice(0, start) +
      before +
      selectedText +
      after +
      activeDocument.content.slice(end);

    updateContent(newText);

    setTimeout(() => {
      editor.focus();

      editor.setSelectionRange(
        start + before.length,
        end + before.length
      );
    }, 0);
  };

  const makeHeading = (level: 1 | 2) => {
    const editor = editorRef.current;

    if (!editor || !activeDocument) {
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    const content = activeDocument.content;

    const lineStart =
      content.lastIndexOf("\n", start - 1) + 1;

    const selectedEnd =
      content.indexOf("\n", end);

    const lineEnd =
      selectedEnd === -1
        ? content.length
        : selectedEnd;

    const selectedLines =
      content.slice(lineStart, lineEnd);

    const prefix =
      level === 1 ? "# " : "## ";

    const lines = selectedLines.split("\n");

    const formattedLines = lines.map((line) => {
      const cleanLine = line.replace(
        /^#{1,2}\s/,
        ""
      );

      return prefix + cleanLine;
    });

    const newText =
      content.slice(0, lineStart) +
      formattedLines.join("\n") +
      content.slice(lineEnd);

    updateContent(newText);

    setTimeout(() => {
      editor.focus();

      editor.setSelectionRange(
        lineStart,
        lineStart + formattedLines.join("\n").length
      );
    }, 0);
  };

  const makeList = (numbered: boolean) => {
    const editor = editorRef.current;

    if (!editor || !activeDocument) {
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    const content = activeDocument.content;

    const lineStart =
      content.lastIndexOf("\n", start - 1) + 1;

    const selectedEnd =
      content.indexOf("\n", end);

    const lineEnd =
      selectedEnd === -1
        ? content.length
        : selectedEnd;

    const selectedLines =
      content.slice(lineStart, lineEnd);

    const lines = selectedLines.split("\n");

    const formattedLines = lines.map(
      (line, index) => {
        const cleanLine = line.replace(
          /^([-*]|\d+\.)\s/,
          ""
        );

        if (numbered) {
          return `${index + 1}. ${cleanLine}`;
        }

        return `- ${cleanLine}`;
      }
    );

    const newText =
      content.slice(0, lineStart) +
      formattedLines.join("\n") +
      content.slice(lineEnd);

    updateContent(newText);

    setTimeout(() => {
      editor.focus();

      editor.setSelectionRange(
        lineStart,
        lineStart + formattedLines.join("\n").length
      );
    }, 0);
  };

  const undo = () => {
    if (history.length === 0 || !activeDocument) {
      return;
    }

    const previousContent =
      history[history.length - 1];

    setHistory((prev) =>
      prev.slice(0, -1)
    );

    setFuture((prev) => [
      ...prev,
      activeDocument.content,
    ]);

    setDocuments((docs) =>
      docs.map((doc) =>
        doc.id === activeId
          ? {
              ...doc,
              content: previousContent,
            }
          : doc
      )
    );

    queueSave({ ...activeDocument, content: previousContent });
  };

  const redo = () => {
    if (future.length === 0 || !activeDocument) {
      return;
    }

    const nextContent =
      future[future.length - 1];

    setFuture((prev) =>
      prev.slice(0, -1)
    );

    setHistory((prev) => [
      ...prev,
      activeDocument.content,
    ]);

    setDocuments((docs) =>
      docs.map((doc) =>
        doc.id === activeId
          ? {
              ...doc,
              content: nextContent,
            }
          : doc
      )
    );

    queueSave({ ...activeDocument, content: nextContent });
  };

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-panel">
          <div className="logo auth-logo">S</div>
          <p className="eyebrow">SYNC YOUR WORK</p>
          <h1>{authMode === "login" ? "Welcome back" : "Create your workspace"}</h1>
          <p className="auth-copy">A calm, collaborative place for the documents that move your work forward.</p>
          <form onSubmit={submitAuth} className="auth-form">
            {authMode === "register" && <input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Full name" required />}
            <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} type="email" placeholder="Email address" required />
            <input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} type="password" placeholder="Password (6+ characters)" minLength={6} required />
            <button className="primary-action" type="submit">{authMode === "login" ? "Log in" : "Create account"}</button>
          </form>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="text-action" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(null); }}>
            {authMode === "login" ? "New to SyncDoc? Create an account" : "Already have an account? Log in"}
          </button>
          <p className="demo-hint">Use registration to create a demo account.</p>
        </div>
      </div>
    );
  }

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

        .header-user {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #526075;
          font-size: 12px;
          font-weight: 600;
        }

        .logout-button, .text-action {
          border: 0;
          background: transparent;
          color: #635bda;
          cursor: pointer;
          font-weight: 650;
        }

        .logout-button { font-size: 12px; }

        .search-input, .share-input {
          width: 100%;
          border: 1px solid #e1e5ed;
          border-radius: 8px;
          padding: 9px 10px;
          outline: none;
          color: #253047;
          background: #fbfcfe;
        }

        .search-input:focus, .share-input:focus, .auth-form input:focus { border-color: #847be5; box-shadow: 0 0 0 3px #efedff; }

        .sidebar-search { margin: 0 0 14px; }
        .empty-state { padding: 24px 10px; color: #9299a8; font-size: 12px; line-height: 1.6; text-align: center; }
        .share-panel { display: flex; align-items: center; gap: 8px; padding: 8px 28px; background: #fbfcff; border-bottom: 1px solid #e7e9ef; }
        .share-panel select { border: 1px solid #e1e5ed; border-radius: 7px; padding: 8px; background: white; color: #526075; }
        .share-button { padding: 8px 12px; border-radius: 7px; background: #635bda; color: white; cursor: pointer; font-weight: 650; }
        .collaborator-list { display: flex; gap: 5px; align-items: center; color: #9299a8; font-size: 11px; }
        .collaborator-chip { padding: 4px 7px; background: #efedff; color: #635bda; border-radius: 10px; }
        .auth-screen { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at 15% 10%, #eeecff, transparent 35%), #f6f7fb; }
        .auth-panel { width: min(430px, 100%); padding: 42px; border: 1px solid #e4e7ef; border-radius: 18px; background: white; box-shadow: 0 22px 55px rgba(35, 40, 70, .1); }
        .auth-logo { margin-bottom: 28px; }
        .eyebrow { color: #756de0; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
        .auth-panel h1 { margin-top: 10px; color: #172033; font-size: 30px; }
        .auth-copy { margin: 10px 0 26px; color: #7d8798; font-size: 14px; line-height: 1.6; }
        .auth-form { display: grid; gap: 12px; }
        .auth-form input { border: 1px solid #e1e5ed; border-radius: 8px; padding: 12px; outline: none; }
        .primary-action { border: 0; border-radius: 8px; padding: 12px; background: #635bda; color: white; cursor: pointer; font-weight: 700; }
        .auth-error { margin-top: 14px; color: #c2410c; font-size: 12px; }
        .auth-panel .text-action { margin-top: 20px; font-size: 12px; }
        .demo-hint { margin-top: 24px; color: #a0a7b5; font-size: 11px; }

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

        .workspace {
          flex: 1;
          min-height: 0;
          display: flex;
        }

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
        }

        .new-button:hover {
          background: #4338ca;
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
          padding: 10px;
          border-radius: 9px;
          background: transparent;
          color: #667085;
          text-align: left;
          cursor: pointer;
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
        }

        .delete-button {
          width: 25px;
          height: 25px;
          display: none;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
        }

        .document:hover .delete-button {
          display: flex;
        }

        .delete-button:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        .editor-area {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #f6f7fb;
        }

        .error-state {
          padding: 10px 28px;
          background: #fff7ed;
          color: #c2410c;
          border-bottom: 1px solid #fed7aa;
          font-size: 12px;
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
          width: 34px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: transparent;
          color: #667085;
          font-size: 12px;
          cursor: pointer;
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
          font-size: 15px;
          line-height: 1.9;
        }

        .editor::placeholder {
          color: #b7bdc8;
        }

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

          .connection {
            display: none;
          }
        }
      `}</style>

      <div className="app">

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
              {connected ? "Live" : "Offline"}
            </div>

            <div className="header-user">
              <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
              <span>{user.name}</span>
              <button className="logout-button" onClick={handleLogout}>Log out</button>
            </div>
          </div>
        </header>

        <div className="workspace">

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

            <div className="sidebar-search">
              <input className="search-input" value={search} onChange={(event) => { setSearch(event.target.value); setLoading(true); loadDocuments(event.target.value); }} placeholder="Search documents" aria-label="Search documents" />
            </div>

            <div className="documents">
              {documents.length === 0 && !loading && <div className="empty-state">No documents found.<br />Create one to start writing.</div>}
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
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>

          </aside>

          <main className="editor-area">

            {loading && (
              <div className="error-state">Loading documents...</div>
            )}

            {error && (
              <div className="error-state" role="alert">
                {error}
              </div>
            )}

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

                {error
                  ? "Save failed"
                  : saved
                  ? "Saved"
                  : "Saving..."}
              </div>
            </div>

            <div className="format-toolbar">

              <button
                className="tool"
                title="Bold"
                onClick={() =>
                  replaceSelectedText("**")
                }
              >
                <b>B</b>
              </button>

              <button
                className="tool"
                title="Italic"
                onClick={() =>
                  replaceSelectedText("*")
                }
              >
                <i>I</i>
              </button>

              <button
                className="tool"
                title="Underline"
                onClick={() =>
                  replaceSelectedText("__")
                }
              >
                <u>U</u>
              </button>

              <span className="divider" />

              <button
                className="tool"
                title="Heading 1"
                onClick={() => makeHeading(1)}
              >
                H1
              </button>

              <button
                className="tool"
                title="Heading 2"
                onClick={() => makeHeading(2)}
              >
                H2
              </button>

              <span className="divider" />

              <button
                className="tool"
                title="Bullet List"
                onClick={() =>
                  makeList(false)
                }
              >
                •☷
              </button>

              <button
                className="tool"
                title="Numbered List"
                onClick={() =>
                  makeList(true)
                }
              >
                1.
              </button>

              <span className="divider" />

              <button
                className="tool"
                title="Undo"
                onClick={undo}
              >
                ↶
              </button>

              <button
                className="tool"
                title="Redo"
                onClick={redo}
              >
                ↷
              </button>

            </div>

            {activeDocument && <div className="share-panel">
              <input className="share-input" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} placeholder="Share with email" aria-label="Share with email" />
              <select value={sharePermission} onChange={(event) => setSharePermission(event.target.value as "editor" | "viewer")} aria-label="Permission">
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
              <button className="share-button" onClick={handleShare}>Share</button>
            </div>}

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
                  ref={editorRef}
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

            <footer className="editor-footer">
              <span>
                SyncDoc • Collaborative workspace
              </span>

              <div className="collaborators">
                <span>Collaborators</span>
                <div className="collaborator-list">
                  {collaborators.slice(0, 3).map((collaborator) => <span className="collaborator-chip" key={collaborator.id}>{collaborator.name}</span>)}
                </div>
              </div>
            </footer>

          </main>
        </div>
      </div>
    </>
  );
}

export default App;