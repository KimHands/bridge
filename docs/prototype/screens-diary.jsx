// Bridge — Diary writing flow + detail screens
const T = window.BridgeTokens;

// 14 ──────────── Diary: Mood select (Step 1/4) ─────────────
function DiaryMoodScreen({ go, draft, setDraft }) {
  const moods = [
    { id: "good",    emoji: "😊", label: "좋음",  color: T.color.success,     bg: T.color.mintBgSoft },
    { id: "normal",  emoji: "😐", label: "평범",  color: T.color.textCaption, bg: "#F0EFF5" },
    { id: "anxious", emoji: "😟", label: "불안",  color: T.color.primary,     bg: T.color.primaryBgSoft },
    { id: "sad",     emoji: "😢", label: "우울",  color: T.color.primarySoft, bg: "#EEEAFC" },
    { id: "angry",   emoji: "😡", label: "화남",  color: T.color.danger,      bg: "#FBE9E9" },
    { id: "tired",   emoji: "😩", label: "지침",  color: T.color.warning,     bg: "#FBF1E4" },
  ];
  return (
    <Screen>
      <TopBar leading={<BackBtn onClick={() => go("home")}/>} title="오늘의 감정" trailing={<span style={{ fontSize: 12, color: T.color.textCaption, fontFamily: T.type.fontEn }}>1/4</span>}/>
      <StepProgress step={1} total={4}/>

      <div style={{ padding: "24px 24px 24px" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: T.color.textHeading, letterSpacing: -0.5 }}>
          오늘 기분이<br/>어떠셨나요?
        </div>
        <div style={{ marginTop: 10, fontSize: 14, color: T.color.textCaption, lineHeight: 1.6 }}>
          가장 가까운 감정 하나를 선택해주세요.
        </div>

        <div style={{ marginTop: 28, display:"grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {moods.map(m => {
            const sel = draft.mood === m.id;
            return (
              <button key={m.id} onClick={() => setDraft({ ...draft, mood: m.id, moodLabel: m.label, moodColor: m.color })} style={{
                background: sel ? m.bg : T.color.surface,
                border: sel ? `2px solid ${m.color}` : "2px solid transparent",
                borderRadius: 18, padding: "20px 0",
                display:"flex", flexDirection:"column", alignItems:"center", gap: 8,
                cursor:"pointer", boxShadow: T.color.shadowCard,
                transition: "all 120ms",
              }}>
                <div style={{ fontSize: 36 }}>{m.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: sel ? m.color : T.color.textHeading }}>{m.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <BottomCTA>
        <PrimaryButton onClick={() => go("diary-keyword")} disabled={!draft.mood}>다음</PrimaryButton>
      </BottomCTA>
    </Screen>
  );
}

// 15 ───────── Diary: Keywords (Step 2/4) ──────────────────
function DiaryKeywordScreen({ go, draft, setDraft }) {
  // 감정별 키워드 후보 (백엔드 응답 모킹)
  const KEYWORDS = {
    good:    ["햇살", "산책", "친구", "음악", "음식", "성취", "휴식", "사랑", "운동", "여행"],
    normal:  ["평범", "일", "출근", "휴식", "TV", "독서", "정리", "산책", "수다", "잠"],
    anxious: ["발표", "시험", "마감", "대인관계", "불면", "걱정", "심장", "떨림", "예감", "미래"],
    sad:     ["비", "외로움", "그리움", "이별", "실패", "후회", "무기력", "어둠", "혼자", "눈물"],
    angry:   ["오해", "갈등", "부당함", "짜증", "스트레스", "거짓말", "방해", "지각", "교통", "소음"],
    tired:   ["야근", "수면부족", "두통", "회의", "이동", "운동", "감기", "허리", "눈", "피로"],
  };
  const list = KEYWORDS[draft.mood] || KEYWORDS.normal;
  const selected = draft.keywords || [];
  const toggle = (k) => {
    const next = selected.includes(k) ? selected.filter(x => x !== k) : [...selected, k];
    setDraft({ ...draft, keywords: next });
  };

  return (
    <Screen>
      <TopBar leading={<BackBtn onClick={() => go("diary-mood")}/>} title="키워드" trailing={<span style={{ fontSize: 12, color: T.color.textCaption, fontFamily: T.type.fontEn }}>2/4</span>}/>
      <StepProgress step={2} total={4}/>

      <div style={{ padding: "24px 24px 24px" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: T.color.textHeading, letterSpacing: -0.5 }}>
          오늘과 가장 가까운<br/>키워드를 골라주세요
        </div>
        <div style={{ marginTop: 10, fontSize: 14, color: T.color.textCaption, lineHeight: 1.6 }}>
          여러 개를 선택할 수 있어요. ({selected.length}개 선택됨)
        </div>

        <div style={{ marginTop: 28, display:"flex", flexWrap:"wrap", gap: 10 }}>
          {list.map(k => {
            const sel = selected.includes(k);
            return (
              <button key={k} onClick={() => toggle(k)} style={{
                padding: "10px 18px", borderRadius: 9999,
                background: sel ? T.color.primary : T.color.surface,
                color: sel ? "#fff" : T.color.textBody,
                border: sel ? "none" : `1px solid ${T.color.border}`,
                fontSize: 14, fontWeight: 600, cursor:"pointer",
                fontFamily: T.type.fontKr,
                transition: "all 120ms",
              }}>#{k}</button>
            );
          })}
        </div>

        <div style={{ marginTop: 24, padding: 14, background: T.color.primaryBgWash, borderRadius: 14, display:"flex", gap: 10 }}>
          <div style={{ fontSize: 18 }}>💡</div>
          <div style={{ flex: 1, fontSize: 12, color: T.color.textBody, lineHeight: 1.6 }}>
            선택한 키워드는 매주 리포트에서 패턴 분석에 사용돼요.
          </div>
        </div>
      </div>

      <BottomCTA>
        <PrimaryButton onClick={() => go("diary-question")} disabled={selected.length === 0}>다음</PrimaryButton>
      </BottomCTA>
    </Screen>
  );
}

// 16 ─────── Diary: Detail Question (Step 3/4) ────────────
function DiaryQuestionScreen({ go, draft, setDraft }) {
  // AI가 mood + keyword 기반으로 생성한 질문 (모킹)
  const questionByMood = {
    good:    "오늘 하루 중 가장 기억에 남는 따뜻한 순간이 있다면 무엇이었나요?",
    normal:  "오늘은 어떤 점에서 평범했나요? 평범함이 주는 안정감을 느꼈나요?",
    anxious: "어떤 상황이 마음을 무겁게 했나요? 그 감정을 지금 한 단어로 표현하면?",
    sad:     "오늘 하루를 돌이켜볼 때, 가장 위로받고 싶은 순간은 언제였나요?",
    angry:   "마음을 흔들었던 일은 무엇이었나요? 지금은 어떤 마음이 드시나요?",
    tired:   "어떤 부분이 가장 지치게 했나요? 작은 회복을 위해 지금 무엇을 해볼 수 있을까요?",
  };
  const q = questionByMood[draft.mood] || questionByMood.normal;
  return (
    <Screen>
      <TopBar leading={<BackBtn onClick={() => go("diary-keyword")}/>} title="자세히 들여다보기" trailing={<span style={{ fontSize: 12, color: T.color.textCaption, fontFamily: T.type.fontEn }}>3/4</span>}/>
      <StepProgress step={3} total={4}/>

      <div style={{ padding: "24px 24px 24px" }}>
        <Card padding={20} style={{ background: T.color.primary, color:"#fff", borderRadius: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, opacity: 0.7, fontFamily: T.type.fontEn }}>BRIDGE'S QUESTION</div>
          <div style={{ marginTop: 10, fontSize: 17, fontWeight: 700, lineHeight: 1.55 }}>
            {q}
          </div>
        </Card>

        <textarea
          placeholder="자유롭게 적어보세요. 짧아도, 길어도 괜찮아요."
          value={draft.detailAnswer || ""}
          onChange={(e) => setDraft({ ...draft, detailAnswer: e.target.value })}
          rows={8}
          style={{
            marginTop: 16,
            width: "100%",
            background: T.color.surface,
            border: `1px solid ${T.color.border}`,
            borderRadius: 16,
            padding: 16,
            fontSize: 14,
            fontFamily: T.type.fontKr,
            color: T.color.textHeading,
            outline: "none",
            resize: "none",
            lineHeight: 1.7,
            boxShadow: T.color.shadowCard,
            boxSizing: "border-box",
          }}
        />
        <div style={{ marginTop: 6, textAlign: "right", fontSize: 11, color: T.color.textMuted, fontFamily: T.type.fontEn }}>
          {(draft.detailAnswer || "").length} / 500
        </div>
      </div>

      <BottomCTA>
        <div style={{ display:"flex", gap: 10 }}>
          <PrimaryButton variant="soft" full={false} onClick={() => go("diary-memo")} style={{ flex: 1 }}>건너뛰기</PrimaryButton>
          <PrimaryButton onClick={() => go("diary-memo")} style={{ flex: 2 }}>다음</PrimaryButton>
        </div>
      </BottomCTA>
    </Screen>
  );
}

// 17 ──────── Diary: Memo / free write (Step 4/4) ─────────
function DiaryMemoScreen({ go, draft, setDraft }) {
  const save = () => {
    // mock save
    go("diary-detail", { entry: {
      date: new Date().toISOString().slice(0, 10),
      mood: draft.moodLabel || "평범",
      moodColor: draft.moodColor || T.color.textCaption,
      title: draft.title || "오늘의 일기",
      preview: draft.memo || draft.detailAnswer || "",
      keywords: draft.keywords || [],
      detailAnswer: draft.detailAnswer || "",
      memo: draft.memo || "",
    }});
  };

  return (
    <Screen>
      <TopBar leading={<BackBtn onClick={() => go("diary-question")}/>} title="자유 메모" trailing={<span style={{ fontSize: 12, color: T.color.textCaption, fontFamily: T.type.fontEn }}>4/4</span>}/>
      <StepProgress step={4} total={4}/>

      <div style={{ padding: "24px 24px 24px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.color.textHeading, letterSpacing: -0.5 }}>
          오늘을 한 마디로 남긴다면?
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: T.color.textCaption }}>
          나중에 일기를 찾을 때 도움이 돼요.
        </div>

        <input
          type="text" placeholder="제목 (선택)"
          value={draft.title || ""}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          style={{
            marginTop: 20, width:"100%",
            height: 52, padding: "0 18px",
            background: T.color.surface, border: `1px solid ${T.color.border}`,
            borderRadius: 14, fontSize: 15, fontFamily: T.type.fontKr,
            outline: "none", color: T.color.textHeading,
            boxSizing:"border-box",
          }}
        />

        <textarea
          placeholder="자유롭게 메모를 남겨보세요 (선택)"
          value={draft.memo || ""}
          onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
          rows={6}
          style={{
            marginTop: 12, width:"100%",
            background: T.color.surface, border: `1px solid ${T.color.border}`,
            borderRadius: 14, padding: 14, fontSize: 14,
            fontFamily: T.type.fontKr, color: T.color.textHeading,
            outline:"none", resize:"none", lineHeight: 1.7,
            boxSizing:"border-box",
          }}
        />

        {/* Summary */}
        <Card padding={16} style={{ marginTop: 20, background: T.color.bgAlt, boxShadow:"none" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.color.textCaption, marginBottom: 10 }}>오늘의 기록 요약</div>
          <div style={{ display:"flex", alignItems:"center", gap: 8 }}>
            <Pill color={draft.moodColor} bg={(draft.moodColor || T.color.primary) + "1A"}>{draft.moodLabel || "—"}</Pill>
            <span style={{ fontSize: 11, color: T.color.textCaption }}>· 키워드 {(draft.keywords || []).length}개</span>
          </div>
          {(draft.keywords || []).length > 0 && (
            <div style={{ marginTop: 10, display:"flex", flexWrap:"wrap", gap: 6 }}>
              {draft.keywords.map((k, i) => (
                <span key={i} style={{ fontSize: 11, color: T.color.primary, fontWeight: 600 }}>#{k}</span>
              ))}
            </div>
          )}
        </Card>
      </div>

      <BottomCTA>
        <PrimaryButton onClick={save}>저장하기</PrimaryButton>
      </BottomCTA>
    </Screen>
  );
}

// 18 ─────────────── Diary Detail ─────────────────────────
function DiaryDetailScreen({ go, params }) {
  const e = params?.entry || {
    date: "2025-11-24",
    mood: "좋음", moodColor: T.color.success,
    title: "햇살 가득한 산책",
    preview: "아침에 산책을 다녀왔다. 햇살이 따뜻했고 마음이 평온해졌다.",
    keywords: ["산책", "햇살", "친구"],
    detailAnswer: "오늘 가장 기억에 남는 순간은 공원 벤치에 앉아 따뜻한 햇살을 받으며 잠시 눈을 감았던 순간이다. 마음이 천천히 가라앉으며 평온해졌다.",
    memo: "이 감각을 매일 한 번씩 느낄 수 있다면 좋겠다.",
  };
  return (
    <Screen>
      <TopBar
        leading={<BackBtn onClick={() => go("diary")}/>}
        title="일기"
        trailing={
          <button style={{ background:"none", border:"none", cursor:"pointer", color: T.color.textBody, padding: 0 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="10" cy="4.5" r="1.4"/><circle cx="10" cy="10" r="1.4"/><circle cx="10" cy="15.5" r="1.4"/>
            </svg>
          </button>
        }
      />

      <div style={{ padding: "8px 24px 32px" }}>
        <div style={{ fontSize: 12, color: T.color.textCaption, fontFamily: T.type.fontEn, fontWeight: 600 }}>
          {e.date.replace(/-/g, ". ")}
        </div>
        <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: T.color.textHeading, letterSpacing: -0.5 }}>
          {e.title}
        </div>
        <div style={{ marginTop: 12, display:"flex", alignItems:"center", gap: 8 }}>
          <Pill color={e.moodColor} bg={(e.moodColor || T.color.primary) + "1A"}>오늘의 기분 · {e.mood}</Pill>
        </div>

        {(e.keywords || []).length > 0 && (
          <Card padding={16} style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, color: T.color.primary, fontWeight: 700, fontFamily: T.type.fontEn, letterSpacing: 1.2 }}>KEYWORDS</div>
            <div style={{ marginTop: 10, display:"flex", flexWrap:"wrap", gap: 6 }}>
              {e.keywords.map((k, i) => (
                <span key={i} style={{
                  padding: "6px 12px", borderRadius: 9999,
                  background: T.color.primaryBgWash, color: T.color.primary,
                  fontSize: 12, fontWeight: 600,
                }}>#{k}</span>
              ))}
            </div>
          </Card>
        )}

        {e.detailAnswer && (
          <Card padding={20} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: T.color.primary, fontWeight: 700, fontFamily: T.type.fontEn, letterSpacing: 1.2 }}>BRIDGE'S QUESTION</div>
            <div style={{ marginTop: 8, fontSize: 13, color: T.color.textCaption, fontStyle: "italic", lineHeight: 1.5 }}>
              "오늘 하루 중 가장 기억에 남는 따뜻한 순간이 있다면 무엇이었나요?"
            </div>
            <div style={{ marginTop: 14, fontSize: 14, color: T.color.textBody, lineHeight: 1.8 }}>
              {e.detailAnswer}
            </div>
          </Card>
        )}

        {e.memo && (
          <Card padding={20} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: T.color.primary, fontWeight: 700, fontFamily: T.type.fontEn, letterSpacing: 1.2 }}>MEMO</div>
            <div style={{ marginTop: 10, fontSize: 14, color: T.color.textBody, lineHeight: 1.8 }}>
              {e.memo}
            </div>
          </Card>
        )}

        {/* AI insight */}
        <Card padding={20} style={{ marginTop: 14, background: T.color.mintBgWash, boxShadow:"none" }}>
          <div style={{ fontSize: 11, color: T.color.mintDeep, fontWeight: 700, fontFamily: T.type.fontEn, letterSpacing: 1.2 }}>BRIDGE'S NOTE</div>
          <div style={{ marginTop: 8, fontSize: 13, color: T.color.textBody, lineHeight: 1.7 }}>
            햇살, 산책 같은 자연 키워드가 자주 등장하고 있어요. 이런 작은 순간들이 당신을 회복시켜주는 것 같네요. 내일도 짧게라도 햇볕을 쐬어보세요.
          </div>
        </Card>
      </div>
    </Screen>
  );
}

