// api 콘솔에서 화면에대한 구역별 기능을 정의

export const apiCatalog = [
    {
        group: "Members",
        items: [
            {
                name: "Login",
                method: "POST",
                path: "/members/login",
                auth: false,
                sampleBody: { email: "codestates1@gmail.com", password: "abcd1234" },
            },
            { name: "Mypage", method: "GET", path: "/members", auth: true },
            {
                name: "Create Member",
                method: "POST",
                path: "/members",
                auth: false,
                sampleBody: { email: "", password: "", name: "", phone: "" },
            },
        ],
    },

    {
        group: "Boards",
        items: [
            // ====== GET (목록) 예시 ======
            { name: "자유게시판 조회", method: "GET", path: "/boards", auth: true, sampleParams: {kind: "FREE_BOARD", page: 1, size: 10 } },
            { name: "에코게시판 조회", method: "GET", path: "/boards", auth: true, sampleParams: {kind: "ECO_REVIEW", page: 1, size: 10 } },
            { name: "그린게시판 조회", method: "GET", path: "/boards", auth: true, sampleParams: {kind: "GREEN_ACTIVE", page: 1, size: 10 } },

            // ====== POST (작성) : 모두 multipart 기본 ======
            {
                name: "게시글 생성하기",
                method: "POST",
                path: "/boards",
                auth: true,
                bodyType: "multipart",
                sampleParams: {kind: "FREE_BOARD"},
                multipartDefaults: { title: "", contents: ""}, // ✅ 기본 키
                fileKey: "files", // ✅ 파일 키
            },
        ],
    },
];
