function Header() {
  return (
    <header className="header">
      <div>
        <h1>SyncDoc</h1>
        <p>Collaborative Document Editor</p>
      </div>

      <div className="connection-status">
        <span className="status-dot"></span>
        Connected
      </div>
    </header>
  )
}

export default Header