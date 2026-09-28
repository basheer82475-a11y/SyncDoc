export type Document = {
  id: string
  title: string
  content: string
  permission?: 'owner' | 'editor' | 'viewer'
  createdAt: string
  updatedAt: string
}

export type AccountStatus = 'active' | 'blocked' | 'banned'
export type User = { id: string; name: string; email: string; role?: 'user' | 'admin'; status?: AccountStatus }
export type RegisteredUser = Pick<User, 'id' | 'name' | 'email' | 'role'> & { status: AccountStatus; createdAt: string }
export type Collaborator = User & { permission: 'owner' | 'editor' | 'viewer' }
export type AuthResponse = { token: string; user: User }

const apiUrl = '/api/documents'
const tokenKey = 'syncdoc-token'

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(input, {
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      ...init,
    })
  } catch {
    throw new Error('Cannot reach SyncDoc server. Start the backend with npm run dev from the project root.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message || `Request failed (${response.status})`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function getToken() { return localStorage.getItem(tokenKey) }
export function saveSession(response: AuthResponse) { localStorage.setItem(tokenKey, response.token); return response.user }
export function clearSession() { localStorage.removeItem(tokenKey) }

export function login(email: string, password: string) { return request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }) }
export function register(name: string, email: string, password: string) { return request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }) }
export function me() { return request<User>('/api/auth/me') }
export function logout() { return request<void>('/api/auth/logout', { method: 'POST' }) }

export function getDocuments(search = '') {
  return request<Document[]>(`${apiUrl}${search ? `?search=${encodeURIComponent(search)}` : ''}`)
}

export function createDocument(document: Pick<Document, 'title' | 'content'>) {
  return request<Document>(apiUrl, {
    method: 'POST',
    body: JSON.stringify(document),
  })
}

export function updateDocument(document: Document) {
  return request<Document>(`${apiUrl}/${document.id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: document.title, content: document.content }),
  })
}

export function deleteDocument(id: string) {
  return request<void>(`${apiUrl}/${id}`, { method: 'DELETE' })
}

export function shareDocument(id: string, email: string, permission: 'editor' | 'viewer') { return request<{ email: string; name: string; permission: string }>(`${apiUrl}/${id}/share`, { method: 'POST', body: JSON.stringify({ email, permission }) }) }
export function getCollaborators(id: string) { return request<Collaborator[]>(`${apiUrl}/${id}/collaborators`) }
export function removeCollaborator(documentId: string, userId: string) { return request<void>(`/api/sharing/${encodeURIComponent(documentId)}/${encodeURIComponent(userId)}`, { method: 'DELETE' }) }
export function getRegisteredUsers() { return request<{ users: RegisteredUser[] }>('/api/admin/users').then((response) => response.users) }
export function setRegisteredUserStatus(id: string, status: AccountStatus) {
  return request<{ user: RegisteredUser }>(`/api/admin/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }).then((response) => response.user)
}
