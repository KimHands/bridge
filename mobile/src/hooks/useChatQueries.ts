import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chat } from '@/lib/api';
import type { ChatMessageResponse, MemoryListResponse } from '@/types/chat';

export const useSendMessage = () =>
  useMutation<ChatMessageResponse, Error, string>({
    mutationFn: (message: string) => chat.send({ message }),
  });

export const useMemories = () =>
  useQuery<MemoryListResponse, Error>({
    queryKey: ['chat', 'memories'],
    queryFn: chat.memories,
  });

export const useClearMemories = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: chat.clearMemories,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'memories'] }),
  });
};
