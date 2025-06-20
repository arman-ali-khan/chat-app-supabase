'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { UserList } from '@/components/user-list';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) {
      router.push('/');
    }
  }, [currentUser, router]);

  if (!currentUser) return null;

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <UserList
          currentUser={currentUser}
          onUserSelect={(username) => router.push(`/chat/${username}`)}
          onLogout={() => {
            localStorage.removeItem('currentUser');
            router.push('/');
          }}
        />
      </div>
    </div>
  );
}