import { useEffect, useRef, useState, type FormEvent } from "react";
import "./landing.css";
import {
  createDocument as createDocumentRequest,
  deleteDocument as deleteDocumentRequest,
  getCollaborators,
  getDocuments,
  getRegisteredUsers,
  getToken,
  login,
  logout,
  me,
  register,
  removeCollaborator as removeCollaboratorRequest,
  saveSession,
  setRegisteredUserStatus,
  shareDocument,
  updateDocument,
} from "./api";
import type { AccountStatus, Collaborator, Document, RegisteredUser, User } from "./api";
export type { Document } from "./api";

const demoRegisteredUsers: RegisteredUser[] = [
  { id: "demo-admin", name: "Admin", email: "basheer82475@gmail.com", role: "admin", status: "active", createdAt: new Date(Date.now() - 120 * 86400000).toISOString() },
  { id: "demo-writer", name: "Taylor Morgan", email: "writer@syncdoc.app", role: "user", status: "active", createdAt: new Date(Date.now() - 90 * 86400000).toISOString() },
  { id: "demo-user-1", name: "Riya Shah", email: "riya.shah@example.com", role: "user", status: "active", createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: "demo-user-2", name: "Dev Nair", email: "dev.nair@example.com", role: "user", status: "active", createdAt: new Date(Date.now() - 12 * 86400000).toISOString() },
  { id: "demo-user-3", name: "Emma Chen", email: "emma.chen@example.com", role: "user", status: "active", createdAt: new Date(Date.now() - 24 * 86400000).toISOString() },
];

type AdminActivity = { id: string; message: string; createdAt: string };

