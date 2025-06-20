import { EnhancedChatRoom } from '@/components/enhanced-chat-room';

export default function ChatRoomPage({ params }: { params: { username: string } }) {
  return <EnhancedChatRoom targetUsername={params.username} />;
}