import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'

function App() {
  return (
    <div className="app">
      <Header />

      <main className="main">
        <Sidebar />
        <Editor />
      </main>
    </div>
  )
}

export default App