// Bridge — Main tab screens (Home, Routine, DiaryList, Report, MyPage)
const T = window.BridgeTokens;

// 09 ───────────────────── Home ───────────────────────────
function HomeScreen({ go, session, tab, setTab }) {
  const today = new Date();
  const dateStr = `${today.getMonth()+1}월 ${today.getDate()}일`;
  const weekDay = ["일","월","화","수","목","금","토"][today.getDay()];
  return (
    <Screen>
      {/* Hero header */}
      <div style={{
        padding: "20px 24px 28px",
        background: `linear-gradient(180deg, ${T.color.primaryBgSoft} 0%, ${T.color.bg} 100%)`,
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize: 12, color: T.color.textCaption, fontFamily: T.type.fontEn, fontWeight: 600 }}>
              {dateStr} · {weekDay}요일
            </div>
            <div style={{ marginTop: 4, fontSize: 22, fontWeight: 800, color: T.color.textHeading, letterSpacing: -0.5 }}>
              안녕하세요 <span style={{ color: T.color.primary }}>{session?.nickname || "친구"}</span>님,
            </div>
            <div style={{ fontSize: 14, color: T.color.textCaption, marginTop: 2 }}>오늘도 마음 한 켠을 살펴볼까요?</div>
          </div>
          <div style={{ display:"flex", gap: 8 }}>
            <IconBtn ariaLabel="알림" onClick={() => {}}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M9 2a5 5 0 0 1 5 5v3l1.5 2.5h-13L4 10V7a5 5 0 0 1 5-5z"/><path d="M7 14a2 2 0 0 0 4 0"/>
              </svg>
            </IconBtn>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 100px", marginTop: -8 }}>
        {/* Today mood chip — quick log */}
        <Card padding={16} style={{ borderRadius: 20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: T.color.primary, fontWeight: 700, letterSpacing: 1.2, fontFamily: T.type.fontEn }}>TODAY'S MOOD</div>
              <div style={{ marginTop: 4, fontSize: 15, fontWeight: 700, color: T.color.textHeading }}>오늘의 기분을 기록해보세요</div>
            </div>
            <button onClick={() => go("diary-mood")} style={{
              padding: "8px 14px", borderRadius: 9999, background: T.color.primary, color:"#fff",
              border:"none", fontSize: 12, fontWeight: 700, cursor:"pointer",
            }}>기록하기 →</button>
          </div>
          <div style={{ marginTop: 16, display:"flex", justifyContent:"space-between", padding: "0 4px" }}>
            {[
              { e: "😡", l: "화남" },
              { e: "😢", l: "우울" },
              { e: "😟", l: "불안" },
              { e: "😐", l: "평범" },
              { e: "😊", l: "좋음" },
            ].map((m, i) => (
              <button key={i} onClick={() => go("diary-mood")} style={{
                width: 52, height: 64, borderRadius: 14,
                background: T.color.bgAlt, border:"none", cursor:"pointer",
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap: 4,
              }}>
                <span style={{ fontSize: 22 }}>{m.e}</span>
                <span style={{ fontSize: 10, color: T.color.textCaption }}>{m.l}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Today's Routine summary */}
        <Card padding={20} style={{ marginTop: 14 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.color.textHeading }}>오늘의 루틴</div>
            <button onClick={() => setTab("routine")} style={{ background:"none", border:"none", color: T.color.primary, fontSize: 12, fontWeight: 600, cursor:"pointer" }}>전체보기 →</button>
          </div>
          <div style={{ marginTop: 12, display:"flex", alignItems:"center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display:"flex", alignItems:"baseline", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: T.color.primary, fontFamily: T.type.fontEn }}>2</span>
                <span style={{ fontSize: 14, color: T.color.textCaption, fontFamily: T.type.fontEn }}>/ 4 완료</span>
              </div>
              <div style={{ marginTop: 8, height: 6, background: T.color.bgAlt, borderRadius: 3, overflow:"hidden" }}>
                <div style={{ width: "50%", height:"100%", background: T.color.primary, borderRadius: 3 }}/>
              </div>
            </div>
            <CircleGauge value={50}/>
          </div>
          <div style={{ marginTop: 14, display:"flex", flexDirection:"column", gap: 8 }}>
            <RoutineLine emoji="🧘" label="아침 명상" sub="5분" done/>
            <RoutineLine emoji="💧" label="물 한 잔" sub="3/8 잔"/>
          </div>
        </Card>

        {/* AI Assistant card */}
        <Card padding={0} style={{ marginTop: 14, overflow:"hidden", background: T.color.primary, color:"#fff" }}>
          <div style={{ padding: 20, position:"relative" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, opacity: 0.7, fontFamily: T.type.fontEn }}>BRIDGE'S NOTE</div>
            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>
              어제 일기를 분석해 봤어요.<br/>"불안" 키워드가 자주 등장했네요.
            </div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85, lineHeight: 1.6 }}>
              호흡 운동 루틴을 추가해 보는 건 어떨까요?
            </div>
            <button onClick={() => go("report")} style={{
              marginTop: 14, padding: "8px 14px", borderRadius: 9999, background: "rgba(255,255,255,0.2)",
              border:"none", color:"#fff", fontSize: 12, fontWeight: 700, cursor:"pointer",
            }}>리포트 보기 →</button>
            <div style={{
              position:"absolute", right: -20, top: -20, width: 120, height: 120, borderRadius: 9999,
              background: "rgba(255,255,255,0.08)",
            }}/>
          </div>
        </Card>

        {/* Recent diary */}
        <div style={{ marginTop: 22, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.color.textHeading }}>최근 일기</div>
          <button onClick={() => setTab("diary")} style={{ background:"none", border:"none", color: T.color.primary, fontSize: 12, fontWeight: 600, cursor:"pointer" }}>전체보기 →</button>
        </div>
        <div style={{ marginTop: 10, display:"flex", flexDirection:"column", gap: 10 }}>
          <DiaryRow date="11.24" mood="좋음" moodColor={T.color.success} preview="아침에 산책을 다녀왔다. 햇살이 따뜻했고..." onClick={() => go("diary-detail")}/>
          <DiaryRow date="11.23" mood="평범" moodColor={T.color.textCaption} preview="평범한 하루였다. 일이 많아서 조금 지쳤지만..."/>
          <DiaryRow date="11.22" mood="불안" moodColor={T.color.primary} preview="발표를 앞두고 잠이 잘 안 왔다..."/>
        </div>
      </div>

      <BottomTabBar active={tab} onChange={setTab}/>
    </Screen>
  );
}

function IconBtn({ children, onClick, ariaLabel }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel} style={{
      width: 40, height: 40, borderRadius: 12, background:"#fff", border:"none", cursor:"pointer",
      display:"flex", alignItems:"center", justifyContent:"center",
      color: T.color.textBody, boxShadow: T.color.shadowCard,
    }}>{children}</button>
  );
}

function RoutineLine({ emoji, label, sub, done }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap: 12, padding: "8px 0" }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: T.color.bgAlt, display:"flex", alignItems:"center", justifyContent:"center", fontSize: 14 }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.color.textHeading, textDecoration: done ? "line-through" : "none", opacity: done ? 0.5 : 1 }}>{label}</div>
      </div>
      <div style={{ fontSize: 11, color: T.color.textCaption }}>{sub}</div>
      <div style={{
        width: 18, height: 18, borderRadius: 9, border: `1.5px solid ${done ? T.color.primary : T.color.borderStrong}`,
        background: done ? T.color.primary : "transparent",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>{done && <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2.5 6L5 8.5L9.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
    </div>
  );
}

function DiaryRow({ date, mood, moodColor, preview, onClick }) {
  return (
    <Card onClick={onClick} padding={14} style={{ cursor:"pointer", display:"flex", alignItems:"center", gap: 14 }}>
      <div style={{ width: 44, textAlign:"center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.color.textHeading, fontFamily: T.type.fontEn, lineHeight: 1 }}>{date.split(".")[1]}</div>
        <div style={{ fontSize: 9, color: T.color.textMuted, fontWeight: 600, marginTop: 2, fontFamily: T.type.fontEn }}>{date.split(".")[0]}월</div>
      </div>
      <div style={{ width: 1, height: 28, background: T.color.borderSubtle }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Pill color={moodColor} bg={moodColor + "1A"}>{mood}</Pill>
        <div style={{ marginTop: 6, fontSize: 12, color: T.color.textBody, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{preview}</div>
      </div>
    </Card>
  );
}

// 10 ───────────────────── Routine list/detail ─────────────
function RoutineScreen({ go, tab, setTab }) {
  const [items, setItems] = React.useState([
    { id: 1, emoji: "🧘", title: "아침 명상", time: "07:30", duration: "5분", done: true,  streak: 12 },
    { id: 2, emoji: "💧", title: "물 8잔 마시기", time: "종일", duration: "—", done: false, progress: { cur: 3, total: 8 }, streak: 5 },
    { id: 3, emoji: "🚶", title: "가벼운 스트레칭", time: "12:00", duration: "10분", done: true, streak: 7 },
    { id: 4, emoji: "📓", title: "감정 일기", time: "22:00", duration: "5분", done: false, streak: 3 },
  ]);

  const toggle = (id) => setItems(items.map(it => it.id === id ? { ...it, done: !it.done } : it));
  const completedCount = items.filter(i => i.done).length;

  return (
    <Screen>
      <div style={{ padding: "20px 24px 16px" }}>
        <div style={{ fontSize: 12, color: T.color.primary, fontWeight: 700, letterSpacing: 1.5, fontFamily: T.type.fontEn }}>MY ROUTINE</div>
        <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: T.color.textHeading, letterSpacing: -0.5 }}>오늘의 루틴</div>
      </div>

      {/* progress card */}
      <div style={{ padding: "0 24px" }}>
        <Card padding={20} style={{ background: T.color.primary, color:"#fff" }}>
          <div style={{ display:"flex", alignItems:"center", gap: 16 }}>
            <CircleGaugeBig value={(completedCount / items.length) * 100}/>
            <div>
              <div style={{ fontSize: 12, opacity: 0.75, fontFamily: T.type.fontEn, fontWeight: 600 }}>TODAY'S PROGRESS</div>
              <div style={{ marginTop: 2, fontSize: 22, fontWeight: 800 }}>
                {completedCount} <span style={{ fontSize: 14, opacity: 0.75 }}>/ {items.length} 완료</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                완벽해요! 이대로 계속 이어가요 ✨
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ padding: "20px 24px 100px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.color.textCaption, marginBottom: 10 }}>전체 루틴</div>
        <div style={{ display:"flex", flexDirection:"column", gap: 10 }}>
          {items.map(it => (
            <Card key={it.id} padding={16} style={{ display:"flex", alignItems:"center", gap: 14 }} onClick={() => go("routine-detail", { routine: it })}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: it.done ? T.color.mintBgSoft : T.color.bgAlt,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize: 20,
                opacity: it.done ? 0.7 : 1,
              }}>{it.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.color.textHeading, textDecoration: it.done ? "line-through" : "none", opacity: it.done ? 0.5 : 1 }}>{it.title}</div>
                <div style={{ marginTop: 2, fontSize: 11, color: T.color.textCaption, display:"flex", gap: 8 }}>
                  <span>⏰ {it.time}</span>
                  {it.duration !== "—" && <span>· {it.duration}</span>}
                  <span>· 🔥 {it.streak}일째</span>
                </div>
                {it.progress && (
                  <div style={{ marginTop: 6, display:"flex", alignItems:"center", gap: 6 }}>
                    <div style={{ flex: 1, height: 4, background: T.color.bgAlt, borderRadius: 2, overflow:"hidden" }}>
                      <div style={{ width: `${(it.progress.cur / it.progress.total) * 100}%`, height:"100%", background: T.color.primary }}/>
                    </div>
                    <span style={{ fontSize: 10, color: T.color.textMuted, fontFamily: T.type.fontEn, fontWeight: 600 }}>{it.progress.cur}/{it.progress.total}</span>
                  </div>
                )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); toggle(it.id); }} style={{
                width: 28, height: 28, borderRadius: 14,
                border: `1.5px solid ${it.done ? T.color.primary : T.color.borderStrong}`,
                background: it.done ? T.color.primary : "transparent",
                cursor:"pointer", padding: 0,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                {it.done && <svg width="14" height="14" viewBox="0 0 12 12"><path d="M2.5 6L5 8.5L9.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            </Card>
          ))}
        </div>

        <button onClick={() => go("routine-add")} style={{
          marginTop: 14, width:"100%", padding: "16px",
          background:"transparent", border: `1.5px dashed ${T.color.borderStrong}`,
          borderRadius: 16, color: T.color.primary, fontSize: 14, fontWeight: 600,
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap: 6,
        }}>
          <span style={{ fontSize: 18 }}>+</span> 새로운 루틴 추가
        </button>
      </div>

      <BottomTabBar active={tab} onChange={setTab}/>
    </Screen>
  );
}

function CircleGaugeBig({ value }) {
  const r = 28, c = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6"/>
      <circle cx="36" cy="36" r={r} fill="none" stroke="#fff" strokeWidth="6"
              strokeDasharray={c} strokeDashoffset={c * (1 - value/100)}
              strokeLinecap="round" transform="rotate(-90 36 36)"/>
      <text x="36" y="40" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800" fontFamily={T.type.fontEn}>{Math.round(value)}%</text>
    </svg>
  );
}

// 11 ───────────────────── Diary List ──────────────────────
function DiaryListScreen({ go, tab, setTab }) {
  const [filter, setFilter] = React.useState("all");
  const entries = [
    { date: "2025-11-24", mood: "좋음", moodColor: T.color.success, title: "햇살 가득한 산책", preview: "아침에 산책을 다녀왔다. 햇살이 따뜻했고 마음이 평온해졌다." },
    { date: "2025-11-23", mood: "평범", moodColor: T.color.textCaption, title: "평범한 하루", preview: "평범한 하루였다. 일이 많아서 조금 지쳤지만 그래도..." },
    { date: "2025-11-22", mood: "불안", moodColor: T.color.primary, title: "발표 전날 밤", preview: "발표를 앞두고 잠이 잘 안 왔다. 호흡을 가다듬으며..." },
    { date: "2025-11-21", mood: "좋음", moodColor: T.color.success, title: "친구와 만남", preview: "오랜만에 친구를 만났다. 함께 카페에서 이야기를 나누며..." },
    { date: "2025-11-20", mood: "우울", moodColor: T.color.primarySoft, title: "비 오는 날", preview: "하루 종일 비가 내렸다. 마음도 조금 가라앉았다." },
    { date: "2025-11-19", mood: "좋음", moodColor: T.color.success, title: "작은 성취", preview: "오랜 프로젝트가 마무리됐다. 보람을 느꼈다." },
  ];

  const filtered = filter === "all" ? entries : entries.filter(e => e.mood === filter);
  const grouped = filtered.reduce((acc, e) => {
    const m = e.date.slice(0, 7);
    (acc[m] = acc[m] || []).push(e);
    return acc;
  }, {});

  return (
    <Screen>
      <div style={{ padding: "20px 24px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: T.color.primary, fontWeight: 700, letterSpacing: 1.5, fontFamily: T.type.fontEn }}>MY JOURNAL</div>
          <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: T.color.textHeading, letterSpacing: -0.5 }}>감정 일기</div>
        </div>
        <button onClick={() => go("diary-mood")} style={{
          width: 48, height: 48, borderRadius: 16, background: T.color.primary, color:"#fff",
          border:"none", cursor:"pointer", boxShadow: T.color.shadowFab,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4v14M4 11h14"/></svg>
        </button>
      </div>

      {/* mood filter chips */}
      <div style={{ padding: "0 24px 16px", display:"flex", gap: 8, overflowX:"auto" }}>
        {[
          { k: "all", l: "전체", c: T.color.primary },
          { k: "좋음", l: "😊 좋음", c: T.color.success },
          { k: "평범", l: "😐 평범", c: T.color.textCaption },
          { k: "불안", l: "😟 불안", c: T.color.primary },
          { k: "우울", l: "😢 우울", c: T.color.primarySoft },
          { k: "화남", l: "😡 화남", c: T.color.danger },
        ].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} style={{
            flexShrink: 0, padding: "8px 14px", borderRadius: 9999,
            background: filter === f.k ? T.color.primary : T.color.surface,
            color: filter === f.k ? "#fff" : T.color.textBody,
            border: filter === f.k ? "none" : `1px solid ${T.color.border}`,
            fontSize: 12, fontWeight: 600, cursor:"pointer",
          }}>{f.l}</button>
        ))}
      </div>

      <div style={{ padding: "0 24px 100px" }}>
        {Object.entries(grouped).map(([month, items]) => (
          <div key={month} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.color.textCaption, marginBottom: 10, fontFamily: T.type.fontEn, letterSpacing: 1 }}>
              {month.replace("-", ". ")}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap: 10 }}>
              {items.map((e, i) => (
                <Card key={i} padding={16} onClick={() => go("diary-detail", { entry: e })} style={{ cursor:"pointer", display:"flex", gap: 14 }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", paddingTop: 2 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.color.textHeading, fontFamily: T.type.fontEn, lineHeight: 1 }}>{e.date.slice(8, 10)}</div>
                    <div style={{ fontSize: 9, color: T.color.textMuted, fontWeight: 600, marginTop: 2, fontFamily: T.type.fontEn }}>
                      {["일","월","화","수","목","금","토"][new Date(e.date).getDay()]}요일
                    </div>
                  </div>
                  <div style={{ width: 1, alignSelf:"stretch", background: T.color.borderSubtle }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap: 8 }}>
                      <Pill color={e.moodColor} bg={e.moodColor + "1A"}>{e.mood}</Pill>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: T.color.textHeading }}>{e.title}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: T.color.textCaption, lineHeight: 1.5,
                      overflow:"hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient:"vertical" }}>{e.preview}</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <BottomTabBar active={tab} onChange={setTab}/>
    </Screen>
  );
}

