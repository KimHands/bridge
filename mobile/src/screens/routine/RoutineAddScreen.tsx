// RoutineAddScreen — GET /v1/routines/library 기반 라이브러리 목록 UI
// 각 루틴 카드를 클릭하면 POST /routines/me 로 추가.
// is_already_added: true 인 항목은 disabled 처리.
import React from 'react';
import {
  View, Text, Pressable,
  StyleSheet, FlatList, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, radius, shadow, spacing, typography } from '@/theme/tokens';
import { TopBar } from '@/components/BackHeader';
import { Pill } from '@/components/atoms';
import { useRoutineLibrary, useAddRoutineFromLibrary } from '@/hooks/useRoutineQueries';
import type { RoutineLibraryItem } from '@/types/routine';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// 백엔드 target_keywords의 영어 카테고리(primary_cause 코드)를 사용자 친화 한국어로 매핑.
// 한국어 감정 키워드(우울한/불안한 등)는 매핑 없이 그대로 노출.
const CATEGORY_KO: Record<string, string> = {
  sleep:        '수면',
  academic:     '학업·업무',
  future:       '미래·진로',
  financial:    '경제',
  relationship: '대인관계',
  physical:     '신체',
  unknown:      '기타',
};

const localizeKeyword = (kw: string): string => CATEGORY_KO[kw] ?? kw;

export default function RoutineAddScreen() {
  const navigation = useNavigation<Nav>();
  const { data: libraryItems, isLoading, isError } = useRoutineLibrary();
  const add = useAddRoutineFromLibrary();

  const handleAdd = async (item: RoutineLibraryItem) => {
    if (item.is_already_added || add.isPending) return;
    await add.mutateAsync(item.routine_id);
    navigation.goBack();
  };

  const renderItem = ({ item }: { item: RoutineLibraryItem }) => {
    const added = item.is_already_added;
    return (
      <Pressable
        onPress={() => handleAdd(item)}
        disabled={added || add.isPending}
        style={({ pressed }) => [
          s.card,
          added && s.cardAdded,
          !added && pressed && { opacity: 0.85 },
        ]}
      >
        <View style={s.cardHeader}>
          <Text style={[s.cardTitle, added && s.textMuted]} numberOfLines={1}>
            {item.title}
          </Text>
          {added && (
            <View style={s.addedBadge}>
              <Text style={s.addedBadgeText}>추가됨</Text>
            </View>
          )}
        </View>

        {item.description.length > 0 && (
          <Text style={[s.cardDesc, added && s.textMuted]} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {item.target_keywords.length > 0 && (
          <View style={s.pillRow}>
            {item.target_keywords.map((kw) => (
              <Pill
                key={kw}
                color={added ? palette.textMuted : palette.primary}
                bg={added ? palette.borderSubtle : palette.primaryBgSoft}
              >
                {localizeKeyword(kw)}
              </Pill>
            ))}
          </View>
        )}
      </Pressable>
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={s.center}>
          <ActivityIndicator color={palette.primary} />
        </View>
      );
    }
    if (isError || !libraryItems) {
      return (
        <View style={s.center}>
          <Text style={s.emptyText}>루틴 목록을 불러올 수 없어요.{'\n'}잠시 후 다시 시도해 주세요.</Text>
        </View>
      );
    }
    if (libraryItems.length === 0) {
      return (
        <View style={s.center}>
          <Text style={s.emptyText}>추가할 수 있는 루틴이 없어요.</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={libraryItems}
        keyExtractor={(item) => String(item.routine_id)}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    );
  };

  return (
    <View style={s.screen}>
      <TopBar onBack={() => navigation.goBack()} title="루틴 추가" />
      <Text style={s.subtitle}>원하는 루틴을 선택하면 바로 추가돼요.</Text>
      {renderBody()}
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  subtitle: {
    ...typography.caption,
    color: palette.textCaption,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.card,
  },
  cardAdded: {
    backgroundColor: palette.bgAlt,
    ...shadow.card,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: palette.textHeading,
    flex: 1,
    marginRight: spacing.sm,
  },
  cardDesc: {
    ...typography.body,
    color: palette.textBody,
    marginBottom: spacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  addedBadge: {
    backgroundColor: palette.borderSubtle,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  addedBadgeText: {
    ...typography.captionBold,
    color: palette.textMuted,
  },
  textMuted: {
    color: palette.textMuted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: palette.textCaption,
    textAlign: 'center',
    lineHeight: 22,
  },
});
