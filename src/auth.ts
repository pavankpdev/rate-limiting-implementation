// In-memory user store with username and password
interface User {
  username: string;
  password: string;
  userId: string;
}

const users: Map<string, User> = new Map([
  ['user1', { username: 'user1', password: 'pass1', userId: 'user1' }],
  ['user2', { username: 'user2', password: 'pass2', userId: 'user2' }],
  ['admin', { username: 'admin', password: 'admin123', userId: 'admin' }],
]);

/**
 * Authenticates a user with username and password
 * @param username - The username to authenticate
 * @param password - The password to verify
 * @returns Object with success status and userId (null if failed)
 */
export function authenticateUser(
  username: string,
  password: string
): { success: boolean; userId: string | null } {
  const user = users.get(username);
  
  if (!user) {
    return { success: false, userId: null };
  }
  
  if (user.password === password) {
    return { success: true, userId: user.userId };
  }
  
  return { success: false, userId: null };
}

/**
 * Generates a unique guest user ID
 * @returns A unique guest ID string
 */
export function generateGuestId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `guest_${timestamp}_${random}`;
}