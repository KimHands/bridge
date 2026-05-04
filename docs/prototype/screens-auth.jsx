// Bridge — Auth flow screens (Splash, Onboarding 1/2/3, Login, Signup, Forgot)
const T = window.BridgeTokens;

// 01 ─────────────────────── Splash ───────────────────────
function SplashScreen({ go }) {
  // auto-advance after 1.6s
  React.useEffect(() => {
    const id = setTimeout(() => go?.("onboarding1"), 1800);
    return () => clearTimeout(id);
  }, []);
  return (
    <Screen scroll={false}>
      <DecorativeBlobs/>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center", gap: 28, zIndex: 2 }}>
        <div style={{
          width: 124, height: 124, borderRadius: 32,
          background: "#1A1B21", display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow: T.color.shadowCardLg,
        }}>
          <span style={{ fontFamily: T.type.fontDisplay, fontSize: 36, color: "#3FA9F5", fontWeight: 800, letterSpacing: -1 }}>bridge</span>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily: T.type.fontDisplay, fontSize: 56, fontWeight: 800, color: T.color.primary, letterSpacing: -1.5, lineHeight: 1 }}>Bridge</div>
          <div style={{ marginTop: 14, fontSize: 14, color: T.color.textMuted }}>방치된 당신과 병원 사이의 다리, Bridge</div>
        </div>
      </div>
      <div style={{ position:"absolute", bottom: 80, left: 0, right: 0, textAlign:"center" }}>
        <div style={{ display:"inline-flex", gap: 6, marginBottom: 16 }}>
          <span style={{ width: 24, height: 3, borderRadius: 2, background: T.color.primary }}/>
          <span style={{ width: 8, height: 3, borderRadius: 2, background: T.color.borderStrong }}/>
        </div>
        <div style={{ fontSize: 11, letterSpacing: 2, color: T.color.textMuted, fontWeight: 600 }}>YOUR PATH TO WELLNESS</div>
      </div>
    </Screen>
  );
}

