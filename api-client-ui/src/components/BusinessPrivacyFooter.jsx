const businessInfo = [
    ["상호", "Docky"],
    ["대표자", "김진수"],
    ["사업자등록번호", "갱신 예정"],
    ["통신판매업신고번호", "갱신 예정"],
    ["사업장 주소", "대전광역시 서구 계룡로"],
    ["전화번호", "갱신 예정"],
    ["고객센터", "kjsu1701@naver.com"],
    ["개인정보 보호 문의", "kjsu1701@naver.com"],
    ["호스팅서비스 제공자", "자체 서버 및 Cloudflare"],
    ["사업자정보 확인", "공정거래위원회 공개정보로 확인 가능"],
];

const privacyItems = [
    {
        title: "처리 목적",
        body: "회원가입과 로그인, 게시판·댓글·채팅 알림 등 서비스 제공, 부정 이용 방지, 보안 사고 대응, 이용 통계 개선을 위해 필요한 범위에서 개인정보를 처리합니다.",
    },
    {
        title: "처리 항목",
        body: "계정 식별정보, 이름 또는 닉네임, 이메일, 휴대전화번호, 프로필 이미지, 서비스 이용 기록, 접속 로그, IP 주소, 쿠키 및 인증 토큰 등 서비스 이용 과정에서 필요한 정보가 처리될 수 있습니다.",
    },
    {
        title: "보유 기간",
        body: "개인정보는 처리 목적 달성 또는 회원 탈퇴 시 지체 없이 파기합니다. 다만 관계 법령에 따라 보존이 필요한 경우 해당 법령에서 정한 기간 동안 분리 보관합니다.",
    },
    {
        title: "제3자 제공 및 위탁",
        body: "법령상 근거가 있거나 이용자의 동의가 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다. 서비스 운영에 필요한 외부 처리 위탁이 발생하면 위탁 업무와 보호 조치를 공개합니다.",
    },
    {
        title: "정보주체 권리",
        body: "이용자는 개인정보 열람, 정정, 삭제, 처리정지, 동의 철회를 요청할 수 있으며, 서비스는 본인 확인 후 관련 법령에서 정한 절차에 따라 처리합니다.",
    },
    {
        title: "안전성 확보조치",
        body: "접근권한 관리, 인증정보 보호, 전송구간 암호화, 접속기록 관리, 파일 업로드 제한, 개인정보 접근 최소화 등 기술적·관리적 보호조치를 적용합니다.",
    },
];

export const BusinessPrivacyFooter = ({ headingId = "business-privacy-footer-heading" }) => {
    return (
        <footer className="rounded-xl border border-line bg-surface px-3 py-3 text-[11px] text-ink-muted shadow-sm sm:px-4" aria-labelledby={headingId}>
            <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 id={headingId} className="text-xs font-black text-slate-800 sm:text-sm">사업자정보 및 개인정보처리방침</h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-black text-slate-600">시행일 2026.06.03</span>
                </div>
                <dl className="flex flex-wrap gap-x-3 gap-y-1 leading-snug">
                    {businessInfo.map(([label, value]) => (
                        <div key={label} className="inline-flex min-w-0 items-baseline gap-1">
                            <dt className="shrink-0 font-black text-ink-muted">{label}</dt>
                            <dd className="min-w-0 break-words font-bold text-ink-subtle">{value}</dd>
                        </div>
                    ))}
                </dl>
                <p className="font-bold leading-snug text-amber-700">
                    사업자등록번호, 통신판매업신고번호, 전화번호는 등록 완료 후 갱신하며, 유료 상품 또는 결제 기능 제공 시 거래조건·청약철회·환불·분쟁처리·구매안전서비스 적용 여부를 별도로 고지합니다.
                </p>
            </div>

            <details className="mt-2 rounded-xl bg-control px-3 py-2">
                <summary className="cursor-pointer text-xs font-black text-slate-700 sm:text-sm">개인정보처리방침 상세 내용 보기</summary>
                <p className="mt-3 font-medium leading-snug">
                    Docky는 개인정보 보호법 및 관계 법령에 따라 이용자의 개인정보를 필요한 범위에서만 처리하며, 처리 목적 달성 후 지체 없이 파기합니다.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {privacyItems.map((item) => (
                        <section key={item.title} className="rounded-xl border border-line bg-surface p-2.5">
                            <h3 className="font-black text-slate-700">{item.title}</h3>
                            <p className="mt-1 leading-snug">{item.body}</p>
                        </section>
                    ))}
                </div>
                <div className="mt-2 rounded-xl border border-line bg-surface p-2.5 leading-snug">
                    개인정보 보호 관련 문의, 권리 행사, 불만 처리는 고객센터 또는 관리자 연락 채널로 접수할 수 있습니다. 방침 변경 시 변경 내용과 시행일을 서비스 화면에 공지합니다.
                </div>
            </details>
        </footer>
    );
};

export default BusinessPrivacyFooter;
