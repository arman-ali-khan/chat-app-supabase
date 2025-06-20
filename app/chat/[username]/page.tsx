

import { ChatRoom } from '@/components/chat-room';

export default function ChatRoomPage({ params }: { params: { username: string } }) {
  return <ChatRoom targetUsername={params.username} />;
}