// 19 ──────── Routine Detail ──────────────────────────────
function RoutineDetailScreen({ go, params }) {
  const r = params?.routine || { emoji: "🧘", title: "아침 명상", time: "07:30", duration: "5분", streak: 12 };
  return (
    <Screen>
      <TopBar leading={<BackBtn onClick={() => go("routine")}/>} title="루틴 상세"/>
      <div style={{ padding: "16px 24px 32px" }}>
        <Card padding={24} style={{ textAlign:"center", borderRadius: 20 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: T.color.primaryBgSoft, display:"inline-flex", alignItems:"center", justifyContent:"center",
            fontSize: 36,
          }}>{r.emoji}</div>
          <div style={{ marginTop: 16, fontSize: 22, fontWeight: 800, color: T.color.textHeading }}>{r.title}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: T.color.textCaption }}>매일 {r.time} · {r.duration}</div>
        </Card>

        {/* streak */}
        <Card padding={20} style={{ marginTop: 14, background: T.color.primary, color:"#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 1.2, fontWeight: 600, fontFamily: T.type.fontEn }}>CURRENT STREAK</div>
          <div style={{ marginTop: 8, display:"flex", alignItems:"baseline", gap: 6 }}>
            <span style={{ fontSize: 36, fontWeight: 800, fontFamily: T.type.fontEn }}>🔥 {r.streak || 12}</span>
            <span style={{ fontSize: 14, opacity: 0.85 }}>일 연속</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>대단해요! 7일만 더 하면 30일 배지를 받아요.</div>
        </Card>

        {/* weekly progress */}
        <Card padding={20} style={{ marginTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.color.textHeading }}>이번 주 달성</div>
          <div style={{ marginTop: 14, display:"flex", justifyContent:"space-between" }}>
            {["월","화","수","목","금","토","일"].map((d, i) => (
              <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9999,
                  background: i < 5 ? T.color.primary : T.color.bgAlt,
                  border: i === 5 ? `2px solid ${T.color.primary}` : "none",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color: i < 5 ? "#fff" : T.color.textMuted, fontSize: 14, fontWeight: 700,
                }}>
                  {i < 5 ? "✓" : i === 5 ? d : "·"}
                </div>
                <div style={{ fontSize: 10, color: T.color.textCaption, fontWeight: 600 }}>{d}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* settings */}
        <Card padding={4} style={{ marginTop: 14 }}>
          <Row label="시간" value={r.time} onClick={() => {}}/>
          <Row label="요일" value="매일"/>
          <Row label="알림" value="ON"/>
          <Row label="메모" value="—"/>
        </Card>

        <button style={{
          marginTop: 20, width: "100%", padding: 14,
          background:"transparent", border:"none", color: T.color.danger,
          fontSize: 13, fontWeight: 600, cursor:"pointer",
        }}>이 루틴 삭제</button>
      </div>
    </Screen>
  );
}