const demoAdminActivity: AdminActivity[] = [
  { id: "demo-activity-riya", message: "Riya Shah joined the workspace", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "demo-activity-emma", message: "Emma Chen joined the workspace", createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
  { id: "demo-activity-dev", message: "Dev Nair joined the workspace", createdAt: new Date(Date.now() - 12 * 86400000).toISOString() },
];

function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [demoMode, setDemoMode] = useState(() => getToken() === "syncdoc-demo");
  const [loading, setLoading] = useState(() => Boolean(getToken()) && getToken() !== "syncdoc-demo");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    if (getToken() !== "syncdoc-demo") return null;
    try {
      const storedUser = JSON.parse(localStorage.getItem("syncdoc-demo-user") || "null") as User | null;
      return storedUser ? { ...storedUser, role: storedUser.role || "admin" } : null;
    }
    catch { return null; }
  });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [search, setSearch] = useState("");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<"editor" | "viewer">("editor");
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [connected, setConnected] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminRoleFilter, setAdminRoleFilter] = useState<"all" | "user" | "admin">("all");
  const [adminStatusFilter, setAdminStatusFilter] = useState<"all" | AccountStatus>("all");
  const [adminActivity, setAdminActivity] = useState<AdminActivity[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (deleteTarget) cancelDeleteRef.current?.focus();
  }, [deleteTarget]);

  const announce = (message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3200);
  };

  const activeDocument = documents.find(
    (doc) => doc.id === activeId
  );
  const editorText = activeDocument?.content || "";
  const editorWordCount = editorText.trim() ? editorText.trim().split(/\s+/).length : 0;

  const findNextInDocument = () => {
    const editor = editorRef.current;
    const query = findQuery.trim();
    if (!editor || !query) return;
    const content = editor.value.toLowerCase();
    const needle = query.toLowerCase();
    const currentSelection = editor.selectionEnd;
    const nextMatch = content.indexOf(needle, currentSelection);
    const match = nextMatch >= 0 ? nextMatch : content.indexOf(needle, 0);
    if (match < 0) {
      announce("No matches found in this document.");
      return;
    }
    editor.focus();
    editor.setSelectionRange(match, match + needle.length);
  };

  const visibleRegisteredUsers = registeredUsers.filter((registeredUser) =>
    `${registeredUser.name} ${registeredUser.email} ${registeredUser.role || "user"}`.toLowerCase().includes(adminSearch.trim().toLowerCase()) &&
    (adminRoleFilter === "all" || (registeredUser.role || "user") === adminRoleFilter) &&
    (adminStatusFilter === "all" || (registeredUser.status || "active") === adminStatusFilter)
  );
  const adminCount = registeredUsers.filter((registeredUser) => registeredUser.role === "admin").length;
  const memberCount = registeredUsers.length - adminCount;
  const recentSignupCount = registeredUsers.filter((registeredUser) => Date.now() - new Date(registeredUser.createdAt).getTime() <= 30 * 86400000).length;

  const downloadRegisteredUsers = () => {
    const cell = (value: string) => {
      const safeValue = /^[\t\r=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replace(/"/g, '""')}"`;
    };
    const rows = [
      ["Name", "Email", "Role", "Status", "Registered on"],
      ...registeredUsers.map((registeredUser) => [
        registeredUser.name,
        registeredUser.email,
        registeredUser.role || "user",
        registeredUser.status || "active",
        new Date(registeredUser.createdAt).toISOString(),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}`;
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `syncdoc-registered-users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    announce("Excel-compatible user list downloaded.");
  };

  const demoDocuments = (): Document[] => {
    try {
      const stored = localStorage.getItem("syncdoc-demo-documents");
      if (stored) return JSON.parse(stored) as Document[];
    } catch { /* Use starter documents if local data is unavailable. */ }
    const now = new Date().toISOString();
    return [
      { id: "demo-welcome", title: "Welcome to SyncDoc", content: "# Your ideas, in sync\n\nThis is your private demo workspace. Write, edit, and organize your thoughts here. Changes are saved in this browser.\n\n## Getting started\n\n- Rename this document\n- Create a new document from the sidebar\n- Try the formatting toolbar", createdAt: now, updatedAt: now, permission: "owner" },
      { id: "demo-planning", title: "Project notes", content: "# Project notes\n\nUse this space to capture plans, decisions, and next steps.\n\n## Next steps\n\n1. Add your first idea\n2. Shape it into a plan\n3. Share it with your team when you connect the backend", createdAt: now, updatedAt: now, permission: "owner" },
    ];
  };

  const loadDocuments = (query = "") => {
    if (demoMode) {
      const localDocuments = demoDocuments();
      const filtered = localDocuments.filter((doc) => doc.title.toLowerCase().includes(query.toLowerCase()));
      setDocuments(filtered);
      setActiveId((currentId) => filtered.some((doc) => doc.id === currentId) ? currentId : filtered[0]?.id ?? null);
      setLoading(false);
      return Promise.resolve();
    }
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
    if (demoMode) return;
    if (!getToken()) return;
    me().then(setUser).catch(() => { localStorage.removeItem("syncdoc-token"); setLoading(false); });
  }, [demoMode]);

  useEffect(() => {
    if (!user) return;
    loadDocuments();
  }, [user, demoMode]);

  useEffect(() => {
    if (!showAdmin || !user || user.role !== "admin") return;
    if (demoMode) {
      let demoUsers = demoRegisteredUsers;
      try {
        const storedUsers = localStorage.getItem("syncdoc-demo-users");
        if (storedUsers) demoUsers = JSON.parse(storedUsers) as RegisteredUser[];
      } catch { /* Keep the built-in demo directory if storage is unreadable. */ }
      setRegisteredUsers(demoUsers);
      try {
        const storedActivity = localStorage.getItem("syncdoc-demo-activity");
        setAdminActivity(storedActivity ? JSON.parse(storedActivity) as AdminActivity[] : demoAdminActivity);
      } catch { setAdminActivity(demoAdminActivity); }
      setAdminError(null);
      setAdminLoading(false);
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    getRegisteredUsers()
      .then(setRegisteredUsers)
      .catch((requestError: unknown) => setAdminError(requestError instanceof Error ? requestError.message : "Unable to load registered users."))
      .finally(() => setAdminLoading(false));
  }, [showAdmin, user, demoMode]);

  const changeRegisteredUserStatus = async (target: RegisteredUser, status: AccountStatus) => {
    if (target.email.toLowerCase() === user?.email.toLowerCase()) {
      setAdminError("You cannot change the status of your own administrator account.");
      return;
    }
    setAdminError(null);
    if (demoMode) {
      const updatedUsers = registeredUsers.map((registeredUser) => registeredUser.id === target.id ? { ...registeredUser, status } : registeredUser);
      localStorage.setItem("syncdoc-demo-users", JSON.stringify(updatedUsers));
      setRegisteredUsers(updatedUsers);
      recordAdminActivity(`${target.name} was ${status === "active" ? "reinstated" : status} by ${user?.name || "Admin"}`);
      announce(status === "active" ? `${target.name} has access again.` : `${target.name} is now ${status}.`);
      return;
    }
    try {
      const updatedUser = await setRegisteredUserStatus(target.id, status);
      setRegisteredUsers((current) => current.map((registeredUser) => registeredUser.id === target.id ? updatedUser : registeredUser));
      recordAdminActivity(`${target.name} was ${status === "active" ? "reinstated" : status} by ${user?.name || "Admin"}`);
      announce(status === "active" ? `${target.name} has access again.` : `${target.name} is now ${status}.`);
    } catch (requestError) {
      setAdminError(requestError instanceof Error ? requestError.message : "Unable to update this user's status.");
    }
  };

  const recordAdminActivity = (message: string) => {
    const activity = { id: `activity-${Date.now()}`, message, createdAt: new Date().toISOString() };
    setAdminActivity((current) => {
      const updated = [activity, ...current].slice(0, 8);
      try { localStorage.setItem("syncdoc-demo-activity", JSON.stringify(updated)); } catch { /* Activity remains visible until reload. */ }
      return updated;
    });
  };

  useEffect(() => {
    if (!activeId || !user) return;
    if (demoMode) {
      try {
        const shares = JSON.parse(localStorage.getItem("syncdoc-demo-shares") || "{}") as Record<string, Collaborator[]>;
        setCollaborators(shares[activeId] || []);
      } catch { setCollaborators([]); }
      return;
    }
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
  }, [activeId, user, demoMode]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    socketRef.current?.close();
  }, []);

  const queueSave = (document: Document) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaved(false);
    saveTimerRef.current = setTimeout(() => {
      if (demoMode) {
        const localDocuments = demoDocuments().map((item) => item.id === document.id ? { ...document, updatedAt: new Date().toISOString() } : item);
        localStorage.setItem("syncdoc-demo-documents", JSON.stringify(localDocuments));
        setDocuments((current) => current.map((item) => item.id === document.id ? localDocuments.find((savedItem) => savedItem.id === document.id)! : item));
        setSaved(true);
        return;
      }
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
      if (demoMode) {
        const now = new Date().toISOString();
        const newDocument: Document = { id: `demo-${Date.now()}`, title: `Untitled Document ${documents.length + 1}`, content: "Start writing your document here...", createdAt: now, updatedAt: now, permission: "owner" };
        const allDocuments = demoDocuments();
        localStorage.setItem("syncdoc-demo-documents", JSON.stringify([...allDocuments, newDocument]));
        setDocuments((docs) => [...docs, newDocument]);
        setActiveId(newDocument.id);
        setShowHome(false);
        setError(null);
        announce("Document created.");
        return;
      }
      const newDocument = await createDocumentRequest({
        title: `Untitled Document ${documents.length + 1}`,
        content: "Start writing your document here...",
      });
      setDocuments((docs) => [...docs, newDocument]);
      setActiveId(newDocument.id);
      setShowHome(false);
      setError(null);
      announce("Document created.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create document.");
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      if (demoMode) {
        const remaining = demoDocuments().filter((doc) => doc.id !== id);
        localStorage.setItem("syncdoc-demo-documents", JSON.stringify(remaining));
        setDocuments(remaining);
        if (id === activeId) setActiveId(remaining[0]?.id ?? null);
        setError(null);
        announce("Document deleted.");
        return;
      }
      await deleteDocumentRequest(id);
      const remainingDocuments = documents.filter((doc) => doc.id !== id);
      setDocuments(remainingDocuments);
      if (id === activeId) setActiveId(remainingDocuments[0]?.id ?? null);
      setError(null);
      announce("Document deleted.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete document.");
    }
  };

  const requestDeleteDocument = (id: string) => {
    const target = documents.find((document) => document.id === id);
    if (target) setDeleteTarget(target);
  };

  const confirmDeleteDocument = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await deleteDocument(id);
  };

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (authMode === "login") {
        const normalizedEmail = authEmail.trim().toLowerCase();
        const isDemoAdmin = normalizedEmail === "basheer82475@gmail.com";
        const isDemoWriter = normalizedEmail === "writer@syncdoc.app";
        if (isDemoAdmin || isDemoWriter) {
          const expectedPassword = isDemoAdmin ? "Admin@123" : "Writer@123";
          if (authPassword !== expectedPassword) {
            setError("That password doesn't match the demo account. Use one of the demo account buttons below.");
            return;
          }
          if (isDemoWriter) {
            let demoUsers = demoRegisteredUsers;
            try {
              const storedUsers = localStorage.getItem("syncdoc-demo-users");
              if (storedUsers) demoUsers = JSON.parse(storedUsers) as RegisteredUser[];
            } catch { /* Use the default active demo user when saved data is unavailable. */ }
            const writer = demoUsers.find((registeredUser) => registeredUser.email.toLowerCase() === normalizedEmail);
            if (writer?.status === "blocked" || writer?.status === "banned") {
              setError(writer.status === "banned" ? "This demo account has been banned. Contact an administrator." : "This demo account is blocked. Contact an administrator.");
              return;
            }
          }
          const demoUser: User = isDemoAdmin
            ? { id: "syncdoc-demo-user", name: "Admin", email: "basheer82475@gmail.com", role: "admin" }
            : { id: "syncdoc-demo-writer", name: "Taylor Morgan", email: "writer@syncdoc.app", role: "user" };
          localStorage.setItem("syncdoc-token", "syncdoc-demo");
          localStorage.setItem("syncdoc-demo-user", JSON.stringify(demoUser));
          setDemoMode(true);
          setUser(demoUser);
          setShowHome(true);
          setShowAdmin(false);
          setError(null);
          setNotice(null);
        } else {
          const response = await login(authEmail, authPassword);
          setUser(saveSession(response));
          setError(null);
        }
        return;
      }
      const response = await register(authName, authEmail, authPassword);
      setUser(saveSession(response));
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to authenticate.");
    }
  };

  const handleLogout = async () => {
    if (!demoMode) { try { await logout(); } catch { /* local session is still cleared */ } }
    localStorage.removeItem("syncdoc-token");
    localStorage.removeItem("syncdoc-demo-user");
    setUser(null);
    setDocuments([]);
    setDemoMode(false);
    setShowHome(true);
  };

  const handleShare = async () => {
    if (!activeId || !shareEmail.trim()) return;
    const emails = [...new Set(shareEmail.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
    const invalidEmails = emails.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalidEmails.length) {
      announce(`Check these email addresses: ${invalidEmails.join(", ")}`);
      return;
    }
    try {
      if (demoMode) {
        const shares = JSON.parse(localStorage.getItem("syncdoc-demo-shares") || "{}") as Record<string, Collaborator[]>;
        const currentCollaborators = shares[activeId] || [];
        const documentCollaborators = [...currentCollaborators];
        emails.forEach((email) => {
          const collaborator: Collaborator = { id: `demo-${email}`, name: email.split("@")[0], email, permission: sharePermission };
          const existingIndex = documentCollaborators.findIndex((item) => item.email.toLowerCase() === email);
          if (existingIndex >= 0) documentCollaborators[existingIndex] = collaborator;
          else documentCollaborators.push(collaborator);
        });
        shares[activeId] = documentCollaborators;
        localStorage.setItem("syncdoc-demo-shares", JSON.stringify(shares));
        setCollaborators(documentCollaborators);
        announce(`Added ${emails.length} ${emails.length === 1 ? "collaborator" : "collaborators"}.`);
        setShareEmail("");
        setError(null);
        return;
      }
      await Promise.all(emails.map((email) => shareDocument(activeId, email, sharePermission)));
      announce(`Added ${emails.length} ${emails.length === 1 ? "collaborator" : "collaborators"}.`);
      setShareEmail("");
      setCollaborators(await getCollaborators(activeId));
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to share document.");
    }
  };

  const handleRemoveCollaborator = async (collaborator: Collaborator) => {
    if (!activeId) return;
    try {
      if (demoMode) {
        const shares = JSON.parse(localStorage.getItem("syncdoc-demo-shares") || "{}") as Record<string, Collaborator[]>;
        const remaining = (shares[activeId] || []).filter((item) => item.id !== collaborator.id);
        shares[activeId] = remaining;
        localStorage.setItem("syncdoc-demo-shares", JSON.stringify(shares));
        setCollaborators(remaining);
      } else {
        await removeCollaboratorRequest(activeId, collaborator.id);
        setCollaborators((current) => current.filter((item) => item.id !== collaborator.id));
      }
      announce(`Removed ${collaborator.email} from this document.`);
    } catch (requestError) {
      announce(requestError instanceof Error ? requestError.message : "Unable to remove this collaborator.");
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
        <section className="auth-story" aria-label="About SyncDoc">
          <div className="story-brand">
            <div className="logo auth-logo">S</div>
            <span>SyncDoc</span>
            <span className="story-brand-note">Collaborative documents</span>
          </div>

          <div className="story-intro">
            <p className="eyebrow">DOCUMENTS, MADE TOGETHER</p>
            <h2>Write together.<br />Stay in sync.</h2>
            <p>Write clearly, keep everyone in sync, and turn a blank page into work you’re proud to share.</p>
          </div>

          <div className="story-preview" aria-label="Preview of a shared project document">
            <div className="preview-topline">
              <span className="preview-file-icon">S</span>
              <span className="preview-file-name">Project brief</span>
              <span className="preview-live"><i /> Demo document</span>
            </div>
            <div className="preview-content">
              <span className="preview-kicker">MONDAY, 9:41 AM</span>
              <div className="preview-heading">A clear direction<br />starts with a draft.</div>
              <div className="preview-line preview-line-long" />
              <div className="preview-line preview-line-mid" />
              <div className="preview-highlight"><span /> One shared page. Everyone in sync.</div>
            </div>
            <div className="preview-bottomline">
              <div className="preview-avatars"><span>AM</span><span>JL</span><span>RK</span></div>
              <span>3 people · editing together</span>
            </div>
          </div>

          <p className="story-footnote"><span>✳</span> Your ideas, always in good company.</p>
        </section>

        <div className="auth-panel">
          <p className="eyebrow">{authMode === "login" ? "YOUR WORKSPACE AWAITS" : "START SOMETHING GOOD"}</p>
          <h1>{authMode === "login" ? "Welcome back" : "Create your workspace"}</h1>
          <p className="auth-copy">{authMode === "login" ? "Pick up right where your ideas left off." : "A calm, collaborative place for the work ahead."}</p>
          <form onSubmit={submitAuth} className="auth-form">
            {authMode === "register" && <input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Full name" aria-label="Full name" required />}
            <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} type="email" placeholder="Email address" aria-label="Email address" required />
            <input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} type="password" placeholder="Password (6+ characters)" aria-label="Password" minLength={6} required />
            <button className="primary-action" type="submit">{authMode === "login" ? "Log in" : "Create account"}</button>
          </form>
          {authMode === "login" && <div className="demo-access-card">
            <div className="demo-access-heading"><span>TRY THE USER DEMO</span><small>Works without a backend</small></div>
            <div className="demo-access-options">
              <button type="button" onClick={() => { setAuthEmail("writer@syncdoc.app"); setAuthPassword("Writer@123"); setError(null); }}><strong>User workspace</strong><span>writer@syncdoc.app</span><small>Writer@123</small></button>
            </div>
          </div>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="text-action" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(null); }}>
            {authMode === "login" ? "New to SyncDoc? Create an account" : "Already have an account? Log in"}
          </button>
          <p className="demo-hint">Demo changes stay in this browser.</p>
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
          min-height: 42px;
          height: auto;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 28px;
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
        /* Emerald Ink + Champagne visual refresh */
        :root { color-scheme: light; --ink: #064e3b; --ink-deep: #064e3b; --emerald: #064e3b; --champagne: #f8e7c9; --paper: #fffdf8; --canvas: #f3f1eb; --muted: #7e827a; --line: #e8e3d8; }
        body { background: var(--canvas); color: #23352e; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        button { transition: background .18s ease, color .18s ease, border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
        .app { background: var(--canvas); }
        .header { height: 72px; padding: 0 30px; background: #fffdf8; border-bottom-color: var(--line); box-shadow: 0 3px 16px rgba(41, 50, 38, .035); }
        .logo { border-radius: 13px; background: linear-gradient(145deg, #064e3b, #064e3b); box-shadow: 0 7px 18px rgba(6,78,59,.2); }
        .brand-info h1 { color: var(--ink); letter-spacing: -.035em; }
        .brand-info p { color: #898a7f; }
        .connection { background: #f8e7c9; color: #176746; }
        .connection-dot { box-shadow: 0 0 0 4px rgba(34, 126, 78, .11); }
        .avatar { background: var(--champagne); color: var(--ink); }
        .header-user { color: #43534a; }
        .logout-button, .text-action { color: var(--emerald); }
        .logout-button:hover, .text-action:hover { color: var(--ink-deep); }
        .workspace { background: var(--canvas); }
        .sidebar { width: 278px; padding: 26px 17px; background: #fffdf8; border-right-color: var(--line); }
        .sidebar-title { color: #74796f; letter-spacing: .12em; }
        .new-button, .share-button, .primary-action { background: var(--ink); box-shadow: 0 5px 12px rgba(6,78,59,.14); }
        .new-button:hover, .share-button:hover, .primary-action:hover { background: #064e3b; box-shadow: 0 7px 16px rgba(6,78,59,.2); transform: translateY(-1px); }
        .search-input, .share-input { border-color: #e7e1d6; border-radius: 10px; background: #fffdf8; color: #263b31; }
        .search-input:focus, .share-input:focus, .auth-form input:focus { border-color: #559579; box-shadow: 0 0 0 3px rgba(11,107,80,.12); }
        .document { border-radius: 10px; color: #59665c; padding: 11px 10px; }
        .document:hover { background: #f5f1e8; color: var(--ink); }
        .document.active { background: var(--champagne); color: var(--ink); box-shadow: inset 3px 0 #064e3b; }
        .document-icon { background: #f3eee4; }
        .document.active .document-icon { background: #f8e7c9; }
        .delete-button:hover { background: #fae8df; }
        .editor-area { background: var(--canvas); }
        .editor-topbar, .format-toolbar { background: #fffdf8; border-color: var(--line); }
        .editor-topbar { height: 56px; padding: 0 34px; }
        .editing-label strong { color: var(--ink); }
        .saved { color: #23734e; }
        .format-toolbar { padding: 0 34px; }
        .tool { border: 1px solid transparent; color: #59665c; }
        .tool:hover { background: var(--champagne); color: var(--ink); }
        .divider { background: #e7dfd2; }
        .share-panel { padding: 10px 34px; background: #faf6ed; border-color: var(--line); }
        .share-panel select { border-color: #e7e1d6; border-radius: 9px; padding: 9px 11px; color: #43534a; }
        .share-input { padding: 10px 12px; }
        .share-emails-input { min-height: 40px; max-height: 96px; flex: 1; resize: vertical; font: inherit; font-size: 12px; line-height: 1.4; }
        .document-container { padding: 38px 34px 50px; }
        .paper { max-width: 920px; min-height: 680px; padding: 66px 78px 76px; border: 1px solid #eadfc9; border-radius: 15px; background: var(--paper); box-shadow: 0 18px 50px rgba(54, 48, 34, .08), 0 2px 8px rgba(54,48,34,.035); }
        .paper-title { color: var(--ink); font-size: 34px; letter-spacing: -.04em; }
        .paper-subtitle { color: #999383; }
        .editor { color: #394a40; line-height: 1.95; }
        .editor::placeholder { color: #b7ad99; }
        .editor-footer { background: #fffdf8; border-color: var(--line); color: #858679; }
        .editor-count { color: #969487; }
        .collaborator-chip { background: var(--champagne); color: var(--ink); }
        .collaborator-list { flex-wrap: wrap; justify-content: flex-end; max-width: min(58vw, 680px); }
        .collaborator-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 5px 4px 8px; }
        .collaborator-chip button { display: grid; width: 18px; height: 18px; place-items: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; font-size: 15px; line-height: 1; }
        .collaborator-chip button:hover { background: rgba(6,78,59,.12); }
        .error-state { background: #fff3e5; color: #94551e; border-color: #f1d8b6; }
        .app-toast { position: fixed; z-index: 30; right: 24px; bottom: 62px; max-width: min(420px, calc(100vw - 32px)); padding: 12px 16px; border: 1px solid rgba(248,231,201,.2); border-radius: 10px; background: var(--ink); color: var(--champagne); box-shadow: 0 12px 32px rgba(6,78,59,.2); font-size: 12px; font-weight: 650; }
        .find-panel { display: flex; align-items: center; gap: 7px; padding: 8px 34px; border-bottom: 1px solid var(--line); background: #fffdf8; }
        .find-panel input { width: min(340px, 50vw); padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px; outline: none; background: white; color: #394a40; font: inherit; font-size: 12px; }
        .find-panel input:focus { border-color: var(--ink); box-shadow: 0 0 0 3px rgba(6,78,59,.1); }
        .find-panel button { padding: 8px 11px; border: 1px solid var(--line); border-radius: 7px; background: white; color: var(--ink); cursor: pointer; font: inherit; font-size: 11px; font-weight: 650; }
        .find-panel .find-close { border-color: transparent; background: transparent; color: #72786f; font-size: 17px; }
        .find-tool { width: auto; gap: 5px; padding: 0 8px; }
        button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid rgba(6,78,59,.35); outline-offset: 2px; }
        .home-nav { width: 100%; display: flex; align-items: center; gap: 10px; margin: 2px 0 15px; padding: 10px; border: 0; border-radius: 9px; background: transparent; color: #637066; text-align: left; cursor: pointer; font-size: 13px; }
        .home-nav:hover, .home-nav.active { background: var(--champagne); color: var(--ink); }
        .sidebar .home-nav { background: transparent; color: #637066; padding: 10px; border: 0; transform: none; box-shadow: none; }
        .sidebar .home-nav:hover, .sidebar .home-nav.active { background: var(--champagne); color: var(--ink); }
        .sidebar .document { width: 100%; padding: 11px 10px; border: 0; border-radius: 10px; background: transparent; color: #59665c; box-shadow: none; transform: none; }
        .sidebar .document:hover { background: #f5f1e8; color: var(--ink); }
        .sidebar .document.active { background: var(--champagne); color: var(--ink); box-shadow: inset 3px 0 var(--ink); }
        .sidebar .new-button { padding: 8px 12px; border: 0; border-radius: 8px; background: var(--ink); color: #fff; box-shadow: 0 5px 12px rgba(6,78,59,.14); transform: none; }
        .sidebar .new-button:hover { background: #064e3b; color: #fff; box-shadow: 0 7px 16px rgba(6,78,59,.2); transform: translateY(-1px); }
        .home-nav-mark { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 8px; background: #f3eee4; font-size: 18px; }
        .home-dashboard { flex: 1; min-height: 0; overflow-y: auto; padding: clamp(24px, 4vw, 54px); background: var(--canvas); }
        .home-dashboard > * { width: min(1100px, 100%); margin-left: auto; margin-right: auto; }
        .home-welcome { position: relative; display: flex; align-items: center; min-height: 255px; overflow: hidden; padding: clamp(26px, 4vw, 46px); border-radius: 20px; background: var(--ink); color: var(--champagne); box-shadow: 0 16px 36px rgba(6,78,59,.14); }
        .home-welcome-copy { position: relative; z-index: 1; max-width: 610px; }
        .home-eyebrow { color: #718276; font-size: 10px; font-weight: 800; letter-spacing: .15em; }
        .home-welcome .home-eyebrow { color: #dfcfaa; }
        .home-welcome h2 { max-width: 570px; margin-top: 12px; font-size: clamp(30px, 3.2vw, 43px); line-height: 1.08; letter-spacing: -.045em; }
        .home-welcome-copy > p:not(.home-eyebrow) { max-width: 460px; margin-top: 12px; color: rgba(255,253,248,.78); font-size: 14px; line-height: 1.65; }
        .home-create-button { display: inline-flex; align-items: center; gap: 9px; margin-top: 22px; padding: 11px 15px; border: 0; border-radius: 9px; background: var(--champagne); color: var(--ink); cursor: pointer; font-size: 12px; font-weight: 750; }
        .home-create-button:hover { background: #fff4df; transform: translateY(-1px); }
        .home-create-button span { font-size: 17px; line-height: 12px; }
        .home-welcome-art { position: absolute; inset: 0 0 0 auto; width: 40%; min-width: 260px; opacity: .95; }
        .welcome-orbit { position: absolute; border: 1px solid rgba(248,231,201,.18); border-radius: 50%; }
        .welcome-orbit-one { width: 290px; height: 290px; top: 50%; right: 9%; transform: translateY(-50%); }
        .welcome-orbit-two { width: 220px; height: 220px; top: 50%; right: calc(9% + 35px); transform: translateY(-50%); }
        .welcome-sheet { position: absolute; top: 50%; right: 25%; display: flex; flex-direction: column; gap: 12px; width: 116px; height: 146px; padding: 25px 18px; border: 1px solid rgba(6,78,59,.08); border-radius: 10px; background: var(--champagne); box-shadow: 0 18px 30px rgba(0,0,0,.15); transform: translateY(-50%) rotate(7deg); }
        .welcome-sheet span { height: 5px; border-radius: 6px; background: rgba(6,78,59,.17); }
        .welcome-sheet span:first-child { width: 62%; height: 8px; margin-bottom: 5px; background: var(--ink); }
        .welcome-sheet span:nth-child(3) { width: 77%; }
        .welcome-sheet i { width: 52px; height: 22px; margin-top: 4px; border-radius: 6px; background: var(--ink); }
        .welcome-spark { position: absolute; top: 20%; right: 17%; color: var(--champagne); font-size: 25px; }
        .home-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
        .home-stat-card { display: flex; align-items: center; gap: 13px; min-height: 76px; padding: 15px 18px; border: 1px solid var(--line); border-radius: 12px; background: #fffdf8; }
        .home-stat-icon { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 10px; background: var(--champagne); color: var(--ink); font-size: 17px; }
        .home-stat-icon.home-stat-live { width: 11px; height: 11px; min-width: 11px; margin: 0 12px; border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 5px var(--champagne); }
        .home-stat-card div { display: flex; flex-direction: column; gap: 4px; }
        .home-stat-card strong { color: #263b31; font-size: 13px; }
        .home-stat-card div span { color: #858a80; font-size: 11px; }
        .home-recent-heading { display: flex; align-items: end; justify-content: space-between; margin-top: 38px; margin-bottom: 15px; }
        .home-recent-heading h3 { margin-top: 5px; color: #263b31; font-size: 22px; letter-spacing: -.035em; }
        .home-recent-heading > span { color: #858a80; font-size: 11px; }
        .home-document-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .home-document-item { position: relative; width: min(100%, 320px); min-width: 0; }
        .home-document-card { display: flex; width: 100%; min-height: 180px; flex-direction: column; align-items: flex-start; padding: 19px; border: 1px solid var(--line); border-radius: 13px; background: #fffdf8; color: #263b31; text-align: left; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .home-document-card:hover { transform: translateY(-2px); border-color: #c9d7cb; box-shadow: 0 10px 24px rgba(41,50,38,.07); }
        .home-delete-button { position: absolute; top: 12px; right: 12px; padding: 6px 9px; border: 1px solid var(--line); border-radius: 7px; background: #fffdf8; color: #6e756d; cursor: pointer; font-size: 10px; font-weight: 650; }
        .home-delete-button:hover { border-color: #d8b9a9; background: #fbefea; color: #9a422d; }
        .home-document-icon { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 9px; background: var(--ink); color: var(--champagne); font-size: 12px; font-weight: 800; }
        .home-document-title { overflow: hidden; width: 100%; margin-top: 14px; color: var(--ink); font-size: 15px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
        .home-document-preview { display: -webkit-box; overflow: hidden; margin-top: 6px; color: #7b8279; font-size: 11px; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
        .home-document-open { display: flex; justify-content: space-between; width: 100%; margin-top: auto; padding-top: 13px; color: #65746a; font-size: 10px; }
        .home-document-open b { color: var(--ink); font-size: 14px; }
        .home-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 34px 20px; border: 1px dashed #d8d3c7; border-radius: 14px; background: rgba(255,253,248,.65); color: #7b8279; text-align: center; font-size: 12px; }
        .home-empty strong { color: var(--ink); font-size: 16px; }
        .home-empty-icon { color: var(--ink); font-size: 24px; }
        .home-empty button { margin-top: 5px; padding: 9px 13px; border-radius: 8px; background: var(--ink); color: white; cursor: pointer; font-weight: 650; }
        .admin-nav .home-nav-mark { font-size: 12px; font-weight: 800; }
        .admin-dashboard { flex: 1; min-height: 0; overflow-y: auto; padding: clamp(24px, 4vw, 54px); background: var(--canvas); }
        .admin-dashboard > * { width: min(1100px, 100%); margin-left: auto; margin-right: auto; }
        .admin-banner { position: relative; display: flex; align-items: center; gap: 17px; min-height: 142px; overflow: hidden; margin-bottom: 30px; padding: 25px 30px; border-radius: 18px; background: radial-gradient(circle at 84% 0%, rgba(248,231,201,.14), transparent 28%), var(--ink); color: var(--champagne); }
        .admin-banner-mark { display: grid; width: 46px; height: 46px; flex-shrink: 0; place-items: center; border: 1px solid rgba(248,231,201,.28); border-radius: 14px; background: rgba(248,231,201,.1); font-size: 18px; font-weight: 800; }
        .admin-banner-copy { position: relative; z-index: 1; }
        .admin-banner-copy > span { color: #ddcda9; font-size: 9px; font-weight: 800; letter-spacing: .16em; }
        .admin-banner-copy h2 { margin-top: 7px; font-size: 25px; letter-spacing: -.035em; }
        .admin-banner-copy p { margin-top: 5px; color: rgba(255,253,248,.74); font-size: 11px; }
        .admin-banner-total { display: flex; align-items: baseline; gap: 8px; margin-left: auto; padding: 11px 15px; border: 1px solid rgba(248,231,201,.2); border-radius: 11px; background: rgba(248,231,201,.08); }
        .admin-banner-total strong { font-size: 25px; }
        .admin-banner-total span { color: #ddcda9; font-size: 10px; }
        .admin-page-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 25px; }
        .admin-page-heading h2 { margin-top: 6px; color: var(--ink); font-size: clamp(28px, 3vw, 38px); letter-spacing: -.045em; }
        .admin-page-heading p:last-child { margin-top: 8px; color: #70786f; font-size: 13px; }
        .admin-export-button { flex-shrink: 0; padding: 11px 15px; border: 0; border-radius: 9px; background: var(--ink); color: #fffdf8; cursor: pointer; font-size: 12px; font-weight: 700; }
        .admin-export-button:hover:not(:disabled) { background: #043b2d; transform: translateY(-1px); }
        .admin-export-button:disabled { opacity: .45; cursor: not-allowed; }
        .admin-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 17px; }
        .admin-metric-card { display: flex; flex-direction: column; gap: 8px; min-height: 112px; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: #fffdf8; }
        .admin-metric-card > span { color: #737b71; font-size: 10px; font-weight: 700; }
        .admin-metric-card strong { color: var(--ink); font-size: 26px; line-height: 1; letter-spacing: -.04em; }
        .admin-metric-card small { color: #8c9087; font-size: 9px; }
        .admin-metric-highlight { border-color: #e9d9bd; background: #fffaf0; }
        .admin-summary-card { display: flex; align-items: center; gap: 13px; margin-bottom: 18px; padding: 17px 19px; border: 1px solid var(--line); border-radius: 12px; background: #fffdf8; }
        .admin-summary-card > div { display: flex; flex-direction: column; gap: 4px; }
        .admin-summary-card strong { color: var(--ink); font-size: 20px; }
        .admin-summary-card div span { color: #858a80; font-size: 11px; }
        .admin-summary-card label { margin-left: auto; color: #656f66; font-size: 11px; font-weight: 650; }
        .admin-summary-card input { width: min(260px, 30vw); padding: 9px 11px; border: 1px solid #e7e1d6; border-radius: 8px; outline: none; background: #fffefa; font: inherit; font-size: 12px; }
        .admin-summary-card input:focus { border-color: var(--ink); box-shadow: 0 0 0 3px rgba(6,78,59,.1); }
        .admin-summary-card select { padding: 9px 11px; border: 1px solid #e7e1d6; border-radius: 8px; background: #fffefa; color: #3c5043; font: inherit; font-size: 12px; }
        .admin-table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; background: #fffdf8; }
        .admin-users-table { width: 100%; border-collapse: collapse; text-align: left; }
        .admin-users-table th { padding: 13px 17px; border-bottom: 1px solid var(--line); background: #f8e7c9; color: #536157; font-size: 10px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
        .admin-users-table td { padding: 14px 17px; border-bottom: 1px solid #eeeae1; color: #58645b; font-size: 12px; }
        .admin-users-table { min-width: 900px; }
        .admin-users-table tr:last-child td { border-bottom: 0; }
        .admin-users-table tbody tr:hover { background: #fcfaf5; }
        .admin-users-table td:first-child { display: table-cell; color: #304237; font-weight: 650; white-space: nowrap; }
        .admin-user-avatar { display: inline-grid; width: 29px; height: 29px; margin-right: 10px; place-items: center; border-radius: 50%; background: var(--champagne); color: var(--ink); font-size: 11px; font-weight: 750; vertical-align: middle; }
        .admin-role { padding: 5px 8px; border-radius: 20px; background: #f1f0e9; color: #697268; font-size: 10px; text-transform: capitalize; }
        .admin-role-admin { background: var(--champagne); color: var(--ink); }
        .admin-status { display: inline-block; padding: 5px 8px; border-radius: 20px; background: #e9f1e9; color: var(--ink); font-size: 10px; text-transform: capitalize; }
        .admin-status-blocked { background: #fff2d6; color: #82652e; }
        .admin-status-banned { background: #f8e8e1; color: #914633; }
        .admin-actions-cell { white-space: nowrap; }
        .admin-action-button { margin-right: 6px; padding: 6px 8px; border: 1px solid #d9e2d9; border-radius: 7px; background: #fffdf8; color: var(--ink); cursor: pointer; font-size: 10px; font-weight: 700; }
        .admin-action-button:hover:not(:disabled) { background: #edf3ed; }
        .admin-action-button:disabled { opacity: .42; cursor: not-allowed; }
        .admin-ban-button { border-color: #edd6cc; color: #914633; }
        .admin-ban-button:hover:not(:disabled) { background: #fbefea; }
        .admin-no-users { padding: 28px !important; color: #858a80 !important; text-align: center; }
        .admin-message { margin: 16px 0; padding: 13px 15px; border: 1px solid #e6d6b8; border-radius: 10px; background: #fff7e8; color: #725c35; font-size: 12px; line-height: 1.6; }
        .admin-error { border-color: #e9d0c6; background: #fff2ed; color: #8a4938; }
        .admin-export-note { margin-top: 13px; color: #898c83; font-size: 10px; line-height: 1.5; }
        .admin-activity-panel { margin-top: 24px; padding: 21px 23px; border: 1px solid var(--line); border-radius: 13px; background: #fffdf8; }
        .admin-activity-heading { display: flex; align-items: end; justify-content: space-between; gap: 14px; margin-bottom: 9px; }
        .admin-activity-heading .home-eyebrow { margin-bottom: 5px; }
        .admin-activity-heading h3 { margin: 0; color: var(--ink); font-size: 19px; letter-spacing: -.03em; }
        .admin-activity-heading > span { color: #858a80; font-size: 10px; }
        .admin-activity-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid #eeeae1; }
        .admin-activity-dot { width: 9px; height: 9px; flex: 0 0 auto; border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 4px #e6efe8; }
        .admin-activity-item > div { display: flex; flex: 1; align-items: center; justify-content: space-between; gap: 16px; }
        .admin-activity-item strong { color: #394b40; font-size: 12px; font-weight: 650; }
        .admin-activity-item span:last-child { color: #858a80; font-size: 10px; white-space: nowrap; }
        .confirm-overlay { position: fixed; z-index: 1000; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(17, 34, 27, .48); backdrop-filter: blur(3px); }
        .confirm-dialog { width: min(100%, 430px); padding: 30px; border: 1px solid #e4dccd; border-radius: 18px; background: #fffdf8; box-shadow: 0 24px 80px rgba(14, 37, 27, .25); }
        .confirm-dialog > p:first-child { margin: 0 0 9px; color: #8b7856; font-size: 10px; font-weight: 800; letter-spacing: .14em; }
        .confirm-dialog h2 { margin: 0; color: var(--ink); font-size: 23px; line-height: 1.25; letter-spacing: -.035em; }
        .confirm-dialog > p:nth-of-type(2) { margin: 10px 0 24px; color: #72786f; font-size: 13px; line-height: 1.6; }
        .confirm-actions { display: flex; justify-content: flex-end; gap: 9px; }
        .confirm-actions button { min-height: 40px; padding: 0 14px; border: 1px solid #ded8cb; border-radius: 9px; background: #fffdf8; color: #47564b; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; }
        .confirm-actions .confirm-delete { border-color: #9b3527; background: #9b3527; color: white; }
        .confirm-actions button:focus-visible { outline: 3px solid rgba(6,78,59,.25); outline-offset: 2px; }
        .auth-screen { background: radial-gradient(ellipse at 12% 12%, rgba(248,231,201,.9), transparent 35%), radial-gradient(ellipse at 88% 90%, rgba(11,107,80,.12), transparent 32%), #f2eee5; }
        .auth-screen { width: 100%; grid-template-columns: minmax(0, 1fr) minmax(360px, 440px); gap: clamp(42px, 7vw, 104px); align-content: center; justify-items: stretch; padding: 56px max(24px, calc((100vw - 1120px) / 2)); }
        .auth-story { width: 100%; max-width: 560px; justify-self: end; }
        .story-brand { display: flex; align-items: center; gap: 11px; color: var(--ink); font-size: 19px; font-weight: 780; letter-spacing: -.04em; }
        .story-brand .auth-logo { width: 38px; height: 38px; margin: 0; border-radius: 12px; }
        .story-brand-note { margin-left: auto; color: #8a8c81; font-size: 11px; font-weight: 550; letter-spacing: 0; }
        .story-intro { margin: clamp(36px, 6vh, 66px) 0 27px; }
        .story-intro .eyebrow { margin-bottom: 13px; }
        .story-intro h2 { max-width: 560px; color: var(--ink); font-size: clamp(38px, 4.5vw, 58px); line-height: 1.06; letter-spacing: -.055em; }
        .story-intro > p:last-child { max-width: 445px; margin-top: 17px; color: #69736b; font-size: 16px; line-height: 1.75; }
        .story-preview { overflow: hidden; border: 1px solid #e7e1d6; border-radius: 16px; background: #fffdf8; box-shadow: 0 20px 48px rgba(41, 50, 38, .09), 0 2px 8px rgba(41, 50, 38, .035); transform: rotate(-1deg); }
        .preview-topline, .preview-bottomline { display: flex; align-items: center; }
        .preview-topline { height: 54px; padding: 0 19px; border-bottom: 1px solid #eee9df; gap: 10px; }
        .preview-file-icon { display: grid; width: 25px; height: 25px; place-items: center; border-radius: 8px; background: var(--ink); color: var(--champagne); font-size: 12px; font-weight: 800; }
        .preview-file-name { color: #394b40; font-size: 12px; font-weight: 700; }
        .preview-live { display: flex; align-items: center; gap: 6px; margin-left: auto; color: #526457; font-size: 10px; }
        .preview-live i { width: 7px; height: 7px; border-radius: 50%; background: var(--ink); }
        .preview-content { padding: 25px 29px 22px; }
        .preview-kicker { color: #9a988c; font-size: 9px; font-weight: 700; letter-spacing: .12em; }
        .preview-heading { margin: 12px 0 18px; color: var(--ink); font-family: Georgia, "Times New Roman", serif; font-size: clamp(25px, 3vw, 34px); line-height: 1.14; letter-spacing: -.035em; }
        .preview-line { height: 6px; margin: 8px 0; border-radius: 5px; background: #eeeae1; }
        .preview-line-long { width: 84%; }
        .preview-line-mid { width: 61%; }
        .preview-highlight { display: flex; align-items: center; gap: 10px; width: fit-content; margin-top: 19px; padding: 10px 13px; border-radius: 8px; background: var(--champagne); color: var(--ink); font-size: 11px; font-weight: 650; }
        .preview-highlight span { width: 3px; height: 16px; border-radius: 3px; background: var(--ink); }
        .preview-bottomline { min-height: 50px; padding: 0 19px; border-top: 1px solid #eee9df; color: #82877c; font-size: 10px; gap: 10px; }
        .preview-avatars { display: flex; padding-left: 3px; }
        .preview-avatars span { display: grid; width: 25px; height: 25px; margin-left: -3px; place-items: center; border: 2px solid #fffdf8; border-radius: 50%; background: var(--champagne); color: var(--ink); font-size: 8px; font-weight: 750; }
        .preview-avatars span:nth-child(2) { background: #e5eee7; }
        .preview-avatars span:nth-child(3) { background: #e8e7df; }
        .story-footnote { display: flex; align-items: center; gap: 8px; margin-top: 24px; color: #777f75; font-size: 11px; }
        .story-footnote span { color: var(--ink); font-size: 17px; }
        .auth-panel { width: 100%; padding: 48px; border-color: #e7dfd2; border-radius: 22px; background: #fffdf8; box-shadow: 0 28px 70px rgba(42,54,43,.13); }
        .auth-logo { background: linear-gradient(145deg, #064e3b, #064e3b); box-shadow: 0 8px 20px rgba(6,78,59,.2); }
        .eyebrow { color: var(--emerald); }
        .auth-panel h1 { color: var(--ink); letter-spacing: -.04em; }
        .auth-copy { color: #777c72; }
        .auth-form input { border-color: #e7e1d6; border-radius: 10px; padding: 13px 14px; background: #fffdf8; }
        .primary-action { border-radius: 10px; padding: 13px; }
        .demo-hint { color: #99988d; }
        @media (max-width: 700px) {
          .app-toast { right: 12px; bottom: 52px; }
          .home-dashboard { padding: 18px 13px; }
          .admin-dashboard { padding: 22px 13px; }
          .admin-banner { min-height: 128px; gap: 12px; padding: 20px 17px; }
          .admin-banner-copy h2 { font-size: 20px; }
          .admin-banner-total { flex-direction: column; gap: 1px; padding: 9px; }
          .admin-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .admin-page-heading { align-items: flex-start; flex-direction: column; }
          .admin-summary-card { flex-wrap: wrap; }
          .admin-summary-card label { margin-left: 0; }
          .admin-summary-card input { width: 100%; }
          .admin-summary-card select { flex: 1; }
          .admin-users-table { min-width: 620px; }
          .home-welcome { min-height: 240px; }
          .home-welcome-art { right: -95px; opacity: .45; }
          .home-welcome-copy { max-width: 100%; }
          .home-stats, .home-document-grid { grid-template-columns: minmax(0, 1fr); }
          .home-recent-heading { margin-top: 28px; }
          .auth-screen { grid-template-columns: minmax(0, 1fr); gap: 30px; padding: 35px 20px; }
          .auth-story { max-width: 460px; justify-self: center; }
          .story-brand-note, .story-footnote { display: none; }
          .story-intro { margin: 28px 0 20px; }
          .story-intro h2 { font-size: clamp(34px, 9vw, 44px); }
          .story-intro > p:last-child { margin-top: 10px; font-size: 14px; }
          .story-preview { display: none; }
          .auth-panel { max-width: 460px; justify-self: center; }
          .header { padding: 0 16px; }
          .brand-info p, .header-user > span { display: none; }
          .header-right { gap: 10px; }
          .sidebar { width: 190px; padding: 18px 11px; }
          .editor-topbar, .format-toolbar { padding-left: 16px; padding-right: 16px; }
          .document-container { padding: 20px 12px 28px; }
          .paper { min-height: 560px; padding: 34px 24px; }
          .paper-title { font-size: 27px; }
          .share-panel { padding: 9px 12px; flex-wrap: wrap; }
          .share-input { min-width: 140px; flex: 1; }
          .editor-footer { padding: 0 12px; }
        }
        @media (max-width: 460px) {
          .sidebar { width: 145px; padding: 15px 8px; }
          .new-button { padding: 7px 9px; }
          .document { gap: 6px; padding: 9px 6px; }
          .document-icon { width: 24px; height: 24px; }
          .editor-topbar { padding: 0 11px; }
          .editing-label { max-width: 68%; overflow: hidden; }
          .editing-label strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
          .format-toolbar { padding: 0 8px; gap: 0; }
          .divider { margin: 0 4px; }
          .tool { width: 29px; }
          .auth-panel { padding: 34px 25px; }
          .collaborators > span { display: none; }
          .confirm-dialog { padding: 24px 20px; }
          .confirm-actions { flex-direction: column-reverse; }
          .confirm-actions button { width: 100%; }
          .admin-activity-item > div { align-items: flex-start; flex-direction: column; gap: 4px; }
        }
        /* Product polish: quieter surfaces, consistent controls, and less ornament. */
        .header { box-shadow: none; }
        .logo { box-shadow: none; }
        .sidebar { padding-top: 22px; }
        .sidebar .new-button, .new-button, .share-button, .primary-action { box-shadow: none; }
        .home-dashboard, .admin-dashboard { padding: clamp(24px, 3vw, 40px); }
        .home-welcome { min-height: 205px; padding: clamp(25px, 3vw, 36px); border-radius: 12px; box-shadow: none; }
        .home-welcome-art { display: none; }
        .home-welcome-copy { max-width: 680px; }
        .home-welcome h2 { font-size: clamp(29px, 3vw, 38px); }
        .home-create-button { border-radius: 7px; }
        .home-stats { gap: 10px; margin-top: 14px; }
        .home-stat-card, .home-document-card, .admin-metric-card, .admin-summary-card { border-radius: 9px; box-shadow: none; }
        .home-stat-card { min-height: 66px; padding: 12px 15px; }
        .home-stat-icon { width: 31px; height: 31px; border-radius: 8px; }
        .home-recent-heading { margin-top: 30px; }
        .home-document-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 320px)); gap: 12px; }
        .home-document-item { width: 100%; }
        .home-document-card { min-height: 164px; padding: 16px; }
        .admin-banner { min-height: 118px; border-radius: 12px; background: var(--ink); }
        .admin-banner-mark { border-radius: 10px; }
        .admin-metric-card { min-height: 100px; }
        .admin-users-table th { background: #f6f0e5; }
        .auth-panel { border-radius: 14px; box-shadow: 0 12px 32px rgba(42,54,43,.08); }
        .story-preview { border-radius: 12px; box-shadow: 0 10px 26px rgba(41,50,38,.07); transform: none; }
        .preview-highlight { border-radius: 6px; }
        .app-toast { border-radius: 8px; box-shadow: 0 8px 22px rgba(6,78,59,.14); }
        @media (max-width: 700px) {
          .home-dashboard, .admin-dashboard { padding: 20px 15px; }
          .home-welcome { min-height: 190px; }
          .home-welcome-art { display: none; }
          .home-stats { grid-template-columns: minmax(0, 1fr); }
          .home-document-grid { grid-template-columns: minmax(0, 1fr); }
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
                  {demoMode ? "Local demo" : connected ? "Live" : "Offline"}
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
              <button className={`home-nav ${showHome && !showAdmin ? "active" : ""}`} onClick={() => { setShowAdmin(false); setShowHome(true); }}>
                <span className="home-nav-mark">O</span>
                <span>Overview</span>
              </button>
              {user.role === "admin" && <button className={`home-nav admin-nav ${showAdmin ? "active" : ""}`} onClick={() => { setShowAdmin(true); setShowHome(false); }}>
                <span className="home-nav-mark">A</span>
                <span>Admin</span>
              </button>}

              {documents.map((doc) => (
                <button
                  key={doc.id}
                  className={`document ${
                    activeId === doc.id && !showHome
                      ? "active"
                      : ""
                  }`}
                  onClick={() => { setActiveId(doc.id); setShowAdmin(false); setShowHome(false); }}
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
                      requestDeleteDocument(doc.id);
                    }}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>

          </aside>

          <main className="editor-area">

            {notice && <div className="app-toast" role="status" aria-live="polite">{notice}</div>}

            {showAdmin && user.role === "admin" ? (
              <section className="admin-dashboard">
                <div className="admin-banner">
                  <div className="admin-banner-mark">A</div>
                  <div className="admin-banner-copy"><span>ADMIN CONSOLE</span><h2>Workspace at a glance</h2><p>Membership, access, and account activity in one place.</p></div>
                  <div className="admin-banner-total"><strong>{registeredUsers.length}</strong><span>accounts</span></div>
                </div>
                <div className="admin-page-heading">
                  <div><p className="home-eyebrow">{demoMode ? "FRONTEND DEMO" : "WORKSPACE MANAGEMENT"}</p><h2>Registered users</h2><p>{demoMode ? "Sample account records for the admin presentation." : "View the people who have joined your SyncDoc workspace."}</p></div>
                  <button className="admin-export-button" onClick={downloadRegisteredUsers} disabled={adminLoading || registeredUsers.length === 0}>Download Excel CSV</button>
                </div>
                <div className="admin-metrics">
                  <div className="admin-metric-card"><span>Total accounts</span><strong>{registeredUsers.length}</strong><small>All registered profiles</small></div>
                  <div className="admin-metric-card"><span>Members</span><strong>{memberCount}</strong><small>Standard workspace users</small></div>
                  <div className="admin-metric-card"><span>Administrators</span><strong>{adminCount}</strong><small>Accounts with admin access</small></div>
                  <div className="admin-metric-card admin-metric-highlight"><span>New signups</span><strong>{recentSignupCount}</strong><small>Joined in the last 30 days</small></div>
                </div>
                <div className="admin-summary-card"><span className="home-stat-icon">U</span><div><strong>{visibleRegisteredUsers.length}</strong><span>matching {visibleRegisteredUsers.length === 1 ? "account" : "accounts"}</span></div><label htmlFor="admin-role-filter">Role</label><select id="admin-role-filter" value={adminRoleFilter} onChange={(event) => setAdminRoleFilter(event.target.value as "all" | "user" | "admin")}><option value="all">All roles</option><option value="user">Members</option><option value="admin">Admins</option></select><label htmlFor="admin-status-filter">Status</label><select id="admin-status-filter" value={adminStatusFilter} onChange={(event) => setAdminStatusFilter(event.target.value as "all" | AccountStatus)}><option value="all">All statuses</option><option value="active">Active</option><option value="blocked">Blocked</option><option value="banned">Banned</option></select><label htmlFor="admin-user-search">Search</label><input id="admin-user-search" value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} placeholder="Name or email" /></div>
                {adminLoading && <div className="admin-message">Loading registered users...</div>}
                {adminError && <div className="admin-message admin-error" role="alert">{adminError}</div>}
                {!adminLoading && !adminError && <div className="admin-table-wrap"><table className="admin-users-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Registered</th><th>Actions</th></tr></thead><tbody>
                  {visibleRegisteredUsers.map((registeredUser) => {
                    const status = registeredUser.status || "active";
                    const isCurrentUser = registeredUser.email.toLowerCase() === user.email.toLowerCase();
                    return <tr key={registeredUser.id}>
                      <td><span className="admin-user-avatar">{registeredUser.name.slice(0, 1).toUpperCase()}</span>{registeredUser.name}</td>
                      <td>{registeredUser.email}</td>
                      <td><span className={`admin-role ${registeredUser.role === "admin" ? "admin-role-admin" : ""}`}>{registeredUser.role || "user"}</span></td>
                      <td><span className={`admin-status admin-status-${status}`}>{status}</span></td>
                      <td>{new Date(registeredUser.createdAt).toLocaleDateString()}</td>
                      <td className="admin-actions-cell">
                        {status === "active" ? <button type="button" className="admin-action-button" disabled={isCurrentUser} title={isCurrentUser ? "You cannot block your own account" : "Temporarily block this account"} onClick={() => changeRegisteredUserStatus(registeredUser, "blocked")}>Block</button> : status === "blocked" ? <button type="button" className="admin-action-button" disabled={isCurrentUser} onClick={() => changeRegisteredUserStatus(registeredUser, "active")}>Unblock</button> : <button type="button" className="admin-action-button" disabled={isCurrentUser} onClick={() => changeRegisteredUserStatus(registeredUser, "active")}>Reinstate</button>}
                        {status !== "banned" && <button type="button" className="admin-action-button admin-ban-button" disabled={isCurrentUser} title={isCurrentUser ? "You cannot ban your own account" : "Ban this account"} onClick={() => changeRegisteredUserStatus(registeredUser, "banned")}>Ban</button>}
                      </td>
                    </tr>;
                  })}
                  {visibleRegisteredUsers.length === 0 && <tr><td className="admin-no-users" colSpan={6}>{registeredUsers.length ? "No users match these filters." : "No registered users yet."}</td></tr>}
                </tbody></table></div>}
                <p className="admin-export-note">{demoMode ? "These sample records are for demonstration; the download works locally and includes no passwords." : "The Excel-compatible CSV contains names, emails, roles, and registration dates. Passwords are never included."}</p>
                <section className="admin-activity-panel" aria-label="Recent activity">
                  <div className="admin-activity-heading"><div><p className="home-eyebrow">WHAT'S HAPPENING</p><h3>Recent activity</h3></div><span>Latest {Math.min(adminActivity.length, 5)} events</span></div>
                  {adminActivity.slice(0, 5).map((activity) => <div className="admin-activity-item" key={activity.id}><span className="admin-activity-dot" /><div><strong>{activity.message}</strong><span>{new Date(activity.createdAt).toLocaleString()}</span></div></div>)}
                </section>
              </section>
            ) : showHome ? (
              <section className="home-dashboard">
                {error && <div className="error-state" role="alert">{error}</div>}
                <div className="home-welcome">
                  <div className="home-welcome-copy">
                    <p className="home-eyebrow">YOUR WORKSPACE</p>
                    <h2>Your workspace</h2>
                    <p>Keep project notes and shared documents in one place.</p>
                    <button className="home-create-button" onClick={createDocument}><span>+</span> Create a document</button>
                  </div>
                  <div className="home-welcome-art" aria-hidden="true">
                    <div className="welcome-orbit welcome-orbit-one" />
                    <div className="welcome-orbit welcome-orbit-two" />
                    <div className="welcome-sheet"><span /><span /><span /><i /></div>
                    <div className="welcome-spark">*</div>
                  </div>
                </div>

                <div className="home-stats">
                  <div className="home-stat-card"><span className="home-stat-icon">D</span><div><strong>{documents.length}</strong><span>{documents.length === 1 ? "document in your space" : "documents in your space"}</span></div></div>
                  <div className="home-stat-card"><span className="home-stat-icon home-stat-live" /><div><strong>{demoMode ? "Private demo" : connected ? "Live and synced" : "Ready to connect"}</strong><span>{demoMode ? "Changes saved in this browser" : "Your workspace status"}</span></div></div>
                </div>

                <div className="home-recent-heading">
                  <div><p className="home-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h3>Recent documents</h3></div>
                  <span>{documents.length} {documents.length === 1 ? "document" : "documents"}</span>
                </div>

                {loading && <div className="home-empty">Loading your documents...</div>}
                {!loading && !error && documents.length > 0 ? (
                  <div className="home-document-grid">
                    {documents.slice(0, 4).map((doc) => (
                      <div className="home-document-item" key={doc.id}>
                        <button className="home-document-card" onClick={() => { setActiveId(doc.id); setShowHome(false); }}>
                          <span className="home-document-icon">S</span>
                          <span className="home-document-title">{doc.title}</span>
                          <span className="home-document-preview">{doc.content.replace(/[#*_`>-]/g, "").trim().slice(0, 96) || "A blank page, ready for your next idea."}</span>
                          <span className="home-document-open">Open document <b>Open</b></span>
                        </button>
                        <button className="home-delete-button" type="button" title={`Delete ${doc.title}`} aria-label={`Delete ${doc.title}`} onClick={() => requestDeleteDocument(doc.id)}>Delete</button>
                      </div>
                    ))}
                  </div>
                ) : !loading && !error ? (
                  <div className="home-empty"><span className="home-empty-icon">*</span><strong>Your first page starts here.</strong><span>Create a document and give your next idea a place to grow.</span><button onClick={createDocument}>Create your first document</button></div>
                ) : null}
              </section>
            ) : <>

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
                aria-live="polite"
                aria-atomic="true"
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

              <span className="divider" />
              <button className="tool find-tool" type="button" title="Find in document (Ctrl+F)" onClick={() => { setFindOpen((open) => !open); window.setTimeout(() => findInputRef.current?.focus(), 0); }}>
                <span aria-hidden="true">⌕</span> Find
              </button>

            </div>

            {findOpen && <div className="find-panel">
              <input ref={findInputRef} value={findQuery} onChange={(event) => setFindQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); findNextInDocument(); } if (event.key === "Escape") setFindOpen(false); }} placeholder="Find in document" aria-label="Find in document" />
              <button type="button" onClick={findNextInDocument}>Next</button>
              <button type="button" className="find-close" onClick={() => setFindOpen(false)} aria-label="Close find">&times;</button>
            </div>}

            {activeDocument && <div className="share-panel">
              <textarea className="share-input share-emails-input" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} placeholder="Add email addresses (comma or new line separated)" aria-label="Email addresses to share with" rows={1} />
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
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
                      event.preventDefault();
                      setFindOpen(true);
                      window.setTimeout(() => findInputRef.current?.focus(), 0);
                    }
                  }}
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

              <span className="editor-count">{editorWordCount} words · {editorText.length} characters</span>

              <div className="collaborators">
                <span>Collaborators</span>
                <div className="collaborator-list">
                  {collaborators.map((collaborator) => <span className="collaborator-chip" key={collaborator.id}><span>{collaborator.name}</span><button type="button" onClick={() => handleRemoveCollaborator(collaborator)} title={`Remove ${collaborator.email}`} aria-label={`Remove ${collaborator.email} from this document`}>&times;</button></span>)}
                </div>
              </div>
            </footer>

            </>}

          </main>
        </div>
        {deleteTarget && <div className="confirm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }} onKeyDown={(event) => { if (event.key === "Escape") setDeleteTarget(null); }}>
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
            <p>DELETE DOCUMENT</p>
            <h2 id="delete-dialog-title">Delete &ldquo;{deleteTarget.title}&rdquo;?</h2>
            <p id="delete-dialog-description">This document will be removed from your workspace.</p>
            <div className="confirm-actions"><button ref={cancelDeleteRef} type="button" onClick={() => setDeleteTarget(null)}>Keep document</button><button className="confirm-delete" type="button" onClick={confirmDeleteDocument}>Delete document</button></div>
          </section>
        </div>}
      </div>
    </>
  );
}

export default App;