// 02 ────────────────── Onboarding 1 (mood preview) ───────
function Onb1Screen({ go }) {
  return (
    <Screen scroll={false}>
      <DecorativeBlobs/>
      <div style={{ height: 56, padding: "0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", zIndex: 2 }}>
        <div style={{ width: 40 }}/>
        <div style={{ fontFamily: T.type.fontDisplay, fontSize: 20, fontWeight: 700, color: T.color.primary }}>Bridge</div>
        <button onClick={() => go("login")} style={{ background:"none", border:"none", color: T.color.textBody, fontSize: 14, cursor:"pointer", fontFamily: T.type.fontEn }}>Skip</button>
      </div>

      <div style={{ padding: "24px 28px 0", position:"relative", zIndex: 2 }}>
        <Card padding={24} style={{ borderRadius: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: T.color.primary, fontWeight: 700, fontFamily: T.type.fontEn }}>SELECT MOOD</div>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700, color: T.color.textHeading }}>지금 기분이 어떠신가요?</div>
          <div style={{ marginTop: 20, display:"grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <MoodCard icon="😊" label="평온한" tone="mint" />
            <MoodCard icon="★"  label="뿌듯한" tone="purple" selected/>
            <MoodCard icon="🙂" label="기분 좋은" tone="ghost" />
            <MoodCard icon="🌙" label="나른한" tone="ghost" />
            <MoodCard icon="🧘" label="차분한" tone="ghost" />
            <MoodCard icon="+"  label="기타" tone="dashed" />
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 32, padding:"0 28px", textAlign:"center" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: T.color.textHeading, lineHeight: 1.3 }}>
          내 감정을 매일<br/>기록해요
        </div>
        <div style={{ marginTop: 16, fontSize: 14, color: T.color.textCaption, lineHeight: 1.6 }}>
          매일의 감정을 기록하고 분석하여<br/>당신의 마음 건강을 돌봐드려요.
        </div>
      </div>

      <div style={{ position:"absolute", bottom: 36, left: 28, right: 28, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", gap: 6 }}>
          <span style={{ width: 24, height: 4, borderRadius: 2, background: T.color.primary }}/>
          <span style={{ width: 6, height: 4, borderRadius: 2, background: T.color.borderStrong }}/>
          <span style={{ width: 6, height: 4, borderRadius: 2, background: T.color.borderStrong }}/>
        </div>
        <button onClick={() => go("onboarding2")} style={{
          width: 56, height: 56, borderRadius: 9999,
          background: T.color.primary, border: "none", color: "#fff",
          display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
          boxShadow: T.color.shadowFab,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </Screen>
  );
}

function MoodCard({ icon, label, tone, selected }) {
  const tones = {
    mint:   { bg: T.color.mintBgSoft, fg: T.color.mintDeep, border: "transparent" },
    purple: { bg: T.color.primaryBgSoft, fg: T.color.primary, border: T.color.primary },
    ghost:  { bg: T.color.bgAlt, fg: T.color.textBody, border: "transparent" },
    dashed: { bg: T.color.bgAlt, fg: T.color.textMuted, border: "transparent" },
  }[tone];
  return (
    <div style={{
      background: tones.bg, color: tones.fg,
      borderRadius: 18, padding: "16px 0",
      display:"flex", flexDirection:"column", alignItems:"center", gap: 4,
      border: selected ? `2px solid ${tones.border}` : "1px solid transparent",
      transition: "all 120ms",
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// 03 ────────────── Onboarding 2 (routine preview) ─────────
function Onb2Screen({ go }) {
  return (
    <Screen scroll={false}>
      <DecorativeBlobs/>
      <div style={{ height: 56, padding: "0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", zIndex:2 }}>
        <div style={{ width: 40 }}/>
        <div style={{ fontFamily: T.type.fontDisplay, fontSize: 20, fontWeight: 700, color: T.color.primary }}>Bridge</div>
        <button onClick={() => go("login")} style={{ background:"none", border:"none", color: T.color.textBody, fontSize: 14, cursor:"pointer", fontFamily: T.type.fontEn }}>Skip</button>
      </div>

      <div style={{ padding:"24px 28px 0", position:"relative", zIndex:2 }}>
        <Card padding={20} style={{ borderRadius: 24 }}>
          <div style={{ fontSize: 12, color: T.color.primary, fontFamily: T.type.fontEn, fontWeight: 700 }}>07:30 AM</div>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: T.color.textHeading }}>오늘의 루틴</div>
          <div style={{ marginTop: 16, display:"flex", flexDirection:"column", gap: 10 }}>
            <RoutineRow icon="🧘" title="아침 명상" sub="5분 · 마음 챙김" status="done"/>
            <RoutineRow icon="💧" title="미지근한 물 한 잔" sub="매일 아침 · 수분 공급" highlight/>
            <RoutineRow icon="🚶" title="가벼운 스트레칭" sub="10분 · 몸 풀기"/>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 32, padding:"0 28px", textAlign:"center" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: T.color.textHeading, lineHeight: 1.3 }}>
          나만의 루틴으로<br/>일상을 회복해요
        </div>
        <div style={{ marginTop: 16, fontSize: 14, color: T.color.textCaption, lineHeight: 1.6 }}>
          가벼운 명상부터 작은 운동까지,<br/>당신만의 페이스로 활력을 찾으세요.
        </div>
      </div>

      <div style={{ position:"absolute", bottom: 36, left: 28, right: 28, display:"flex", alignItems:"center", gap: 12 }}>
        <PrimaryButton variant="soft" full={false} onClick={() => go("onboarding1")} style={{ flex: 1 }}>이전</PrimaryButton>
        <PrimaryButton onClick={() => go("onboarding3")} style={{ flex: 2 }}>다음</PrimaryButton>
      </div>
      <div style={{ position:"absolute", bottom: 110, left: 0, right: 0, display:"flex", justifyContent:"center", gap: 6 }}>
        <span style={{ width: 6, height: 4, borderRadius: 2, background: T.color.borderStrong }}/>
        <span style={{ width: 24, height: 4, borderRadius: 2, background: T.color.primary }}/>
        <span style={{ width: 6, height: 4, borderRadius: 2, background: T.color.borderStrong }}/>
      </div>
    </Screen>
  );
}

function RoutineRow({ icon, title, sub, status, highlight }) {
  return (
    <div style={{
      background: highlight ? T.color.primary : T.color.surface,
      borderRadius: T.radius.lg,
      padding: "14px 16px",
      display:"flex", alignItems:"center", gap: 14,
      boxShadow: highlight ? "none" : "0 2px 6px rgba(91,85,142,0.05)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: highlight ? "rgba(255,255,255,0.18)" : T.color.bgAlt,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize: 18,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: highlight ? "#fff" : T.color.textHeading }}>{title}</div>
        <div style={{ fontSize: 12, color: highlight ? "rgba(255,255,255,0.75)" : T.color.textCaption, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{
        width: 24, height: 24, borderRadius: 12,
        background: status === "done" ? T.color.primary : "transparent",
        border: status === "done" ? "none" : `1.5px solid ${highlight ? "rgba(255,255,255,0.5)" : T.color.borderStrong}`,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        {status === "done" && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </div>
  );
}

// 04 ──────────────── Onboarding 3 (insights) ──────────────
function Onb3Screen({ go }) {
  return (
    <Screen scroll={false}>
      <DecorativeBlobs/>
      <div style={{ height: 56, padding: "0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", zIndex:2 }}>
        <div style={{ width: 40 }}/>
        <div style={{ fontFamily: T.type.fontDisplay, fontSize: 20, fontWeight: 700, color: T.color.primary }}>Bridge</div>
        <button onClick={() => go("login")} style={{ background:"none", border:"none", color: T.color.textMuted, fontSize: 14, cursor:"pointer" }}>건너뛰기</button>
      </div>

      <div style={{ padding:"24px 28px 0", position:"relative", zIndex:2 }}>
        <Card padding={20} style={{ borderRadius: 24 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 1.4, color: T.color.primary, fontWeight: 700, fontFamily: T.type.fontEn }}>WEEKLY INSIGHTS</div>
              <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: T.color.textHeading }}>주간 리포트</div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 12, background: T.color.mintBgSoft,
              display:"flex", alignItems:"center", justifyContent:"center", color: T.color.mintDeep,
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="12" height="12" rx="2"/><path d="M3 7h12M7 2v3M11 2v3"/>
              </svg>
            </div>
          </div>

          <div style={{ marginTop: 32, height: 110, display:"flex", alignItems:"flex-end", justifyContent:"space-between", padding: "0 4px" }}>
            {[3.4, 3.0, 4.1, 4.5, 3.8, 3.2, 4.0].map((v, i) => (
              <div key={i} style={{
                width: 16, height: `${v * 22}px`,
                background: i === 3 ? T.color.primary : T.color.primaryBgSoft,
                borderRadius: 4,
              }}/>
            ))}
          </div>
          <div style={{ marginTop: 8, display:"flex", justifyContent:"space-between", padding:"0 4px" }}>
            {["월","화","수","목","금","토","일"].map((d,i) => (
              <span key={i} style={{ fontSize: 11, color: i === 3 ? T.color.primary : T.color.textMuted, fontWeight: i === 3 ? 700 : 400, width: 16, textAlign:"center" }}>{d}</span>
            ))}
          </div>

          <div style={{ marginTop: 16, background: T.color.primaryBgWash, borderRadius: 14, padding: "12px 14px", display:"flex", alignItems:"center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: T.color.textCaption }}>마음 챙김 달성률</div>
              <div style={{ marginTop: 2, fontSize: 22, fontWeight: 800, color: T.color.textHeading, fontFamily: T.type.fontEn }}>
                82%<span style={{ fontSize: 12, color: T.color.success, marginLeft: 6 }}>↑12%</span>
              </div>
            </div>
            <CircleGauge value={82}/>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 28, padding:"0 28px", textAlign:"center" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: T.color.textHeading, lineHeight: 1.35 }}>
          당신의 변화를 함께 확인해요
        </div>
        <div style={{ marginTop: 12, fontSize: 14, color: T.color.textCaption, lineHeight: 1.6 }}>
          매일 쌓이는 감정의 조각들이 모여<br/>더 단단해지는 당신의 내일을 보여드려요.
        </div>
      </div>

      <div style={{ position:"absolute", bottom: 36, left: 28, right: 28 }}>
        <div style={{ display:"flex", justifyContent:"center", gap: 6, marginBottom: 16 }}>
          <span style={{ width: 6, height: 4, borderRadius: 2, background: T.color.borderStrong }}/>
          <span style={{ width: 6, height: 4, borderRadius: 2, background: T.color.borderStrong }}/>
          <span style={{ width: 24, height: 4, borderRadius: 2, background: T.color.primary }}/>
        </div>
        <PrimaryButton onClick={() => go("signup")}>시작하기</PrimaryButton>
        <button onClick={() => go("login")} style={{ marginTop: 12, width:"100%", background:"none", border:"none", color: T.color.textCaption, fontSize: 13, cursor:"pointer" }}>기존 계정으로 로그인하기</button>
      </div>
    </Screen>
  );
}

function CircleGauge({ value }) {
  const r = 18, c = 2 * Math.PI * r;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r={r} fill="none" stroke={T.color.primaryBgSoft} strokeWidth="4"/>
      <circle cx="24" cy="24" r={r} fill="none" stroke={T.color.primary} strokeWidth="4"
              strokeDasharray={c} strokeDashoffset={c * (1 - value/100)}
              strokeLinecap="round" transform="rotate(-90 24 24)"/>
    </svg>
  );
}

// 05 ──────────────────── Login ────────────────────────────
function LoginScreen({ go, setSession }) {
  const [email, setEmail] = React.useState("test@bridge.app");
  const [pw, setPw] = React.useState("password123");
  const [showPw, setShowPw] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const submit = () => {
    setErr(null);
    if (!email.includes("@")) { setErr("올바른 이메일을 입력해주세요"); return; }
    if (pw.length < 8)        { setErr("비밀번호는 8자 이상이어야 합니다"); return; }
    setLoading(true);
    setTimeout(() => {
      // mock: existing user → has assessment → home
      setSession({ user_id: "u_demo", nickname: "종건", access_token: "mock", requires_assessment: false });
      setLoading(false);
      go("home");
    }, 600);
  };

  return (
    <Screen>
      <DecorativeBlobs/>
      <TopBar leading={<BackBtn onClick={() => go("onboarding3")}/>} title="Bridge" transparent/>
      <div style={{ position:"relative", zIndex:2, padding:"8px 24px 32px" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: T.color.primary, display:"flex", alignItems:"center", justifyContent:"center",
          marginTop: 24,
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>
          </svg>
        </div>
        <div style={{ marginTop: 24, fontSize: 28, fontWeight: 800, color: T.color.textHeading, letterSpacing: -0.5 }}>다시 만나서 반가워요</div>
        <div style={{ marginTop: 12, fontSize: 14, color: T.color.textCaption, lineHeight: 1.6 }}>
          당신의 마음을 잇는 가장 편안한 다리, 브릿지 입니다.
        </div>

        <div style={{ marginTop: 32, display:"flex", flexDirection:"column", gap: 16 }}>
          <TextField label="Email" placeholder="이메일을 입력하세요" value={email} onChange={setEmail}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 4l6 5 6-5"/></svg>}/>
          <TextField label="Password" type={showPw ? "text" : "password"} placeholder="비밀번호를 입력하세요" value={pw} onChange={setPw}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>}
            rightSlot={<button onClick={() => setShowPw(s => !s)} style={{ background:"none", border:"none", cursor:"pointer", color: T.color.textMuted, padding: 0 }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="9" cy="9" r="2"/></svg>
            </button>}/>
        </div>

        {err && <div style={{ marginTop: 12, fontSize: 12, color: T.color.danger }}>{err}</div>}

        <div style={{ marginTop: 28 }}>
          <PrimaryButton onClick={submit} disabled={loading}>{loading ? "로그인 중..." : "Login"}</PrimaryButton>
        </div>

        <div style={{ marginTop: 20, textAlign:"center" }}>
          <button style={{ background:"none", border:"none", color: T.color.textBody, fontSize: 14, cursor:"pointer" }}>비밀번호 찾기</button>
        </div>

        <div style={{ marginTop: 24, display:"flex", alignItems:"center", gap: 12 }}>
          <Divider/>
          <span style={{ fontSize: 12, color: T.color.textMuted, fontFamily: T.type.fontEn }}>또는</span>
          <Divider/>
        </div>

        <div style={{ marginTop: 32, textAlign:"center" }}>
          <div style={{ fontSize: 14, color: T.color.textBody }}>계정이 없으신가요?</div>
          <button onClick={() => go("signup")} style={{
            marginTop: 10, padding: "8px 28px", borderRadius: 8,
            border: `1px solid ${T.color.primary}`, background:"transparent",
            color: T.color.primary, fontSize: 14, fontWeight: 600, cursor:"pointer",
          }}>회원가입</button>
        </div>
      </div>
    </Screen>
  );
}

// 06 ──────────────────── Signup ───────────────────────────
function SignupScreen({ go, setSession }) {
  const [nickname, setNick] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [agree, setAgree] = React.useState({ tos: false, privacy: false, marketing: false });
  const [err, setErr] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const allRequired = agree.tos && agree.privacy;
  const allChecked = agree.tos && agree.privacy && agree.marketing;
  const toggleAll = () => {
    const v = !allChecked;
    setAgree({ tos: v, privacy: v, marketing: v });
  };

  const submit = () => {
    setErr(null);
    if (!nickname.trim())       return setErr("닉네임은 필수입니다");
    if (!email.includes("@"))   return setErr("올바른 이메일을 입력해주세요");
    if (pw.length < 8)          return setErr("비밀번호는 8자 이상이어야 합니다");
    if (pw !== pw2)             return setErr("비밀번호가 일치하지 않습니다");
    if (!allRequired)           return setErr("필수 약관에 동의해주세요");
    setLoading(true);
    setTimeout(() => {
      setSession({ user_id: "u_new", nickname, access_token: "mock", requires_assessment: true });
      setLoading(false);
      go("ai-assessment");
    }, 600);
  };

  return (
    <Screen>
      <TopBar leading={<BackBtn onClick={() => go("onboarding3")}/>} title="Bridge"/>
      <div style={{ padding: "8px 24px 32px" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: T.color.textHeading, letterSpacing: -0.5 }}>
          <span style={{ fontFamily: T.type.fontDisplay }}>Bridge </span>시작하기
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: T.color.textCaption, lineHeight: 1.6 }}>
          평온한 내일을 위한 첫 걸음을<br/>브릿지와 함께 시작해보세요.
        </div>

        <div style={{ marginTop: 28, display:"flex", flexDirection:"column", gap: 14 }}>
          <SignupInput label="닉네임" placeholder="어떻게 불러드릴까요?" value={nickname} onChange={setNick}/>
          <SignupInput label="이메일" placeholder="example@bridge.com" value={email} onChange={setEmail}/>
          <SignupInput label="비밀번호" type="password" placeholder="8자 이상 입력해주세요" value={pw} onChange={setPw} eye/>
          <SignupInput label="비밀번호 확인" type="password" placeholder="다시 한번 입력해주세요" value={pw2} onChange={setPw2} eye/>
        </div>

        <Card padding={16} style={{ marginTop: 18, background: T.color.bgAlt, boxShadow:"none" }}>
          <CheckRow checked={allChecked} onClick={toggleAll} label="모두 동의합니다" bold/>
          <Divider style={{ margin: "12px 0" }}/>
          <CheckRow checked={agree.tos}       onClick={() => setAgree(a => ({...a, tos: !a.tos}))}           label="이용약관 동의 (필수)" arrow/>
          <CheckRow checked={agree.privacy}   onClick={() => setAgree(a => ({...a, privacy: !a.privacy}))}   label="개인정보 처리방침 동의 (필수)" arrow/>
          <CheckRow checked={agree.marketing} onClick={() => setAgree(a => ({...a, marketing: !a.marketing}))} label="마케팅 정보 수신 동의 (선택)" arrow/>
        </Card>

        {err && <div style={{ marginTop: 12, fontSize: 12, color: T.color.danger }}>{err}</div>}

        <div style={{ marginTop: 24 }}>
          <PrimaryButton onClick={submit} disabled={loading}>{loading ? "가입 중..." : "Sign Up"}</PrimaryButton>
        </div>
        <div style={{ marginTop: 16, textAlign:"center", fontSize: 13, color: T.color.textCaption }}>
          이미 계정이 있으신가요? <button onClick={() => go("login")} style={{ background:"none", border:"none", color: T.color.primary, fontWeight: 600, cursor:"pointer", padding: 0 }}>로그인</button>
        </div>
      </div>
    </Screen>
  );
}

function SignupInput({ label, placeholder, type = "text", value, onChange, eye }) {
  const [show, setShow] = React.useState(false);
  const isPw = type === "password";
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.color.textBody, marginBottom: 6 }}>{label}</div>
      <div style={{
        height: 48, borderRadius: 12, background: T.color.surface,
        display:"flex", alignItems:"center", padding: "0 16px", gap: 8,
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
      }}>
        <input
          type={isPw && !show ? "password" : "text"} placeholder={placeholder}
          value={value} onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, border:"none", outline:"none", background:"transparent", fontSize: 14, fontFamily: T.type.fontKr, color: T.color.textHeading }}
        />
        {eye && (
          <button onClick={() => setShow(s => !s)} style={{ background:"none", border:"none", cursor:"pointer", color: T.color.textMuted, padding: 0, display:"flex" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="9" cy="9" r="2"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function CheckRow({ checked, onClick, label, bold, arrow }) {
  return (
    <div onClick={onClick} style={{ display:"flex", alignItems:"center", gap: 10, cursor:"pointer", padding: "4px 0" }}>
      <div style={{
        width: 20, height: 20, borderRadius: 6,
        background: checked ? T.color.primary : "#fff",
        border: `1.5px solid ${checked ? T.color.primary : T.color.borderStrong}`,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <div style={{ flex: 1, fontSize: 13, fontWeight: bold ? 700 : 500, color: T.color.textHeading }}>{label}</div>
      {arrow && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={T.color.textMuted} strokeWidth="1.5"><path d="M5 3l4 4-4 4"/></svg>
      )}
    </div>
  );
}

Object.assign(window, { SplashScreen, Onb1Screen, Onb2Screen, Onb3Screen, LoginScreen, SignupScreen });