// 12 ─────────────────── Report ──────────────────────────
function ReportScreen({ go, tab, setTab }) {
  const [period, setPeriod] = React.useState("week");
  return (
    <Screen>
      <div style={{ padding: "20px 24px 16px" }}>
        <div style={{ fontSize: 12, color: T.color.primary, fontWeight: 700, letterSpacing: 1.5, fontFamily: T.type.fontEn }}>INSIGHTS</div>
        <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: T.color.textHeading, letterSpacing: -0.5 }}>나의 리포트</div>
      </div>

      <div style={{ padding: "0 24px", display:"flex", gap: 8 }}>
        {[{k:"week",l:"주간"},{k:"month",l:"월간"},{k:"year",l:"연간"}].map(p => (
          <button key={p.k} onClick={() => setPeriod(p.k)} style={{
            flex: 1, height: 36, borderRadius: 12,
            background: period === p.k ? T.color.primary : T.color.surface,
            color: period === p.k ? "#fff" : T.color.textBody,
            border: "none", fontSize: 13, fontWeight: 600, cursor:"pointer",
            boxShadow: period === p.k ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
          }}>{p.l}</button>
        ))}
      </div>

      <div style={{ padding: "16px 24px 100px" }}>
        {/* Mood trend chart */}
        <Card padding={20}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize: 12, color: T.color.textCaption, fontWeight: 600 }}>이번 주 평균 기분</div>
              <div style={{ marginTop: 4, fontSize: 28, fontWeight: 800, color: T.color.textHeading, fontFamily: T.type.fontEn }}>
                3.8<span style={{ fontSize: 14, color: T.color.textMuted, fontWeight: 600 }}> / 5.0</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: T.color.success, fontWeight: 600 }}>↑ 0.4 지난주 대비</div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 12, background: T.color.mintBgSoft,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize: 18,
            }}>📈</div>
          </div>
          {/* line chart */}
          <div style={{ marginTop: 24, height: 140, position:"relative" }}>
            <MoodLineChart values={[3, 3.5, 2.8, 4.2, 4.5, 3.8, 4.0]} labels={["월","화","수","목","금","토","일"]}/>
          </div>
        </Card>

        {/* Keyword cloud */}
        <Card padding={20} style={{ marginTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.color.textHeading }}>이번 주 자주 쓴 단어</div>
          <div style={{ marginTop: 14, display:"flex", flexWrap:"wrap", gap: 8 }}>
            {[
              { w: "산책", n: 8, big: true },
              { w: "친구", n: 6, big: true },
              { w: "햇살", n: 5 },
              { w: "발표", n: 4 },
              { w: "명상", n: 4 },
              { w: "카페", n: 3 },
              { w: "비", n: 3 },
              { w: "성취", n: 2 },
              { w: "잠", n: 2 },
            ].map((t, i) => (
              <span key={i} style={{
                padding: t.big ? "8px 16px" : "6px 12px",
                borderRadius: 9999,
                background: t.big ? T.color.primary : T.color.primaryBgWash,
                color: t.big ? "#fff" : T.color.primary,
                fontSize: t.big ? 14 : 12,
                fontWeight: t.big ? 700 : 600,
              }}>#{t.w} <span style={{ opacity: 0.6, fontFamily: T.type.fontEn, marginLeft: 4 }}>{t.n}</span></span>
            ))}
          </div>
        </Card>

        {/* AI summary */}
        <Card padding={0} style={{ marginTop: 14, overflow:"hidden" }}>
          <div style={{ background: T.color.primary, color:"#fff", padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, opacity: 0.7, fontFamily: T.type.fontEn }}>BRIDGE'S AI ANALYSIS</div>
            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>
              이번 주는 회복의 한 주였어요
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: T.color.textBody, lineHeight: 1.7 }}>
              주중에는 발표 준비로 다소 긴장된 모습을 보이셨지만, 주말의 산책과 친구와의 만남으로 마음이 한결 편안해진 듯 보여요. 특히 <strong style={{ color: T.color.primary }}>"햇살"</strong>, <strong style={{ color: T.color.primary }}>"산책"</strong> 같은 단어들이 자주 등장했어요.
            </div>
            <div style={{ marginTop: 16, padding: 12, background: T.color.mintBgWash, borderRadius: 12, display:"flex", gap: 10 }}>
              <div style={{ fontSize: 18 }}>💡</div>
              <div style={{ flex: 1, fontSize: 12, color: T.color.textBody, lineHeight: 1.6 }}>
                <strong>다음 주 추천:</strong> 야외 활동 루틴을 늘려보세요. 햇살은 당신의 좋은 친구네요.
              </div>
            </div>
          </div>
        </Card>

        {/* Routine completion */}
        <Card padding={20} style={{ marginTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.color.textHeading }}>루틴 달성률</div>
          <div style={{ marginTop: 14, display:"flex", flexDirection:"column", gap: 12 }}>
            {[
              { l: "아침 명상", v: 86 },
              { l: "감정 일기", v: 100 },
              { l: "물 8잔",     v: 64 },
              { l: "스트레칭",   v: 71 },
            ].map((r, i) => (
              <div key={i}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: T.color.textHeading }}>{r.l}</span>
                  <span style={{ fontSize: 12, color: T.color.primary, fontWeight: 700, fontFamily: T.type.fontEn }}>{r.v}%</span>
                </div>
                <div style={{ height: 6, background: T.color.bgAlt, borderRadius: 3, overflow:"hidden" }}>
                  <div style={{ width: `${r.v}%`, height:"100%", background: T.color.primary, borderRadius: 3 }}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <BottomTabBar active={tab} onChange={setTab}/>
    </Screen>
  );
}

