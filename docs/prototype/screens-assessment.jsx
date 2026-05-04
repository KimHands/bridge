// Bridge — AI Assessment + Initial Routine setup screens
const T = window.BridgeTokens;

// 07 ───────────── AI Self-Assessment ──────────────────────
// PHQ-9 inspired (백엔드: POST /assessments)
const ASSESSMENT_QUESTIONS = [
  "지난 2주간, 일상에 대한 흥미나 즐거움이 줄어들었다고 느꼈나요?",
  "지난 2주간, 우울하거나 절망감을 느낀 적이 있나요?",
  "지난 2주간, 잠들기 어렵거나 너무 많이 잤나요?",
  "지난 2주간, 피곤하거나 기운이 없다고 느꼈나요?",
  "지난 2주간, 식욕이 줄거나 과식한 적이 있나요?",
  "지난 2주간, 자신이 실패자라고 느낀 적이 있나요?",
  "지난 2주간, 집중하기 어려웠나요?",
  "지난 2주간, 평소보다 말이나 행동이 느려졌다고 느꼈나요?",
  "지난 2주간, 차라리 죽는 게 낫겠다는 생각을 한 적이 있나요?",
];
const ASSESSMENT_OPTIONS = [
  { score: 0, label: "전혀 없음" },
  { score: 1, label: "며칠 동안" },
  { score: 2, label: "절반 이상" },
  { score: 3, label: "거의 매일" },
];

