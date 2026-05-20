export interface AuthUser {
  nik: string
  nama: string
  username: string
  password: string
}

export const USERS: AuthUser[] = [
  { nik: '170050', nama: 'Vania Sanjaya',             username: 'vania',   password: 'vania123'   },
  { nik: '230011', nama: 'Aditya Ari Pratama',        username: 'aditya',  password: 'aditya123'  },
  { nik: '210070', nama: 'Luqmanul Hakim Aziz',       username: 'luqman',  password: 'luqman123'  },
  { nik: '200030', nama: 'Rizaldi Andriyana',         username: 'rizaldi', password: 'rizaldi123' },
  { nik: '190082', nama: 'Zamzam Jamaludin Abdullah', username: 'zamzam',  password: 'zamzam123'  },
  { nik: '260018', nama: 'Zulvan Fadhillah',          username: 'zulvan',  password: 'zulvan123'  },
]

export const SESSION_KEY = 'lembur_user'

export function validateLogin(username: string, password: string): AuthUser | null {
  return USERS.find(
    u => u.username === username.toLowerCase().trim() && u.password === password
  ) ?? null
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function storeUser(user: AuthUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearUser(): void {
  localStorage.removeItem(SESSION_KEY)
}