function MoodLineChart({ values, labels }) {
  const max = 5, min = 1;
  const w = 320, h = 120, pad = 16;
  const stepX = (w - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => [pad + stepX * i, h - pad - ((v - min) / (max - min)) * (h - pad * 2)]);
  const path = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = path + ` L${points[points.length - 1][0]},${h} L${pad},${h} Z`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h + 24}`}>
      <defs>
        <linearGradient id="moodGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={T.color.primary} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={T.color.primary} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#moodGrad)"/>
      <path d={path} stroke={T.color.primary} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#fff" stroke={T.color.primary} strokeWidth="2"/>
      ))}
      {labels.map((l, i) => (
        <text key={i} x={pad + stepX * i} y={h + 16} fontSize="11" fill={T.color.textCaption} textAnchor="middle">{l}</text>
      ))}
    </svg>
  );
}

// 13 ─────────────── MyPage ──────────────────────────────
function MyPageScreen({ go, session, setSession, tab, setTab }) {
  return (
    <Screen>
      <div style={{ padding: "20px 24px 16px" }}>
        <div style={{ fontSize: 12, color: T.color.primary, fontWeight: 700, letterSpacing: 1.5, fontFamily: T.type.fontEn }}>MY PAGE</div>
        <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: T.color.textHeading, letterSpacing: -0.5 }}>마이페이지</div>
      </div>

      <div style={{ padding: "0 24px 100px" }}>
        {/* Profile card */}
        <Card padding={20} onClick={() => go("profile-edit")} style={{ display:"flex", alignItems:"center", gap: 16, cursor:"pointer" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 9999,
            background: `linear-gradient(135deg, ${T.color.primary} 0%, ${T.color.primarySoft} 100%)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontSize: 22, fontWeight: 800, fontFamily: T.type.fontDisplay,
          }}>{session?.nickname?.[0] || "B"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.color.textHeading }}>{session?.nickname || "친구"}</div>
            <div style={{ fontSize: 12, color: T.color.textCaption, marginTop: 2 }}>brid.ge@bridge.app</div>
            <div style={{ marginTop: 8, display:"flex", gap: 6 }}>
              <Pill bg={T.color.mintBgSoft} color={T.color.mintDeep}>🔥 32일째</Pill>
              <Pill>Lv. 4 안정기</Pill>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={T.color.textMuted} strokeWidth="1.5"><path d="M6 4l4 4-4 4"/></svg>
        </Card>

        {/* Stats */}
        <div style={{ marginTop: 14, display:"grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <StatBlock label="기록 일수" value="32" suffix="일"/>
          <StatBlock label="작성 일기" value="28" suffix="개"/>
          <StatBlock label="달성 루틴" value="186" suffix="개"/>
        </div>

        {/* Sections */}
        <SectionList title="활동" items={[
          { icon: "🎯", label: "내 목표", arrow: true },
          { icon: "🏆", label: "달성 기록", badge: "12", arrow: true },
          { icon: "📊", label: "AI 자가진단 다시 하기", arrow: true, onClick: () => go("ai-assessment") },
        ]}/>

        <SectionList title="설정" items={[
          { icon: "🔔", label: "알림 설정", toggle: true, value: true },
          { icon: "🌙", label: "다크 모드", toggle: true, value: false },
          { icon: "🔒", label: "잠금 설정", arrow: true },
          { icon: "🌐", label: "언어", value: "한국어", arrow: true },
        ]}/>

        <SectionList title="고객 지원" items={[
          { icon: "❓", label: "자주 묻는 질문", arrow: true },
          { icon: "✉️", label: "문의하기", arrow: true },
          { icon: "📜", label: "약관 및 정책", arrow: true },
        ]}/>

        <button onClick={() => { setSession(null); go("login"); }} style={{
          marginTop: 20, width:"100%", padding: 16,
          background:"transparent", border: `1px solid ${T.color.border}`,
          borderRadius: 14, color: T.color.textCaption, fontSize: 14, fontWeight: 600, cursor:"pointer",
        }}>로그아웃</button>
        <div style={{ marginTop: 12, textAlign:"center", fontSize: 11, color: T.color.textMuted, fontFamily: T.type.fontEn }}>v1.0.0 · Bridge</div>
      </div>

      <BottomTabBar active={tab} onChange={setTab}/>
    </Screen>
  );
}