function AssessmentScreen({ go, setSession }) {
  const [step, setStep] = React.useState(0); // 0..8 questions, 9 = result
  const [answers, setAnswers] = React.useState(Array(9).fill(null));
  const [showResult, setShowResult] = React.useState(false);

  const total = answers.reduce((a, b) => a + (b ?? 0), 0);
  const level = total >= 20 ? "심각" : total >= 15 ? "중증" : total >= 10 ? "중등도" : total >= 5 ? "경증" : "정상";
  const levelColor = total >= 15 ? T.color.danger : total >= 10 ? T.color.warning : total >= 5 ? T.color.primary : T.color.success;

  if (showResult) {
    return (
      <Screen>
        <DecorativeBlobs/>
        <TopBar title="AI 마음 진단" transparent/>
        <div style={{ padding: "24px 24px 32px", position:"relative", zIndex:2 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{
              width: 96, height: 96, borderRadius: 9999, background: T.color.primaryBgSoft,
              display:"inline-flex", alignItems:"center", justifyContent:"center",
              fontSize: 42,
            }}>🌱</div>
            <div style={{ marginTop: 24, fontSize: 14, color: T.color.textCaption, fontFamily: T.type.fontEn, letterSpacing: 1.5, fontWeight: 600 }}>YOUR RESULT</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: T.color.textHeading }}>{level}</div>
            <div style={{ marginTop: 4, fontSize: 14, color: T.color.textCaption }}>총점 <strong style={{ color: levelColor }}>{total}</strong>/27</div>
          </div>

          <Card padding={20} style={{ marginTop: 28, borderRadius: 20 }}>
            <div style={{ fontSize: 13, color: T.color.primary, fontWeight: 700, fontFamily: T.type.fontEn, letterSpacing: 1.2 }}>BRIDGE'S NOTE</div>
            <div style={{ marginTop: 10, fontSize: 14, color: T.color.textBody, lineHeight: 1.7 }}>
              {total < 5 && "현재 마음 상태가 안정적이에요. 가벼운 루틴으로 이 흐름을 이어가요."}
              {total >= 5 && total < 10 && "조금 지친 신호가 보여요. 작은 회복 루틴부터 함께 시작해봐요."}
              {total >= 10 && total < 15 && "마음에 무게가 쌓여있어요. 매일의 기록과 명상이 도움이 될 거예요."}
              {total >= 15 && "지금 많이 힘드시군요. 전문가의 도움을 받는 것도 고려해보세요. 브릿지가 함께할게요."}
            </div>
          </Card>

          <Card padding={16} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.color.textHeading, marginBottom: 10 }}>추천 루틴</div>
            {["아침 명상 5분", "감정 일기 쓰기", "수분 챙기기"].map((r, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap: 10, padding: "8px 0", fontSize: 13, color: T.color.textBody }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: T.color.primary }}/>
                {r}
              </div>
            ))}
          </Card>

          <div style={{ marginTop: 24 }}>
            <PrimaryButton onClick={() => go("initial-routine")}>루틴 설정하러 가기</PrimaryButton>
          </div>
        </div>
      </Screen>
    );
  }

  const q = ASSESSMENT_QUESTIONS[step];
  const progress = ((step) / ASSESSMENT_QUESTIONS.length) * 100;

  const select = (score) => {
    const next = [...answers]; next[step] = score; setAnswers(next);
    setTimeout(() => {
      if (step < ASSESSMENT_QUESTIONS.length - 1) setStep(step + 1);
      else setShowResult(true);
    }, 250);
  };

  return (
    <Screen scroll={false}>
      <TopBar
        leading={step > 0 ? <BackBtn onClick={() => setStep(step - 1)}/> : <BackBtn onClick={() => go("signup")}/>}
        title="AI 마음 진단"
        trailing={<span style={{ fontSize: 13, color: T.color.textCaption, fontFamily: T.type.fontEn }}>{step + 1}/{ASSESSMENT_QUESTIONS.length}</span>}
      />
      {/* progress bar */}
      <div style={{ height: 4, background: T.color.borderSubtle, margin: "0 24px", borderRadius: 2 }}>
        <div style={{ height: 4, width: `${progress}%`, background: T.color.primary, borderRadius: 2, transition: "width 200ms" }}/>
      </div>

      <div style={{ padding: "32px 28px" }}>
        <div style={{ fontSize: 13, color: T.color.primary, fontWeight: 700, fontFamily: T.type.fontEn, letterSpacing: 1.5 }}>QUESTION {String(step + 1).padStart(2, "0")}</div>
        <div style={{ marginTop: 12, fontSize: 22, fontWeight: 700, color: T.color.textHeading, lineHeight: 1.45, letterSpacing: -0.3 }}>
          {q}
        </div>
      </div>

      <div style={{ padding: "0 28px", display:"flex", flexDirection:"column", gap: 12 }}>
        {ASSESSMENT_OPTIONS.map(o => (
          <button key={o.score} onClick={() => select(o.score)} style={{
            height: 64, padding: "0 20px",
            borderRadius: 16,
            background: answers[step] === o.score ? T.color.primary : T.color.surface,
            color: answers[step] === o.score ? "#fff" : T.color.textHeading,
            border: `1px solid ${answers[step] === o.score ? T.color.primary : T.color.border}`,
            display:"flex", alignItems:"center", justifyContent:"space-between",
            fontSize: 15, fontWeight: 600, fontFamily: T.type.fontKr,
            cursor:"pointer", transition: "all 120ms",
            boxShadow: answers[step] === o.score ? T.color.shadowFab : T.color.shadowCard,
          }}>
            <span>{o.label}</span>
            <span style={{ fontSize: 12, opacity: 0.7, fontFamily: T.type.fontEn }}>+{o.score}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}

// 08 ───────────── Initial Routine setup ──────────────────
// 8개의 추천 루틴 중에서 사용자가 선택
const ROUTINE_LIBRARY = [
  { id: "meditation",  emoji: "🧘", title: "아침 명상", time: "5분", tag: "마음 챙김", color: "#A8D8D0" },
  { id: "water",       emoji: "💧", title: "물 한 잔",  time: "1분",  tag: "건강",     color: "#B6CDFF" },
  { id: "stretch",     emoji: "🚶", title: "스트레칭",  time: "10분", tag: "활력",     color: "#FFD0AB" },
  { id: "journal",     emoji: "📓", title: "감정 일기", time: "5분",  tag: "기록",     color: "#E4DFFF" },
  { id: "walk",        emoji: "🌳", title: "산책",      time: "20분", tag: "활동",     color: "#C9E5C0" },
  { id: "breathing",   emoji: "🌬️", title: "호흡 운동", time: "3분",  tag: "이완",     color: "#B9E9E1" },
  { id: "gratitude",   emoji: "✨", title: "감사 일기", time: "3분",  tag: "마음",     color: "#FFE0E0" },
  { id: "sleep",       emoji: "🌙", title: "수면 정돈", time: "5분",  tag: "휴식",     color: "#D6CEFF" },
];

function InitialRoutineScreen({ go }) {
  const [selected, setSelected] = React.useState(new Set(["meditation", "water", "journal"]));
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  return (
    <Screen>
      <TopBar leading={<BackBtn onClick={() => go("ai-assessment")}/>} title="첫 루틴 설정"/>
      <div style={{ padding: "8px 24px 100px" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: T.color.textHeading, letterSpacing: -0.5 }}>
          어떤 루틴으로<br/>시작해볼까요?
        </div>
        <div style={{ marginTop: 10, fontSize: 14, color: T.color.textCaption, lineHeight: 1.6 }}>
          최소 3개 이상 선택하면 더 풍성한<br/>일상을 함께 만들어갈 수 있어요.
        </div>

        <div style={{ marginTop: 20, fontSize: 13, color: T.color.primary, fontWeight: 600 }}>
          {selected.size}개 선택됨
        </div>

        <div style={{ marginTop: 12, display:"grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {ROUTINE_LIBRARY.map(r => {
            const isSelected = selected.has(r.id);
            return (
              <div key={r.id} onClick={() => toggle(r.id)} style={{
                background: isSelected ? T.color.primary : T.color.surface,
                color: isSelected ? "#fff" : T.color.textHeading,
                borderRadius: 18, padding: 16,
                cursor:"pointer", transition:"all 120ms",
                border: `1.5px solid ${isSelected ? T.color.primary : "transparent"}`,
                boxShadow: isSelected ? T.color.shadowFab : T.color.shadowCard,
                position:"relative",
                minHeight: 120,
                display:"flex", flexDirection:"column", justifyContent:"space-between",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: isSelected ? "rgba(255,255,255,0.2)" : r.color,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize: 22,
                }}>{r.emoji}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{r.title}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: isSelected ? "rgba(255,255,255,0.75)" : T.color.textCaption }}>
                    {r.time} · {r.tag}
                  </div>
                </div>
                {isSelected && (
                  <div style={{
                    position:"absolute", top: 12, right: 12,
                    width: 22, height: 22, borderRadius: 11,
                    background: "#fff", display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 4" stroke={T.color.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 24, padding: 16, borderRadius: 14, background: T.color.mintBgWash, display:"flex", alignItems:"center", gap: 12 }}>
          <div style={{ fontSize: 22 }}>💡</div>
          <div style={{ flex: 1, fontSize: 12, color: T.color.textBody, lineHeight: 1.5 }}>
            루틴은 언제든지 추가하거나 제거할 수 있어요.<br/>부담없이 마음에 드는 것부터 시작해보세요.
          </div>
        </div>
      </div>

      <div style={{
        position:"absolute", left: 0, right: 0, bottom: 0,
        padding: "16px 24px 28px",
        background: "linear-gradient(to top, rgba(250,248,255,1) 60%, rgba(250,248,255,0))",
      }}>
        <PrimaryButton
          onClick={() => go("home")}
          disabled={selected.size < 3}
        >{selected.size < 3 ? `${3 - selected.size}개 더 선택해주세요` : "시작하기"}</PrimaryButton>
      </div>
    </Screen>
  );
}

Object.assign(window, { AssessmentScreen, InitialRoutineScreen, ROUTINE_LIBRARY, ASSESSMENT_QUESTIONS, ASSESSMENT_OPTIONS });