function Row({ label, value, onClick }) {
  return (
    <div onClick={onClick} style={{
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding: "14px 14px",
      borderTop: `1px solid ${T.color.borderSubtle}`,
      cursor: onClick ? "pointer" : "default",
    }}>
      <span style={{ fontSize: 13, color: T.color.textHeading, fontWeight: 500 }}>{label}</span>
      <div style={{ display:"flex", alignItems:"center", gap: 6 }}>
        <span style={{ fontSize: 13, color: T.color.textCaption }}>{value}</span>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke={T.color.textMuted} strokeWidth="1.5"><path d="M5 3l4 4-4 4"/></svg>
      </div>
    </div>
  );
}

// 20 ──────── Routine Add ─────────────────────────────────
function RoutineAddScreen({ go }) {
  const [title, setTitle] = React.useState("");
  const [emoji, setEmoji] = React.useState("🌱");
  const [time, setTime] = React.useState("07:30");
  return (
    <Screen>
      <TopBar leading={<BackBtn onClick={() => go("routine")}/>} title="루틴 추가"/>
      <div style={{ padding: "16px 24px 32px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.color.textBody, marginBottom: 8 }}>아이콘</div>
        <div style={{ display:"flex", gap: 8, flexWrap:"wrap" }}>
          {["🧘","💧","🚶","📓","🌳","🌬️","✨","🌙","🍵","📚","🎨","🎵"].map(e => (
            <button key={e} onClick={() => setEmoji(e)} style={{
              width: 48, height: 48, borderRadius: 14,
              background: emoji === e ? T.color.primary : T.color.surface,
              border: emoji === e ? "none" : `1px solid ${T.color.border}`,
              fontSize: 22, cursor:"pointer",
            }}>{e}</button>
          ))}
        </div>

        <div style={{ marginTop: 22, display:"flex", flexDirection:"column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.color.textBody, marginBottom: 8 }}>이름</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 아침 명상" style={{
              width:"100%", height: 52, padding: "0 16px",
              borderRadius: 12, border: `1px solid ${T.color.border}`,
              background: T.color.surface, fontSize: 14, fontFamily: T.type.fontKr,
              outline:"none", boxSizing:"border-box",
            }}/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.color.textBody, marginBottom: 8 }}>시간</div>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{
              width:"100%", height: 52, padding: "0 16px",
              borderRadius: 12, border: `1px solid ${T.color.border}`,
              background: T.color.surface, fontSize: 14, fontFamily: T.type.fontKr,
              outline:"none", boxSizing:"border-box",
            }}/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.color.textBody, marginBottom: 8 }}>요일</div>
            <div style={{ display:"flex", gap: 6 }}>
              {["월","화","수","목","금","토","일"].map(d => (
                <button key={d} style={{
                  flex: 1, height: 44, borderRadius: 10,
                  background: T.color.primaryBgSoft, color: T.color.primary,
                  border: "none", fontSize: 13, fontWeight: 700, cursor:"pointer",
                }}>{d}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <BottomCTA>
        <PrimaryButton onClick={() => go("routine")} disabled={!title.trim()}>추가하기</PrimaryButton>
      </BottomCTA>
    </Screen>
  );
}

// 21 ──────── Profile Edit ───────────────────────────────
function ProfileEditScreen({ go, session, setSession }) {
  const [nick, setNick] = React.useState(session?.nickname || "");
  return (
    <Screen>
      <TopBar leading={<BackBtn onClick={() => go("my")}/>} title="프로필 편집" trailing={
        <button onClick={() => { setSession({ ...session, nickname: nick }); go("my"); }} style={{
          background:"none", border:"none", color: T.color.primary, fontSize: 14, fontWeight: 700, cursor:"pointer",
        }}>저장</button>
      }/>

      <div style={{ padding: "16px 24px 32px" }}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding: "20px 0" }}>
          <div style={{
            width: 96, height: 96, borderRadius: 9999,
            background: `linear-gradient(135deg, ${T.color.primary} 0%, ${T.color.primarySoft} 100%)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontSize: 36, fontWeight: 800, fontFamily: T.type.fontDisplay,
          }}>{(nick || "B")[0]}</div>
          <button style={{
            marginTop: 12, padding: "6px 14px", borderRadius: 9999,
            background: T.color.primaryBgSoft, color: T.color.primary,
            border:"none", fontSize: 12, fontWeight: 700, cursor:"pointer",
          }}>사진 변경</button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap: 14 }}>
          <SignupInput label="닉네임" value={nick} onChange={setNick}/>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.color.textBody, marginBottom: 6 }}>이메일</div>
            <div style={{
              height: 48, borderRadius: 12, background: T.color.bgAlt,
              display:"flex", alignItems:"center", padding: "0 16px",
              fontSize: 14, color: T.color.textCaption,
            }}>brid.ge@bridge.app</div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

function SignupInput({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.color.textBody, marginBottom: 6 }}>{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{
        width: "100%", height: 48, padding: "0 16px",
        borderRadius: 12, border: `1px solid ${T.color.border}`,
        background: T.color.surface, fontSize: 14, fontFamily: T.type.fontKr,
        outline:"none", color: T.color.textHeading,
        boxSizing:"border-box",
      }}/>
    </div>
  );
}

// ─────────────── shared helpers ──────────────────────────
function StepProgress({ step, total }) {
  return (
    <div style={{ height: 4, background: T.color.borderSubtle, margin: "0 24px", borderRadius: 2 }}>
      <div style={{ height: 4, width: `${(step / total) * 100}%`, background: T.color.primary, borderRadius: 2, transition: "width 200ms" }}/>
    </div>
  );
}

function BottomCTA({ children }) {
  return (
    <div style={{
      position:"absolute", left: 0, right: 0, bottom: 0,
      padding: "16px 24px 28px",
      background: "linear-gradient(to top, rgba(250,248,255,1) 60%, rgba(250,248,255,0))",
    }}>{children}</div>
  );
}

Object.assign(window, {
  DiaryMoodScreen, DiaryKeywordScreen, DiaryQuestionScreen, DiaryMemoScreen,
  DiaryDetailScreen, RoutineDetailScreen, RoutineAddScreen, ProfileEditScreen,
});
