import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'web3-chat-default-key-2024';

export function encryptMessage(message: string): string {
  try {
    const encrypted = CryptoJS.AES.encrypt(message, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption failed:', error);
    return message; // Fallback to plain text if encryption fails
  }
}

export function decryptMessage(encryptedMessage: string): string {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, ENCRYPTION_KEY);
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    return plaintext || encryptedMessage; // Fallback if decryption fails
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedMessage; // Return encrypted text if decryption fails
  }
}

export function generateChatRoomKey(user1Id: string, user2Id: string): string {
  // Create a consistent key for the chat room regardless of user order
  const sortedIds = [user1Id, user2Id].sort();
  return `${sortedIds[0]}-${sortedIds[1]}`;
}