function StatBlock({ label, value, suffix }) {
  return (
    <Card padding={16} style={{ textAlign:"center" }}>
      <div style={{ fontSize: 11, color: T.color.textCaption, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: T.color.textHeading, fontFamily: T.type.fontEn }}>
        {value}<span style={{ fontSize: 11, color: T.color.textMuted, fontWeight: 500, marginLeft: 2 }}>{suffix}</span>
      </div>
    </Card>
  );
}

function SectionList({ title, items }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.color.textCaption, marginBottom: 8, padding: "0 4px" }}>{title}</div>
      <Card padding={4}>
        {items.map((it, i) => (
          <div key={i} onClick={it.onClick} style={{
            padding: "12px 14px",
            borderTop: i === 0 ? "none" : `1px solid ${T.color.borderSubtle}`,
            display:"flex", alignItems:"center", gap: 12,
            cursor: it.onClick || it.arrow ? "pointer" : "default",
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: T.color.primaryBgWash, display:"flex", alignItems:"center", justifyContent:"center", fontSize: 14 }}>{it.icon}</div>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: T.color.textHeading }}>{it.label}</div>
            {it.badge && <Pill bg={T.color.danger + "1A"} color={T.color.danger}>{it.badge}</Pill>}
            {it.value && !it.toggle && <span style={{ fontSize: 12, color: T.color.textCaption }}>{it.value}</span>}
            {it.toggle && (
              <div style={{
                width: 36, height: 22, borderRadius: 11,
                background: it.value ? T.color.primary : T.color.borderStrong,
                position:"relative", transition:"background 120ms",
              }}>
                <div style={{
                  position:"absolute", top: 2, left: it.value ? 16 : 2,
                  width: 18, height: 18, borderRadius: 9, background:"#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition:"left 120ms",
                }}/>
              </div>
            )}
            {it.arrow && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={T.color.textMuted} strokeWidth="1.5"><path d="M5 3l4 4-4 4"/></svg>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

Object.assign(window, { HomeScreen, RoutineScreen, DiaryListScreen, ReportScreen, MyPageScreen });
