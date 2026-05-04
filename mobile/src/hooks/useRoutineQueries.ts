import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routines } from '@/lib/api';
import type {
  RoutineListResponse,
  RoutineCompleteResponse,
  RoutineAddResponse,
  RoutineLibraryItem,
} from '@/types/routine';

export const useRoutineList = () =>
  useQuery<RoutineListResponse, Error>({
    queryKey: ['routines'],
    queryFn: routines.list,
  });

export const useToggleRoutine = () => {
  const qc = useQueryClient();
  return useMutation<RoutineCompleteResponse, Error, { id: string; done: boolean }>({
    mutationFn: ({ id, done }) =>
      done ? routines.complete(id) : routines.uncomplete(id),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ['routines'] });
      const prev = qc.getQueryData<RoutineListResponse>(['routines']);
      qc.setQueryData<RoutineListResponse>(['routines'], (old) => {
        if (!old) return old;
        return {
          ...old,
          routines: old.routines.map((r) =>
            r.user_routine_id === id ? { ...r, is_completed_today: done } : r,
          ),
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const context = ctx as { prev?: RoutineListResponse } | undefined;
      if (context?.prev) qc.setQueryData(['routines'], context.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  });
};

export const useRoutineLibrary = () =>
  useQuery<RoutineLibraryItem[], Error>({
    queryKey: ['routines', 'library'],
    queryFn: () => routines.library().then((res) => res.routines),
  });

export const useAddRoutineFromLibrary = () => {
  const qc = useQueryClient();
  return useMutation<RoutineAddResponse, Error, number>({
    mutationFn: (routine_id: number) => routines.addFromLibrary(routine_id),
    onSuccess: () => {
      // 내 루틴 목록 + 라이브러리(is_already_added 갱신) 동시 invalidate
      qc.invalidateQueries({ queryKey: ['routines'] });
    },
  });
};

export const useDeleteRoutine = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => routines.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  });
};
